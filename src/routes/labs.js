import { Router } from 'express';
import { query, first, transaction, audit } from '../db/index.js';
import { token, httpError } from '../services/security.js';
import { requireUser } from '../services/auth.js';
import { initialState, applyAction, evaluate, devices, pumpOn } from '../services/simulation.js';

export const labRouter = Router();
function visibleLab(req,id,connection) {
  return first("SELECT * FROM ot_labs WHERE id=? AND archived=0 AND (published=1 OR ?='admin')",[id,req.user.role],connection);
}
export function publicRun(run) {
  const state = typeof run.state === 'string' ? JSON.parse(run.state) : run.state;
  return { id:run.id, version:run.version, state, actions:run.actions, status:run.status, simulator:run.simulator,
    target:run.target, pump:pumpOn(run.simulator,state,run.target), result:evaluate(run.simulator,state,run.target) };
}
labRouter.get('/',async(req,res)=>{
  const labs = await query('SELECT id,title,summary,image_id FROM ot_labs WHERE published=1 AND archived=0 ORDER BY sort_order,id LIMIT 6');
  res.render('home',{title:res.locals.settings.site_name,labs});
});
labRouter.get('/labs',requireUser,async(req,res)=>{
  const labs=await query("SELECT l.*, (SELECT COUNT(*) FROM ot_runs r WHERE r.lab_id=l.id AND r.user_id=? AND r.status='passed' AND r.revision=l.revision) passed FROM ot_labs l WHERE archived=0 AND (published=1 OR ?='admin') ORDER BY sort_order,id",[req.user.id,req.user.role]);
  res.render('labs',{title:'ห้องปฏิบัติการ',labs});
});
labRouter.get('/lab/:id',requireUser,async(req,res)=>{
  const lab=await visibleLab(req,req.params.id);
  if(!lab) throw httpError(404,'ไม่พบแล็บที่เผยแพร่');
  const runs=await query('SELECT id,score,status,started_at,revision FROM ot_runs WHERE user_id=? AND lab_id=? ORDER BY started_at DESC LIMIT 5',[req.user.id,lab.id]);
  res.render('lab',{title:lab.title,lab,devices,runs});
});
labRouter.get('/results',requireUser,async(req,res)=>{
  const runs=await query('SELECT r.*,l.title FROM ot_runs r JOIN ot_labs l ON l.id=r.lab_id WHERE user_id=? ORDER BY started_at DESC LIMIT 100',[req.user.id]);
  res.render('results',{title:'ผลการฝึก',runs});
});
labRouter.post('/api/labs/:id/start',requireUser,async(req,res)=>{
  const result=await transaction(async connection=>{
    const user=await first('SELECT active FROM ot_users WHERE id=? FOR UPDATE',[req.user.id],connection);
    const session=await first('SELECT token FROM ot_sessions WHERE token=? AND expires_at>?',[req.user.token,Date.now()],connection);
    if(!user?.active || !session) throw httpError(401,'กรุณาเข้าสู่ระบบใหม่');
    const lab=await visibleLab(req,req.params.id,connection);
    if(!lab) throw httpError(404,'ไม่พบแล็บ');
    const current=await first("SELECT * FROM ot_runs WHERE user_id=? AND lab_id=? AND status='active' AND revision=? ORDER BY started_at DESC LIMIT 1",[req.user.id,lab.id,lab.revision],connection);
    if(current && !req.body.reset) return publicRun(current);
    await query("UPDATE ot_runs SET status='abandoned',finished_at=UTC_TIMESTAMP() WHERE user_id=? AND lab_id=? AND status='active'",[req.user.id,lab.id],connection);
    const id=token();
    const state=JSON.stringify(initialState(lab.simulator));
    await query('INSERT INTO ot_runs(id,user_id,lab_id,revision,simulator,target,state) VALUES(?,?,?,?,?,?,?)',[id,req.user.id,lab.id,lab.revision,lab.simulator,lab.target,state],connection);
    await audit(req.user.username,'LAB_STARTED','Lab '+lab.id,connection);
    return publicRun({id,state,version:0,actions:0,status:'active',simulator:lab.simulator,target:lab.target});
  });
  res.json(result);
});
labRouter.post('/api/runs/:id/action',requireUser,async(req,res)=>{
  const output=await transaction(async connection=>{
    const user=await first('SELECT active FROM ot_users WHERE id=? FOR UPDATE',[req.user.id],connection);
    const session=await first('SELECT token FROM ot_sessions WHERE token=? AND expires_at>?',[req.user.token,Date.now()],connection);
    if(!user?.active || !session) throw httpError(401,'กรุณาเข้าสู่ระบบใหม่');
    const run=await first('SELECT * FROM ot_runs WHERE id=? AND user_id=? FOR UPDATE',[req.params.id,req.user.id],connection);
    if(!run) throw httpError(404,'ไม่พบรอบการฝึก');
    const lab=await visibleLab(req,run.lab_id,connection);
    if(!lab || lab.revision !== run.revision) throw httpError(409,'แล็บมีการปรับปรุง กรุณาเปิดแล็บใหม่');
    if(!/^[a-f0-9]{64}$/.test(req.body.action_id || '')) throw httpError(400,'ข้อมูลคำสั่งไม่ถูกต้อง');
    if(run.last_action_id === req.body.action_id) return publicRun(run);
    if(run.status !== 'active') throw httpError(409,'รอบการฝึกนี้จบแล้ว กรุณาเริ่มใหม่');
    if(req.body.version !== run.version) throw httpError(409,'สถานะมีการเปลี่ยนแปลง กรุณาโหลดหน้าใหม่');
    if(run.actions >= 1000) throw httpError(400,'ครบจำนวนคำสั่งต่อรอบ กรุณาเริ่มรอบใหม่');
    const state=applyAction(run.simulator,JSON.parse(run.state),req.body.action || {},run.target);
    const result=evaluate(run.simulator,state,run.target);
    const status=result.passed?'passed':'active';
    await query("UPDATE ot_runs SET state=?,version=version+1,actions=actions+1,score=?,status=?,last_action_id=?,finished_at=IF(?='passed',UTC_TIMESTAMP(),NULL) WHERE id=?",
      [JSON.stringify(state),result.score,status,req.body.action_id,status,run.id],connection);
    if(result.passed) await audit(req.user.username,req.user.role==='admin'?'LAB_PREVIEW_PASSED':'LAB_PASSED','Lab '+lab.id,connection);
    return publicRun({...run,state:JSON.stringify(state),version:run.version+1,actions:run.actions+1,score:result.score,status});
  });
  res.json(output);
});
