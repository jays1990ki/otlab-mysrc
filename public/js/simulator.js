import {updateCompletion} from './completion.js';
import { createScene } from './scene.js';
const root = document.querySelector('#simulator');
if (root) {
  const csrf = document.querySelector('meta[name="csrf-token"]').content;
  const type = root.dataset.type;
  const target = Number(root.dataset.target);
  const canvas = document.querySelector('#plant-canvas');

  const trend = document.querySelector('#trend');
  const trendContext = trend.getContext('2d');
  const feedback = document.querySelector('#feedback');
  let run;
  let busy = false;
  let selectedDevice;
  let selectedTerminal;
  let history = [];
  let playing = false;
  let autoTimer;
  let pointerHeld = false;
  let faulted = false;
  const scene = createScene({ canvas, overlay:document.querySelector('#scene-hotspots'), type, onAction:send, onMessage:message });
  root.addEventListener('pointerdown',()=>{pointerHeld=true;});
  window.addEventListener('pointerup',()=>{pointerHeld=false;});
  window.addEventListener('pointercancel',()=>{pointerHeld=false;});
  const guidedSteps = {
    classify: s => 'ลากภาพอุปกรณ์ด้านบนไปวางในกรอบ IT, OT, IoT หรือ IIoT ด้านล่าง',
    sensor: s => s.level > target ? 'ระดับเกินเป้าหมายแล้ว กดเริ่มรอบใหม่เพื่อลองอีกครั้ง' : s.level === target ? 'ถึงเป้าหมายแล้ว คลิกด้ามวาล์วเพื่อปิดน้ำ' : s.valve ? 'น้ำกำลังไหล สังเกตระดับน้ำ เมื่อถึง '+target+'% ให้คลิกวาล์วปิด' : 'คลิกด้ามวาล์วกลางภาพเพื่อเริ่มเติมน้ำ',
    plc: s => s.emergency ? 'คลิก E-STOP อีกครั้งเพื่อปล่อยปุ่มฉุกเฉิน' : !s.source ? 'คลิกถังต้นทางด้านซ้ายให้มีน้ำก่อน START' : !s.ran && s.full ? 'คลิกถังรับด้านขวาเพื่อยกเลิกสัญญาณเต็มก่อน START' : !s.ran ? 'คลิกมอเตอร์เพื่อ START สังเกตใบพัดหมุน' : 'คลิกถังรับด้านขวาเพื่อจำลองถังเต็ม แล้วดู Interlock หยุดมอเตอร์',
    hmi: s => !s.command ? 'คลิก START บนจอ HMI' : !s.alarmSeen ? 'รอ 3 ขั้นเวลาเพื่อดู Alarm เมื่อ Feedback ยังไม่มา' : !s.feedback ? 'คลิก FEEDBACK ด้านล่างซ้ายเพื่อยืนยันว่าอุปกรณ์ทำงาน' : 'คลิก ACK ALARM ด้านล่างขวาเพื่อรับทราบเหตุ',
    scada: s => !s.sent ? 'คลิกถังด้านซ้ายเพิ่มระดับถึง '+target+'% แล้วคลิกส่งข้อมูล' : !s.outageSeen ? 'คลิกตัดการสื่อสาร แล้วลองคลิกส่งข้อมูล สังเกตค่าที่ค้างบน SCADA' : !s.connected ? 'คลิกเชื่อมต่อกลับ แล้วคลิกส่งข้อมูลอีกครั้ง' : 'คลิกส่งข้อมูลเพื่อยืนยันการสื่อสารกลับมาแล้ว',
    build: s => !run.result.checks.slice(0,3).every(check=>check.done) ? 'ลากขั้ว SENSOR OUT → PLC input, PLC OUT → Pump, HMI OUT → PLC' : !s.power ? 'ตรวจสายทั้งสาม แล้วคลิกเปิดระบบด้านบน' : 'สังเกตมอเตอร์และระดับน้ำ ระบบหยุดอัตโนมัติเมื่อถึง '+target+'%',
    conveyor: s => s.parcel===null ? ((s.last ? s.last+' — ' : '')+'ลากกล่องจากชั้นด้านบนมาวางบริเวณรับกล่องบนสายพาน') : !s.moving ? 'คลิกมอเตอร์ด้านล่างเพื่อให้สายพานเดิน' : 'ดูสีของกล่อง คลิกแขนคัดแยกให้ BLUE → GOOD และ RED → REJECT'
  };
  function needsTick() {
    if (!run || run.status!=='active') return false;
    const s=run.state;
    return type==='sensor' ? s.valve && s.level<target :
      type==='hmi' ? s.command && !s.feedback && !s.alarm :
      type==='build' ? run.pump :
      type==='conveyor' ? s.moving && s.parcel!==null : false;
  }
  function schedule() {
    clearTimeout(autoTimer);
    label('auto',playing?'⏸ หยุดชั่วคราว':'▶ เล่นการจำลอง');
    if(run?.status==='active') label('guide',guidedSteps[type](run.state)+(needsTick()&&!playing?' — กด ▶ เล่นการจำลอง เพื่อเดินเวลาต่อ':''));
    if (!playing || faulted || !needsTick() || document.hidden) return;
    autoTimer=setTimeout(async()=>{
      if(pointerHeld || busy) {schedule();return;}
      await send({kind:'tick'},true);
    },1200);
  }
  document.addEventListener('visibilitychange',schedule);
  const label = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  async function request(path, body) {
    const response = await fetch(path, { method:'POST', headers:{'Content-Type':'application/json','X-CSRF-Token':csrf}, body:JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'ไม่สามารถเชื่อมต่อได้ กรุณาโหลดหน้าใหม่');
    return data;
  }
  function actionId() {
    return [...crypto.getRandomValues(new Uint8Array(32))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  function lock(value) {
    busy = value;
    for (const element of root.querySelectorAll('button,input')) element.disabled = value || (run?.status==='passed' && element.id !== 'restart');
    scene.setEnabled(!value && !faulted && run?.status==='active');
  }
  function message(text, danger = false) {
    feedback.textContent = text;
    feedback.classList.toggle('danger',danger);
  }
  async function start(reset = false) {
    clearTimeout(autoTimer);
    lock(true);
    try {
      await scene.ready;
      run = await request('/api/labs/'+root.dataset.lab+'/start',{reset});
      history = [];
      faulted=false;playing=false;
      render();
      message('พร้อมฝึก คลิกหรือลากอุปกรณ์บนภาพตามคำแนะนำด้านบน');
    } catch(error) { message(error.message,true); }
    finally { lock(false);schedule(); }
  }
  async function send(action, automatic=false) {
    if (busy || faulted || !run || run.status !== 'active') return;
    clearTimeout(autoTimer);
    lock(true);
    try {
      run = await request('/api/runs/'+run.id+'/action',{version:run.version,action_id:actionId(),action});
      if(!automatic && ['valve','start','power','motor','load'].includes(action.kind)) playing=true;
      render();
      message(run.result.passed ? '✓ ผ่านภารกิจแล้ว บันทึกผลเรียบร้อย' : (type==='conveyor' && run.state.last ? run.state.last : guidedSteps[type](run.state)));
    } catch(error) {
      faulted=true;playing=false;
      message(error.message+' หากคำสั่งถูกส่งไปแล้ว ให้โหลดหน้าใหม่เพื่ออ่านสถานะล่าสุด',true);
    } finally { lock(false);schedule(); }
  }
  const telemetry = (entries) => {
    const nodes = entries.map(([name,value])=>{
      const tile=document.createElement('div');
      const title=document.createElement('span');
      const reading=document.createElement('strong');
      title.textContent=name; reading.textContent=value;
      tile.append(title,reading);
      return tile;
    });
    document.querySelector('#telemetry').replaceChildren(...nodes);
  };
  function drawTrend() {
    trendContext.clearRect(0,0,800,130);
    trendContext.fillStyle='#091923';trendContext.fillRect(0,0,800,130);
    trendContext.fillStyle='#a8c3d2';trendContext.font='13px system-ui';trendContext.fillText('LEVEL TREND / LAST 30 ACTIONS',18,20);
    trendContext.strokeStyle='#264a5b';trendContext.beginPath();trendContext.moveTo(30,110);trendContext.lineTo(780,110);trendContext.stroke();
    if(!history.length) return;
    trendContext.strokeStyle='#5ee3e9';trendContext.lineWidth=2;trendContext.beginPath();
    history.forEach((v,i)=>{const x=30+i*750/Math.max(29,history.length-1),y=110-v*.8;if(i===0)trendContext.moveTo(x,y);else trendContext.lineTo(x,y);});
    trendContext.stroke();
  }
  function updateHistory() {
    const body=document.querySelector('#lab-history');
    let row=[...body.rows].find(item=>item.dataset.runId===run.id);
    if(!row) {
      row=document.createElement('tr');row.dataset.runId=run.id;
      for(let i=0;i<4;i++)row.append(document.createElement('td'));
      row.cells[0].textContent=run.started_at ? new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'}).format(new Date(run.started_at.replace(' ','T')+'Z')) : 'รอบปัจจุบัน';
      row.cells[1].textContent=run.revision;
      body.prepend(row);
      while(body.rows.length>5)body.lastElementChild.remove();
    }
    row.cells[2].textContent=run.status==='passed'?'ผ่าน':run.status==='active'?'กำลังฝึก':'จบรอบ';
    row.cells[3].textContent=run.result.score+'%';
  }
  function render() {
    updateCompletion(run);
    const s=run.state;
    label('run-status',run.status==='passed'?'MISSION COMPLETE':'CONNECTED • '+run.actions+' ACTIONS');
    label('valve-control',s.valve?'ปิดวาล์ว':'เปิดวาล์ว');
    label('source-state',s.source?'มีน้ำ':'ระดับต่ำ');
    label('full-state',s.full?'ON':'OFF');
    label('emergency-state',s.emergency?'ACTIVE':'RELEASED');
    label('feedback-state',s.feedback?'ON':'OFF');
    label('connection-state',s.connected?'ONLINE':'OFFLINE');
    if(type==='classify') {
      Object.entries(s.assignments).forEach(([id,category])=>label('assignment-'+id,category));
      telemetry([['CLASSIFIED',Object.keys(s.assignments).length+' / 4'],['SCORE',run.result.score+'%']]);
    } else if(type==='sensor') telemetry([['LEVEL',s.level+'%'],['VALVE',s.valve?'OPEN':'CLOSED'],['TARGET',target+'%']]);
    else if(type==='plc') telemetry([['DI 0 / SOURCE',s.source?'1':'0'],['DI 1 / FULL',s.full?'1':'0'],['DO 0 / PUMP',run.pump?'1 / RUN':'0 / STOP']]);
    else if(type==='hmi') telemetry([['COMMAND',s.command?'START':'STOP'],['FEEDBACK',s.feedback?'ON':'OFF'],['ALARM',s.alarm?'ACTIVE':'CLEAR']]);
    else if(type==='scada') {
      const slider=document.querySelector('#station-level');slider.value=s.level;label('level-output',s.level+'%');
      telemetry([['RTU LEVEL',s.level+'%'],['SCADA LEVEL',s.remote+'%'],['QUALITY',s.connected?'ONLINE':'STALE']]);
    } else if(type==='conveyor') {
      telemetry([['คัดถูก',run.state.sorted.length+' / 3'],['MOTOR',s.moving?'RUN':'STOP'],['GATE',s.gate.toUpperCase()]]);
    } else if(type==='build') {
      telemetry([['POWER',s.power?'ON':'OFF'],['LEVEL',s.level+'%'],['PUMP',run.pump?'RUN':'STOP']]);
      document.querySelector('#wire-list').replaceChildren(...Object.entries(s.wires).map(([from,to])=>{const p=document.createElement('p');p.textContent=from+' → '+to;return p;}));
    }
    const nodes=run.result.checks.map(check=>{const li=document.createElement('li');li.textContent=(check.done?'✓ ':'○ ')+check.label;li.classList.toggle('done',Boolean(check.done));return li;});
    document.querySelector('#checks').replaceChildren(...nodes);
    const level=s.level ?? (type==='plc'?(s.full?100:30):undefined);
    if(level!==undefined) history=[...history,level].slice(-30);
    updateHistory();scene.update(run);drawTrend();
    label('guide',run.status==='passed'?'✓ ผ่านภารกิจแล้ว! ลองแล็บถัดไปหรือเริ่มรอบใหม่':guidedSteps[type](s));
    document.querySelector('#tick').hidden=!['sensor','hmi','build','conveyor'].includes(type);
    document.querySelector('.scene-actions').hidden=run.status==='passed' || !['sensor','hmi','build','conveyor'].includes(type);
    document.querySelector('.chart-wrap').hidden=!['sensor','scada','build'].includes(type);
  }
  root.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button || busy) return;
    if(button.dataset.action) send({kind:button.dataset.action});
    if(button.dataset.device!==undefined){
      selectedDevice=Number(button.dataset.device);
      root.querySelectorAll('[data-device]').forEach(el=>el.classList.toggle('selected',el===button));
      message('เลือกหมวดหมู่สำหรับอุปกรณ์ที่เลือก');
    }
    if(button.dataset.category){
      if(selectedDevice===undefined) return message('เลือกอุปกรณ์ก่อน',true);
      send({kind:'assign',device:selectedDevice,category:button.dataset.category});
    }
    if(button.dataset.from){
      selectedTerminal=button.dataset.from;
      root.querySelectorAll('[data-from]').forEach(el=>el.classList.toggle('selected',el===button));
      message('เลือกขั้วรับเพื่อเชื่อมสาย');
    }
    if(button.dataset.to){
      if(!selectedTerminal) return message('เลือกขั้วส่งก่อน',true);
      send({kind:'wire',from:selectedTerminal,to:button.dataset.to});
    }
  });
  document.querySelector('#auto').addEventListener('click',()=>{playing=!playing;schedule();});
  document.querySelector('#tick').addEventListener('click',()=>send({kind:'tick'}));
  document.querySelector('#restart').addEventListener('click',()=>{if(window.confirm('เริ่มรอบใหม่? รอบปัจจุบันจะจบลงและประวัติยังอยู่'))start(true);});
  document.querySelector('#station-level')?.addEventListener('change',event=>send({kind:'level',value:Number(event.target.value)}));
  document.querySelector('#station-level')?.addEventListener('input',event=>label('level-output',event.target.value+'%'));
  start();
}
