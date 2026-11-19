import { Router, raw } from 'express';
import {validateLogo} from '../services/branding.js';
import { first, query, transaction, audit } from '../db/index.js';
import { requireUser, requireAdmin } from '../services/auth.js';
import { hashPassword, validName, validPassword, httpError } from '../services/security.js';
import { templates } from '../services/simulation.js';

export const adminRouter=Router();
adminRouter.use(requireUser,requireAdmin);
const number = (value,min,max) => /^\d+$/.test(String(value)) && Number(value)>=min && Number(value)<=max;
function labValues(body) {
  const values=['title','summary','lesson','mission'].map(key=>String(body[key] || '').trim());
  if(values.some((value,i)=>!value || value.length>[160,400,8000,2000][i])) throw httpError(400,'ตรวจความยาวและกรอกเนื้อหาให้ครบ');
  if(!templates.some(template=>template.key===body.simulator)) throw httpError(400,'เลือกชนิดแล็บ');
  if(!number(body.image_id,1,6) || !number(body.sort_order,0,9999)) throw httpError(400,'ลำดับหรือภาพไม่ถูกต้อง');
  const target=Number(body.target);
  if(['sensor','scada','build'].includes(body.simulator) && (!number(body.target,25,95) || target%5!==0)) throw httpError(400,'ระดับเป้าหมายต้องเป็น 25–95 เพิ่มทีละ 5');
  return [...values,body.simulator,Number(body.image_id),['sensor','scada','build'].includes(body.simulator)?target:0,Number(body.sort_order),body.published==='on'?1:0];
}
adminRouter.get('/',async(req,res)=>{
  const stats=await first(`SELECT
    (SELECT COUNT(*) FROM ot_users WHERE role='learner') learners,
    (SELECT COUNT(*) FROM ot_labs WHERE archived=0) labs,
    (SELECT COUNT(*) FROM ot_runs r JOIN ot_users u ON u.id=r.user_id WHERE u.role='learner' AND r.status='passed') passes,
    (SELECT COUNT(DISTINCT s.user_id) FROM ot_sessions s JOIN ot_users u ON u.id=s.user_id WHERE u.role='learner' AND u.active=1 AND s.last_seen>? AND s.expires_at>?) online`,[Date.now()-300_000,Date.now()]);
  const progress=await query(`SELECT u.id,u.username,u.display_name,u.active,
    (SELECT COUNT(DISTINCT r.lab_id) FROM ot_runs r JOIN ot_labs l ON l.id=r.lab_id WHERE r.user_id=u.id AND r.status='passed' AND r.revision=l.revision AND l.archived=0 AND l.published=1) completed,
    (SELECT MAX(s.last_seen) FROM ot_sessions s WHERE s.user_id=u.id AND s.expires_at>?) last_seen
    FROM ot_users u WHERE u.role='learner' ORDER BY u.id DESC LIMIT 200`,[Date.now()]);
  res.render('admin/overview',{title:'Admin Portal',tab:'overview',stats,progress});
});
adminRouter.get('/users',async(req,res)=>{
  const search=String(req.query.q || '').slice(0,80);
  const users=await query(`SELECT id,username,display_name,role,active FROM ot_users WHERE username LIKE ? OR display_name LIKE ? ORDER BY id DESC LIMIT 200`,['%'+search+'%','%'+search+'%']);
  res.render('admin/users',{title:'จัดการผู้ใช้',tab:'users',users,search});
});
adminRouter.post('/users',async(req,res)=>{
  const username=String(req.body.username || '').trim().toLowerCase();
  const display=String(req.body.display_name || '').trim();
  if(!validName(username) || !validPassword(req.body.password) || !display || display.length>120) throw httpError(400,'ชื่อผู้ใช้ใช้ a–z, 0–9, _ . - จำนวน 3–48 ตัวอักษร รหัสผ่าน 12–128 ตัวอักษร และกรอกชื่อแสดงผล');
  const password=await hashPassword(req.body.password);
  try {
    await transaction(async connection=>{
      await query("INSERT INTO ot_users(username,display_name,password_hash,role) VALUES(?,?,?,'learner')",[username,display,password],connection);
      await audit(req.user.username,'USER_CREATED',username,connection);
    });
  } catch(error) {
    if(error.code==='ER_DUP_ENTRY') throw httpError(409,'ชื่อผู้ใช้นี้ถูกใช้แล้ว');
    throw error;
  }
  res.redirect('/admin/users');
});
adminRouter.post('/users/:id',async(req,res)=>{
  const op=req.body.op;
  if(!['toggle','reset','rename'].includes(op)) throw httpError(400,'คำสั่งไม่ถูกต้อง');
  if(op==='reset' && !validPassword(req.body.password)) throw httpError(400,'รหัสผ่านต้องมี 12–128 ตัวอักษร');
  const display=String(req.body.display_name || '').trim();
  if(op==='rename' && (!display || display.length>120)) throw httpError(400,'ตรวจชื่อแสดงผล');
  const password=op==='reset'?await hashPassword(req.body.password):null;
  await transaction(async connection=>{
    const target=await first("SELECT * FROM ot_users WHERE id=? AND role='learner' FOR UPDATE",[req.params.id],connection);
    if(!target) throw httpError(404,'ไม่พบบัญชีผู้เรียน');
    if(op==='toggle') await query('UPDATE ot_users SET active=1-active WHERE id=?',[target.id],connection);
    if(op==='reset') await query('UPDATE ot_users SET password_hash=? WHERE id=?',[password,target.id],connection);
    if(op==='rename') await query('UPDATE ot_users SET display_name=? WHERE id=?',[display,target.id],connection);
    if(op!=='rename') await query('DELETE FROM ot_sessions WHERE user_id=?',[target.id],connection);
    await audit(req.user.username,'USER_'+op.toUpperCase(),target.username,connection);
  });
  res.redirect('/admin/users');
});
adminRouter.get('/labs',async(req,res)=>{
  const labs=await query('SELECT * FROM ot_labs ORDER BY archived,sort_order,id');
  res.render('admin/labs',{title:'จัดการแล็บ',tab:'labs',labs});
});
adminRouter.get('/labs/new',(req,res)=>res.render('admin/lab-edit',{title:'เพิ่มแล็บ',tab:'labs',lab:{id:null,title:'',summary:'',lesson:'',mission:'',simulator:'sensor',target:50,image_id:2,sort_order:10,published:0,revision:0},templates}));
adminRouter.get('/labs/:id/edit',async(req,res)=>{
  const lab=await first('SELECT * FROM ot_labs WHERE id=?',[req.params.id]);
  if(!lab) throw httpError(404,'ไม่พบแล็บ');
  res.render('admin/lab-edit',{title:'แก้ไขแล็บ',tab:'labs',lab,templates});
});
adminRouter.post('/labs',async(req,res)=>{
  const values=labValues(req.body);
  await transaction(async connection=>{
    const result=await query('INSERT INTO ot_labs(title,summary,lesson,mission,simulator,image_id,target,sort_order,published) VALUES(?,?,?,?,?,?,?,?,?)',values,connection);
    await audit(req.user.username,'LAB_CREATED','Lab '+result.insertId,connection);
  });
  res.redirect('/admin/labs');
});
adminRouter.post('/labs/:id',async(req,res)=>{
  const values=labValues(req.body);
  const revision=Number(req.body.revision);
  await transaction(async connection=>{
    const previous=await first('SELECT * FROM ot_labs WHERE id=? FOR UPDATE',[req.params.id],connection);
    if(!previous) throw httpError(404,'ไม่พบแล็บ');
    if(previous.revision!==revision) throw httpError(409,'แล็บถูกแก้ไขแล้ว กรุณาเปิดหน้าแก้ไขใหม่');
    const rulesChanged=previous.simulator!==values[4] || previous.target!==values[6];
    await query('UPDATE ot_labs SET title=?,summary=?,lesson=?,mission=?,simulator=?,image_id=?,target=?,sort_order=?,published=?,revision=revision+1 WHERE id=?',[...values,previous.id],connection);
    await query("UPDATE ot_runs SET status='abandoned',finished_at=UTC_TIMESTAMP() WHERE lab_id=? AND status='active'",[previous.id],connection);
    await audit(req.user.username,'LAB_UPDATED','Lab '+previous.id+(rulesChanged?' • simulation rules changed':''),connection);
  });
  res.redirect('/admin/labs');
});
adminRouter.post('/labs/:id/archive',async(req,res)=>{
  await transaction(async connection=>{
    const result=await query('UPDATE ot_labs SET archived=1-archived,published=0 WHERE id=?',[req.params.id],connection);
    if(!result.affectedRows) throw httpError(404,'ไม่พบแล็บ');
    await audit(req.user.username,'LAB_ARCHIVE_TOGGLED','Lab '+req.params.id,connection);
  });
  res.redirect('/admin/labs');
});
async function reportRows(search) {
  return query(`SELECT r.id,u.username,u.display_name,l.title,r.status,r.score,r.actions,r.started_at,r.finished_at,r.revision FROM ot_runs r JOIN ot_users u ON u.id=r.user_id JOIN ot_labs l ON l.id=r.lab_id WHERE u.role='learner' AND (u.username LIKE ? OR l.title LIKE ?) ORDER BY r.started_at DESC LIMIT 1000`,['%'+search+'%','%'+search+'%']);
}
adminRouter.get('/reports',async(req,res)=>{
  const search=String(req.query.q || '').slice(0,80);
  res.render('admin/reports',{title:'รายงานผลการฝึก',tab:'reports',rows:await reportRows(search),search});
});
adminRouter.get('/reports.csv',async(req,res)=>{
  const search=String(req.query.q || '').slice(0,80);
  const rows=await reportRows(search);
  const cell = value => {
    const text = String(value ?? '');
    const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"','""') + '"';
  };
  const columns=['username','display_name','title','status','score','actions','started_at','finished_at','revision'];
  res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="ot-ics-results.csv"'});
  res.send('\ufeff'+[columns,...rows.map(row=>columns.map(col=>row[col]))].map(row=>row.map(cell).join(',')).join('\r\n'));
});
adminRouter.get('/audit',async(req,res)=>{
  const p=Math.max(1,Math.min(100000,Number.parseInt(req.query.page,10)||1));
  const rows=await query('SELECT * FROM ot_audit ORDER BY id DESC LIMIT 50 OFFSET '+((p-1)*50));
  res.render('admin/audit',{title:'Logs & History',tab:'audit',rows,p});
});
adminRouter.get('/settings',(req,res)=>res.render('admin/settings',{title:'ตั้งค่าระบบ',tab:'settings',logoNotice:req.query.logo==='updated'?'บันทึก Logo เรียบร้อย':req.query.logo==='removed'?'ลบ Logo แล้ว':''}));
adminRouter.post('/settings',async(req,res)=>{
  const entries=['site_name','intro','organization'].map(key=>[key,String(req.body[key] || '').trim()]);
  if(entries.some(([,value])=>!value || value.length>400)) throw httpError(400,'กรอกข้อมูลให้ครบ ความยาวไม่เกิน 400 ตัวอักษร');
  await transaction(async connection=>{
    for(const [key,value] of entries) await query('UPDATE ot_settings SET setting_value=? WHERE setting_key=?',[value,key],connection);
    await audit(req.user.username,'SETTINGS_UPDATED','',connection);
  });
  res.redirect('/admin/settings');
});

adminRouter.post('/branding/logo',raw({type:'image/png',limit:'2mb'}),async(req,res)=>{
  const logo=validateLogo(req.body);
  await transaction(async connection=>{
    await query('INSERT INTO ot_branding(id,mime,image,digest) VALUES(1,?,?,?) ON DUPLICATE KEY UPDATE mime=VALUES(mime),image=VALUES(image),digest=VALUES(digest)',[logo.mime,logo.image,logo.digest],connection);
    await audit(req.user.username,'LOGO_UPDATED',logo.width+'x'+logo.height,connection);
  });
  res.json({logoUrl:'/branding/logo?v='+logo.digest});
});
adminRouter.delete('/branding/logo',async(req,res)=>{
  await transaction(async connection=>{await query('DELETE FROM ot_branding WHERE id=1',[],connection);await audit(req.user.username,'LOGO_REMOVED','',connection);});
  res.json({removed:true});
});
