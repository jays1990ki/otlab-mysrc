import {updateCompletion} from './completion.js';
import {industrialMap} from './industrial-content.js';
import { createReferenceScene } from './reference-scenes.js';

const app=document.querySelector('#reference-app');
const type=app.dataset.type;
const feedback=document.querySelector('#reference-feedback');
const guide=document.querySelector('#reference-guide');
const settings=document.querySelector('#reference-settings');
const csrf=document.querySelector('meta[name="csrf-token"]').content;
const links=[...document.querySelectorAll('#reference-navigation a')];
let run,busy=false,faulted=false,playing=true,timer;
const scene=createReferenceScene({canvas:document.querySelector('#reference-canvas'),overlay:document.querySelector('#reference-hotspots'),type,onAction:send,onUi:ui,onMessage:message});
const instructions={
  classify:s=>'ลาก Accounting → IT, Pump Control → OT, Smart Home → IoT และ Vibration Monitoring → IIoT การ์ดถัดไปปรากฏเมื่อมีที่ว่าง',
  sensor:s=>s.level>run.target?'ระดับเกินเป้าหมาย กดเริ่มใหม่ หรือเลื่อนระดับแล้วทดลองเติมอีกครั้ง':s.level===run.target?'คลิก Close Valve เพื่อปิดวาล์วและจบภารกิจ':'คลิก Open Valve แล้วสังเกตน้ำ กดปิดเมื่อถึง '+run.target+'%',
  plc:s=>!(s.inputWired ?? s.ran)?'ลาก Level Sensor บนถังไปขั้ว I0.0 ในจอ PLC':!s.ran?'คลิก Run Logic เมื่อถังต้นทางมีน้ำและถังรับยังไม่เต็ม':'คลิกถังรับด้านขวาของภาพโรงงานเพื่อจำลองถังเต็ม แล้วดู Q0.0 และปั๊มหยุด',
  hmi:s=>!s.command?'คลิก Start Pump บนภาพ':!s.alarmSeen?'รอ 3 ขั้นเวลาเพื่อดู Alarm จาก Feedback ล่าช้า':!s.feedback?'คลิกแถว Pump Feedback เพื่อจำลอง Feedback ที่กลับมา':'คลิกแถวสถานะ Pump เพื่อ ACK Alarm',
  scada:s=>!s.sent?'คลิกค่าระดับ Station A เพิ่มให้ถึง '+run.target+'% แล้วกด Send Level':!s.outageSeen?'คลิกสวิตช์ RTU A ให้ OFF แล้วลองกด Send Level':!s.connected?'คลิกสวิตช์ RTU A ให้ ON เพื่อเชื่อมต่อกลับ แล้วส่งข้อมูล':'คลิก Send Level อีกครั้งเพื่อยืนยันข้อมูลหลังเชื่อมต่อกลับ',
  'bench-power':s=>'เลือก 24 VDC คลิกหน้าปัดมิเตอร์ให้เป็น DC ลากโพรบแดง → PLC +24V และดำ → 0V แล้วคลิก CHECK',
  'bench-usb':s=>s.message || 'เลือก USB Cable หรือ Adapter ลากหัวสายจาก Laptop ไปพอร์ตที่ตรงกัน แล้วกด Connect',
  'bench-float':s=>'ลาก +24V / 0V ของ Sensor ไปขั้ว Power Supply แล้วลาก SIG → DI 0 กด Test Float เพื่อให้ HIGH และ DI 0 ON',
  'bench-output':s=>'คลิก Test Output แล้วตรวจว่า PLC Output, Relay และ Motor ทำงานพร้อมกัน'
};
function message(text,error=false){feedback.textContent=text;feedback.classList.toggle('error',error);}
function lock(value) {
  busy=value;
  scene.setAvailability(Boolean(run?.status==='active'&&!faulted),value);
  document.querySelector('#restart').disabled=value;
}
async function request(path,body) {
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)});
  let data;
  try{data=await response.json();}catch{throw new Error('เซิร์ฟเวอร์ตอบกลับไม่สำเร็จ กรุณาโหลดหน้าใหม่');}
  if(!response.ok)throw new Error(data.error || 'ทำรายการไม่สำเร็จ');
  return data;
}
function instruction(){return industrialMap[type]?(run.state.notice||run.result.checks.find(c=>!c.done)?.label||'ทำ LAB สำเร็จแล้ว'):instructions[type](run.state);}
function render() {
  updateCompletion(run);
  scene.update(run);
  app.dataset.status=run.status;
  document.querySelector('#reference-score').textContent=run.result.score+'%';
  document.querySelector('#reference-checks').replaceChildren(...run.result.checks.map(check=>{
    const li=document.createElement('li');li.textContent=(check.done?'✓ ':'○ ')+check.label;li.classList.toggle('done',Boolean(check.done));return li;
  }));
  document.querySelector('#step-guide').textContent=instruction();
  if(run.status==='passed')message('✓ ผ่านภารกิจและบันทึกผลแล้ว • กด LAB ต่อไป หรือกลับหน้าหลัก');
  else message(instruction());
}
function needsTick() {
  if(!run || run.status!=='active')return false;
  const s=run.state;
  return type==='sensor'?s.valve&&s.level<run.target:type==='hmi'?s.command&&!s.feedback&&!s.alarm:false;
}
function schedule() {
  clearTimeout(timer);
  document.querySelector('#play').textContent=playing?'⏸ เวลาอัตโนมัติ':'▶ เล่นเวลา';
  if(!playing||faulted||!needsTick()||document.hidden||guide.open||settings.open)return;
  timer=setTimeout(async()=>{
    if(busy||scene.isDragging()){schedule();return;}
    await send({kind:'tick'});
  },1200);
}
async function start(reset=false) {
  clearTimeout(timer);lock(true);faulted=false;
  try {
    await scene.ready;
    run=await request('/api/labs/'+app.dataset.lab+'/start',{reset});
    render();
  }catch(error){faulted=true;message(error.message,true);}
  finally{lock(false);schedule();}
}
function actionId(){return [...crypto.getRandomValues(new Uint8Array(32))].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
async function send(action) {
  if(busy||faulted||!run||run.status!=='active')return;
  clearTimeout(timer);lock(true);
  try {
    run=await request('/api/runs/'+run.id+'/action',{version:run.version,action_id:actionId(),action});
    render();
  }catch(error){faulted=true;message(error.message+' • โหลดหน้าใหม่เพื่ออ่านสถานะล่าสุด',true);}
  finally{lock(false);schedule();}
}
function navigate(simulator) {
  const link=links.find(item=>item.dataset.simulator===simulator);
  if(link)location.assign(link.href);
  else message('ยังไม่มีแล็บนี้ที่เผยแพร่');
}
async function toggleFullscreen() {
  try{if(document.fullscreenElement)await document.exitFullscreen();else await app.requestFullscreen();}catch{message('เบราว์เซอร์นี้ไม่รองรับโหมดเต็มจอ',true);}
}
function ui(action) {
  if(action==='fullscreen')toggleFullscreen();
  else if(action.startsWith('bench-stage-'))navigate(['bench-power','bench-usb','bench-float','bench-output'][Number(action.slice(12))]);
  else if(action==='settings'){settings.showModal();clearTimeout(timer);}
  else if(action==='labs')location.assign('/labs');
  else if(action==='help'){guide.showModal();clearTimeout(timer);}
  else if(action==='reset')start(true);
  else if(action==='check'){
    if(run?.result.passed)message('✓ ผ่านแล้วและบันทึกผลเรียบร้อย');
    else {guide.showModal();clearTimeout(timer);}
  }else if(action==='next'||action==='back'){
    if(action==='next'&&run?.status!=='passed')return message('ทำภารกิจนี้ให้ผ่านก่อนกด Next');
    if(action==='next'){location.assign(document.querySelector('#completion-next').href);return;}
    const index=links.findIndex(item=>item.href.endsWith('/lab/'+app.dataset.lab));
    if(index>0)location.assign(links[index-1].href);else location.assign('/labs');
  }else if(action.startsWith('stage-'))navigate(['classify','sensor','plc','hmi','scada','build'][Number(action.slice(6))]);
}
document.querySelector('#help').addEventListener('click',()=>ui('help'));
document.querySelector('#restart').addEventListener('click',()=>start(true));
document.querySelector('#play').addEventListener('click',()=>{playing=!playing;document.querySelector('#auto-time').checked=playing;schedule();});
document.querySelector('#play').hidden=!['sensor','hmi'].includes(type);
document.querySelector('#fullscreen').addEventListener('click',toggleFullscreen);
guide.addEventListener('close',schedule);
settings.addEventListener('close',schedule);
document.querySelector('#auto-time').addEventListener('change',event=>{playing=event.target.checked;schedule();});
const reduced=document.querySelector('#reduce-motion');
reduced.checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
reduced.addEventListener('change',()=>scene.setMotion(!reduced.checked));
document.addEventListener('visibilitychange',schedule);
window.addEventListener('pagehide',()=>{clearTimeout(timer);scene.destroy();});
start();
