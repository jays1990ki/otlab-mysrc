const root = document.querySelector('#simulator');
if (root) {
  const csrf = document.querySelector('meta[name="csrf-token"]').content;
  const type = root.dataset.type;
  const target = Number(root.dataset.target);
  const canvas = document.querySelector('#plant-canvas');
  const context = canvas.getContext('2d');
  const trend = document.querySelector('#trend');
  const trendContext = trend.getContext('2d');
  const feedback = document.querySelector('#feedback');
  let run;
  let busy = false;
  let selectedDevice;
  let selectedTerminal;
  let history = [];
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
  }
  function message(text, danger = false) {
    feedback.textContent = text;
    feedback.classList.toggle('danger',danger);
  }
  async function start(reset = false) {
    lock(true);
    try {
      run = await request('/api/labs/'+root.dataset.lab+'/start',{reset});
      history = [];
      render();
      message('พร้อมฝึก เลือกอุปกรณ์หรือส่งคำสั่งจากแผงควบคุม');
    } catch(error) { message(error.message,true); }
    finally { lock(false); }
  }
  async function send(action) {
    if (busy || !run || run.status !== 'active') return;
    lock(true);
    try {
      run = await request('/api/runs/'+run.id+'/action',{version:run.version,action_id:actionId(),action});
      render();
      message(run.result.passed ? '✓ ผ่านภารกิจแล้ว บันทึกผลเรียบร้อย' : 'รับคำสั่งแล้ว ตรวจสถานะและเงื่อนไขภารกิจด้านล่าง');
    } catch(error) {
      message(error.message+' หากคำสั่งถูกส่งไปแล้ว ให้โหลดหน้าใหม่เพื่ออ่านสถานะล่าสุด',true);
    } finally { lock(false); }
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
  function box(x,y,w,h,title,sub,color='#5ee3e9') {
    context.fillStyle='#132735';
    context.strokeStyle=color;
    context.lineWidth=2;
    context.beginPath();context.roundRect(x,y,w,h,10);context.fill();context.stroke();
    context.fillStyle='#eaf3f7';context.font='bold 18px system-ui';context.textAlign='center';
    context.fillText(title,x+w/2,y+32);
    context.fillStyle=color;context.font='15px system-ui';
    context.fillText(sub,x+w/2,y+60);
  }
  function tank(x,y,level,title) {
    context.fillStyle='#192c39';context.strokeStyle='#8fb5c6';context.lineWidth=3;
    context.beginPath();context.roundRect(x,y,130,230,16);context.fill();context.stroke();
    context.save();context.beginPath();context.roundRect(x+4,y+4,122,222,12);context.clip();
    context.fillStyle='#1b9faf';context.fillRect(x+4,y+226-level*2.22,122,level*2.22);context.restore();
    context.textAlign='center';context.font='bold 24px system-ui';context.fillStyle='#fff';
    context.fillText(Math.round(level)+'%',x+65,y+122);
    context.font='16px system-ui';context.fillStyle='#b2cad7';context.fillText(title,x+65,y-16);
  }
  function wire(x1,y1,x2,y2,on) {
    context.strokeStyle=on?'#5ee3e9':'#435d6d';context.lineWidth=on?5:3;
    context.beginPath();context.moveTo(x1,y1);context.lineTo(x2,y2);context.stroke();
  }
  function drawPlant(state) {
    const w=canvas.width,h=canvas.height;
    context.clearRect(0,0,w,h);
    context.fillStyle='#091923';context.fillRect(0,0,w,h);
    context.strokeStyle='#17303b';context.lineWidth=1;
    for(let x=0;x<w;x+=40){ context.beginPath();context.moveTo(x,0);context.lineTo(x,h);context.stroke(); }
    for(let y=0;y<h;y+=40){ context.beginPath();context.moveTo(0,y);context.lineTo(w,y);context.stroke(); }
    if(type==='classify') {
      const assignments=state.assignments;
      ['ERP','PLC','SMART LIGHT','WIRELESS SENSOR'].forEach((title,i)=>box(60+(i%2)*410,55+Math.floor(i/2)*175,350,110,title,assignments[i] || 'SELECT CATEGORY',assignments[i]?'#82e3aa':'#8ba9b9'));
    } else if(type==='build') {
      const nodes={sensor:[40,70,190,85,'SENSOR','Level '+state.level+'%'],plc:[345,150,190,90,'PLC',run.pump?'OUTPUT ON':'OUTPUT OFF'],hmi:[40,280,190,85,'HMI',state.power?'POWER ON':'POWER OFF'],pump:[650,150,190,90,'PUMP',run.pump?'RUNNING':'STOPPED']};
      if(state.wires.sensor) wire(230,112,state.wires.sensor==='PLC input'?345:650,190,state.wires.sensor==='PLC input');
      if(state.wires.plc) wire(535,190,state.wires.plc==='Pump'?650:230,190,state.wires.plc==='Pump');
      if(state.wires.hmi) wire(230,322,state.wires.hmi==='PLC'?345:650,220,state.wires.hmi==='PLC');
      for(const [name,node] of Object.entries(nodes)) box(...node,name==='pump'&&run.pump?'#82e3aa':'#5ee3e9');
      context.textAlign='center';context.font='18px system-ui';context.fillStyle='#b7cbd5';context.fillText('TARGET '+target+'%  /  LEVEL '+state.level+'%',490,345);
    } else if(type==='scada') {
      tank(75,95,state.level,'STATION A / RTU');
      wire(210,210,600,210,state.connected);
      box(530,130,280,150,'SCADA / LAST RECEIVED',state.remote+'%  '+(state.remote>=target?'HIGH':'NORMAL'),state.remote>=target?'#ffc36e':'#82e3aa');
      context.font='18px system-ui';context.fillStyle=state.connected?'#82e3aa':'#ffad91';context.textAlign='center';
      context.fillText(state.connected?'COMMUNICATION ONLINE':'COMMUNICATION LOST / STALE DATA',490,340);
    } else {
      const level=type==='sensor'?state.level:type==='plc'?(state.full?100:30):45;
      tank(70,95,80,'SUPPLY TANK');
      tank(670,95,level,'PROCESS TANK');
      const on=type==='sensor'?state.valve:run.pump;
      wire(200,265,670,265,on);
      box(320,205,240,100,type==='sensor'?'INLET VALVE':'PUMP',on?'OPEN / RUNNING':'CLOSED / STOPPED',on?'#82e3aa':'#8ba9b9');
      if(type==='plc') box(310,55,260,95,'PLC / INTERLOCK',state.full?'HIGH LEVEL / STOP':state.emergency?'EMERGENCY / STOP':state.source?'SOURCE OK':'SOURCE LOW',state.full||state.emergency?'#ffc36e':'#5ee3e9');
      if(type==='hmi') box(310,55,260,95,'HMI',state.alarm?'ALARM: NO FEEDBACK':state.command&&!state.feedback?'WAITING FEEDBACK':run.pump?'RUNNING':'STOPPED',state.alarm?'#ffc36e':'#5ee3e9');
      context.textAlign='center';context.font='16px system-ui';context.fillStyle='#a8c3d2';
      context.fillText(type==='sensor'?'LEVEL SENSOR → '+state.level+'%':type==='plc'?'INPUT → LOGIC → OUTPUT':'COMMAND → FEEDBACK → STATUS',440,370);
    }
  }
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
  function render() {
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
    } else if(type==='build') {
      telemetry([['POWER',s.power?'ON':'OFF'],['LEVEL',s.level+'%'],['PUMP',run.pump?'RUN':'STOP']]);
      document.querySelector('#wire-list').replaceChildren(...Object.entries(s.wires).map(([from,to])=>{const p=document.createElement('p');p.textContent=from+' → '+to;return p;}));
    }
    const nodes=run.result.checks.map(check=>{const li=document.createElement('li');li.textContent=(check.done?'✓ ':'○ ')+check.label;li.classList.toggle('done',Boolean(check.done));return li;});
    document.querySelector('#checks').replaceChildren(...nodes);
    const level=s.level ?? (type==='plc'?(s.full?100:30):undefined);
    if(level!==undefined) history=[...history,level].slice(-30);
    drawPlant(s);drawTrend();
    document.querySelector('#tick').hidden=!['sensor','hmi','build'].includes(type);
    document.querySelector('.scene-actions').hidden=!['sensor','hmi','build'].includes(type);
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
  document.querySelector('#tick').addEventListener('click',()=>send({kind:'tick'}));
  document.querySelector('#restart').addEventListener('click',()=>{if(window.confirm('เริ่มรอบใหม่? รอบปัจจุบันจะจบลงและประวัติยังอยู่'))start(true);});
  document.querySelector('#station-level')?.addEventListener('change',event=>send({kind:'level',value:Number(event.target.value)}));
  document.querySelector('#station-level')?.addEventListener('input',event=>label('level-output',event.target.value+'%'));
  start();
}
