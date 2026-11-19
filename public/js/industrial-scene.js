import {industrialMap} from './industrial-content.js';
export function industrialTelemetry(type,s){
 switch(type){
 case 'dcs':return [['SETPOINT',s.sp+'%'],['PROCESS VALUE',s.pv+'%'],['CONTROLLER',s.primary?'A':s.backup?'B':'OFF'],['MODE',s.auto?'AUTO':'MANUAL']];
 case 'cnc':return [['GUARD',s.guard?'CLOSED':'OPEN'],['HOME / PROGRAM',(s.homed?'READY':'HOME FIRST')+' / '+(s.program?'LOADED':'EMPTY')],['CYCLE',s.position+' / 3'],['STATE',s.estop?'E-STOP':s.running?'RUNNING':s.completed?'COMPLETE':'STOPPED']];
 case 'hmi-alarms':return [['TEMPERATURE',s.temp+' °C'],['ALARM',s.alarm?'ACTIVE':'NORMAL'],['ACK',s.ack?'ACKNOWLEDGED':'WAITING'],['CAUSE',s.temp>=70?'HIGH TEMP':'NORMAL']];
 case 'scada-trends':return [['FIELD',s.local+'%'],['SCADA',s.remote+'%'],['QUALITY',s.quality],['SAMPLES',s.samples.length]];
 case 'engineering':return [['WORKSTATION',s.online?'CONNECTED':'OFFLINE'],['CONFIG','REV '+s.revision],['BACKUP',s.backup?'SAVED':'REQUIRED'],['HISTORIAN',s.history.length+' / 3']];
 case 'sensor-calibration':return [['REFERENCE',s.reference+'%'],['SIGNAL',s.raw+' mA'],['OUTPUT',s.measured?s.pct+'%':'NOT TESTED'],['CALIBRATION',s.calibrated?'READY':(s.low?'LOW ✓':'LOW —')+' / '+(s.high?'HIGH ✓':'HIGH —')]];
 case 'actuator':return [['COMMAND',s.command+'%'],['FEEDBACK',s.position+'%'],['AIR',s.air?'ON':'OFF'],['STATE',s.blocked?'JAMMED':s.position===s.command?'IN POSITION':'MOVING']];
 case 'generator':return [['STATE',s.running?'RUNNING':'STOPPED'],['BREAKER',s.breaker?'CLOSED':'OPEN'],['LOAD',s.load+'%'],['SUPPLY',s.running?'400 V · 50 Hz':'0 V · 0 Hz']];
 case 'conveyor-safety':return [['GUARD',s.guard?'CLOSED':'OPEN'],['STATE',s.emergency?'E-STOP':s.moving?'RUNNING':'STOPPED'],['POSITION',s.position+' / 4'],['INTERLOCK',s.tripSeen&&!s.reset?'RESET REQUIRED':'READY']];
 case 'turbine':return [['SPEED',s.speed+' rpm'],['STEAM VALVE',s.valve+'%'],['LUBE',s.lube?'READY':'OFF'],['TRIP',s.trip?'OVERSPEED':'NORMAL']];
 case 'gateway':return [['PROTOCOL',s.protocol],['EDGE',s.edge===null?'NO DATA':s.edge+'%'],['CLOUD',s.cloud===null?'NO DATA':s.cloud+'%'],['WAN / BUFFER',(s.uplink?'ONLINE':'OFFLINE')+' / '+s.buffer.length]];
 case 'industrial-network':return [['SEGMENTATION',s.segmented?'VLAN SEPARATED':'FLAT NETWORK'],['POLICY',s.policy],['SCADA → PLC',s.tested?'ALLOW':'NOT TESTED'],['IT → PLC',s.tested?(s.blocked?'DENY':'ALLOW'):'NOT TESTED']];
 }
}
export function drawIndustrial({ctx,type,run,atlas,phase,text,panel,button,hit}){
 const lab=industrialMap[type],s=run.state,index=lab.art,cw=atlas.width/4,ch=atlas.height/3;
 ctx.save();ctx.fillStyle='#0616249c';ctx.fillRect(0,112,1672,829);const g=ctx.createRadialGradient(390,510,40,390,510,500);g.addColorStop(0,'#1d53623a');g.addColorStop(1,'#061725d9');ctx.fillStyle=g;ctx.fillRect(0,112,805,829);ctx.fillStyle='#0006';ctx.beginPath();ctx.ellipse(400,815,290,32,0,0,Math.PI*2);ctx.fill();
 ctx.shadowColor='#0007';ctx.shadowBlur=24;ctx.drawImage(atlas,(index%4)*cw,Math.floor(index/4)*ch,cw,ch,45,190,710,660);ctx.restore();
 const main={dcs:'primary',cnc:'guard','hmi-alarms':'ack','scada-trends':'poll',engineering:'connect','sensor-calibration':'capture',actuator:'step',generator:'start','conveyor-safety':'start',turbine:'step',gateway:'read','industrial-network':'test'}[type];
 hit('equipment',85,240,630,510,'คลิกอุปกรณ์: '+lab.controls.find(c=>c.action.kind===main).label,{kind:main});
 const active=s.running||s.moving||(type==='turbine'&&s.speed>0)||(type==='actuator'&&s.air&&!s.blocked&&s.position!==s.command)||(type==='dcs'&&s.auto&&(s.primary||s.backup));
 if(active){ctx.save();ctx.strokeStyle='#68eef5aa';ctx.lineWidth=4;ctx.translate(400,770);ctx.rotate(phase*2);for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.arc(0,0,32,.1,1);ctx.stroke();}ctx.restore();}
 panel(29,849,745,62,'#477689','#0e2c3f');text('คลิกอุปกรณ์หรือใช้ปุ่มควบคุมด้านขวา',401,890,24,'#b5d4e0');
 panel(810,137,836,780,'#416b80');text(lab.title,840,188,29,'#eff9ff','left');
 const values=industrialTelemetry(type,s);values.forEach(([label,value],i)=>{const x=838+(i%2)*393,y=218+Math.floor(i/2)*113;panel(x,y,370,100,'#365f76','#102b40');text(label,x+18,y+30,17,'#9dbacb','left');const alarm=/ALARM|OVERSPEED|JAMMED|STALE|E-STOP/.test(value);text(value,x+18,y+73,String(value).length>20?22:29,alarm?'#ff8a8e':'#68e9ef','left');});
 const next=run.result.checks.find(c=>!c.done);text(next?'เป้าหมาย: '+next.label:'ทำ LAB สำเร็จแล้ว',840,479,23,'#afd4dd','left');
 lab.controls.forEach((control,i)=>{const x=840+(i%2)*391,y=516+Math.floor(i/2)*92;button('industrial-'+control.id,x,y,366,72,control.label,control.action);});
 if(type==='scada-trends'||type==='engineering'){
  const samples=s.samples||s.history;panel(45,640,700,177,'#416b80','#0a2338f0');text(type==='engineering'?'HISTORIAN · SAMPLES':'SCADA · TREND',68,675,19,'#b0cedc','left');
  ctx.strokeStyle='#4fe3ed';ctx.lineWidth=4;ctx.beginPath();samples.forEach((v,i)=>{const x=78+i*620/Math.max(2,samples.length-1),y=791-v*.85;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();samples.forEach((v,i)=>{const x=78+i*620/Math.max(2,samples.length-1),y=791-v*.85;ctx.fillStyle='#aaffff';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();});
 }
 if(type==='industrial-network'&&s.viewed){panel(42,634,704,180,'#416b80','#0b2238');text('FIREWALL LOGS',65,676,22,'#a3e8ed','left');s.logs.forEach((line,i)=>text(line,65,728+i*43,22,line.includes('DENY')?'#ff9d9e':'#74efab','left'));}
 if(type==='conveyor-safety'){const x=125+s.position*130;ctx.fillStyle='#76edec';ctx.beginPath();ctx.roundRect(x,757,38,26,4);ctx.fill();}
}
