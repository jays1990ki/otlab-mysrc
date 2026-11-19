import {industrialLabs,industrialMap} from '../../public/js/industrial-content.js';
import {httpError} from './security.js';
export const industrialTemplates=industrialLabs;
export const industrialTypes=new Set(industrialLabs.map(l=>l.key));
export function industrialInitial(type){
 const states={
 dcs:{auto:false,sp:40,pv:20,primary:true,backup:false,stable:false,failedOver:false},
 cnc:{guard:false,homed:false,program:false,running:false,position:0,completed:false,estop:false,tripSeen:false},
 'hmi-alarms':{temp:40,alarm:false,seen:false,ack:false,reset:false},
 'scada-trends':{connected:true,local:20,remote:20,samples:[],quality:'GOOD',outageSeen:false,recovered:false,historyRead:false},
 engineering:{online:false,backup:false,config:false,deployed:false,recorded:false,restored:false,revision:1,history:[]},
 'sensor-calibration':{reference:0,raw:4,low:false,high:false,calibrated:false,measured:false,pct:0},
 actuator:{command:0,position:0,air:false,blocked:false,openSeen:false,faultSeen:false,recovered:false},
 generator:{fuel:true,battery:true,running:false,breaker:false,load:0,started:false,loaded:false,unloaded:false,stopped:false},
 'conveyor-safety':{guard:false,emergency:false,moving:false,position:0,tripSeen:false,reset:false,finished:false},
 turbine:{lube:false,valve:0,speed:0,operated:false,trip:false,tripSeen:false,reset:false},
 gateway:{protocol:'OPC UA',mapped:false,uplink:true,local:20,edge:null,cloud:null,sent:false,buffer:[],offlineSeen:false,replayed:false},
 'industrial-network':{segmented:false,policy:'ALLOW ALL',tested:false,allowed:false,blocked:false,logs:[],viewed:false}
 };if(!states[type])throw httpError(400,'ไม่พบแบบจำลอง');return structuredClone(states[type]);
}
export function industrialAction(type,previous,a){
 const allowed=industrialMap[type]?.controls.some(c=>c.action.kind===a.kind&&c.action.value===a.value);
 if(!allowed)throw httpError(400,'คำสั่งไม่ตรงกับอุปกรณ์');
 const s=structuredClone(previous);s.notice='';const toggle=k=>s[k]=!s[k],warn=m=>s.notice=m;
 switch(type){
 case 'dcs':
  if(a.kind==='auto')toggle('auto');if(a.kind==='backup')toggle('backup');if(a.kind==='setpoint')s.sp=a.value;
  if(a.kind==='primary'){toggle('primary');if(!s.primary&&s.backup&&s.auto)s.failedOver=true;}
  if(a.kind==='scan'){if(s.auto&&(s.primary||s.backup)){s.pv+=Math.sign(s.sp-s.pv)*Math.min(10,Math.abs(s.sp-s.pv));if(s.pv===60&&s.sp===60)s.stable=true;}else warn('เปิด AUTO และต้องมี Controller พร้อมทำงาน');}break;
 case 'cnc':
  if(a.kind==='guard'){toggle('guard');if(!s.guard)s.running=false;}
  if(a.kind==='home'){if(s.guard&&!s.estop)s.homed=true;else warn('ปิด Guard และปลด E-Stop ก่อน HOME');}
  if(a.kind==='program'){if(s.homed)s.program=true;else warn('HOME ก่อนโหลดโปรแกรม');}
  if(a.kind==='start'){if(s.guard&&s.homed&&s.program&&!s.estop)s.running=true;else warn('ต้องปิด Guard, HOME, Load Program และปลด E-Stop');}
  if(a.kind==='estop'){toggle('estop');if(s.estop){if(s.running)s.tripSeen=true;s.running=false;s.homed=false;}}
  if(a.kind==='step'&&s.running&&s.guard&&!s.estop){s.position=Math.min(3,s.position+1);if(s.position===3){s.completed=true;s.running=false;}}break;
 case 'hmi-alarms':
  if(a.kind==='heat'){s.temp=85;s.alarm=true;s.seen=true;s.ack=false;s.reset=false;}
  if(a.kind==='ack'&&s.alarm)s.ack=true;if(a.kind==='cool')s.temp=40;
  if(a.kind==='reset'){if(s.temp<70&&s.ack){s.alarm=false;s.reset=true;}else warn('ลดอุณหภูมิและ ACK ก่อน RESET');}break;
 case 'scada-trends':
  if(a.kind==='level')s.local=s.local>=100?0:s.local+20;if(a.kind==='link')toggle('connected');
  if(a.kind==='poll'){if(s.connected){if(s.quality==='STALE')s.recovered=true;s.remote=s.local;s.samples=[...s.samples,s.remote].slice(-12);s.quality='GOOD';}else{s.quality='STALE';s.outageSeen=true;}}
  if(a.kind==='history'){if(s.samples.length>=3)s.historyRead=true;else warn('POLL อย่างน้อย 3 ตัวอย่างก่อนเปิดประวัติ');}break;
 case 'engineering':
  if(a.kind==='connect')s.online=true;
  if(a.kind==='backup'){if(s.online)s.backup=true;else warn('Connect ก่อน Backup');}
  if(a.kind==='edit'){if(s.online)s.config=true;else warn('Connect ก่อนแก้ configuration');}
  if(a.kind==='download'){if(s.online&&s.backup&&s.config){s.deployed=true;s.revision=2;}else warn('Connect, Backup และ Edit ก่อน Download');}
  if(a.kind==='record'){if(s.deployed&&!s.restored){s.history=[...s.history,30+s.history.length*10].slice(0,3);s.recorded=s.history.length===3;}else warn('Download configuration ก่อนเก็บตัวอย่าง');}
  if(a.kind==='restore'){if(s.backup&&s.recorded){s.restored=true;s.revision=1;}else warn('Backup และเก็บ Historian ครบ 3 ตัวอย่างก่อน Restore');}break;
 case 'sensor-calibration':
  if(a.kind==='reference'){s.reference=s.reference===0?100:0;s.raw=s.reference===0?4:20;}
  if(a.kind==='capture'){s[s.reference===0?'low':'high']=true;}
  if(a.kind==='calibrate'){if(s.low&&s.high)s.calibrated=true;else warn('Capture Reference 0% และ 100% ให้ครบ');}
  if(a.kind==='test'){if(s.calibrated){s.raw=12;s.pct=50;s.measured=true;}else warn('Calibrate ให้เรียบร้อยก่อนทดสอบ');}break;
 case 'actuator':
  if(a.kind==='air')toggle('air');if(a.kind==='command')s.command=a.value;if(a.kind==='jam')toggle('blocked');
  if(a.kind==='step'){if(s.blocked&&s.command!==s.position){s.faultSeen=true;warn('Command กับ Feedback ไม่ตรงกัน วาล์วติด');}else if(s.air){s.position+=Math.sign(s.command-s.position)*Math.min(25,Math.abs(s.command-s.position));if(s.position===100)s.openSeen=true;if(s.faultSeen&&s.position===50&&s.command===50)s.recovered=true;}else warn('เปิด Air Supply ก่อนขยับ Actuator');}break;
 case 'generator':
  if(a.kind==='fuel'&&!s.running)toggle('fuel');if(a.kind==='battery'&&!s.running)toggle('battery');
  if(a.kind==='start'){if(s.fuel&&s.battery&&!s.breaker){s.running=true;s.started=true;}else warn('ตรวจ Fuel, Battery และ Breaker OPEN ก่อน START');}
  if(a.kind==='breaker'){if(s.breaker){if(s.load===0)s.breaker=false;else warn('Unload ก่อนเปิด Breaker');}else if(s.running)s.breaker=true;else warn('START Generator ก่อนปิด Breaker');}
  if(a.kind==='load'){if(s.running&&s.breaker){s.load=Math.min(100,s.load+25);if(s.load>=50)s.loaded=true;}else warn('ต้องเดินเครื่องและปิด Breaker ก่อนเพิ่มโหลด');}
  if(a.kind==='unload'){s.load=0;if(s.loaded)s.unloaded=true;}
  if(a.kind==='stop'){if(!s.breaker&&s.load===0){s.running=false;if(s.started&&s.loaded&&s.unloaded)s.stopped=true;}else warn('Unload และเปิด Breaker ก่อน STOP');}break;
 case 'conveyor-safety':
  if(a.kind==='guard'){toggle('guard');if(!s.guard&&s.moving){s.moving=false;s.tripSeen=true;s.reset=false;}}
  if(a.kind==='emergency'){toggle('emergency');if(s.emergency){if(s.moving)s.tripSeen=true;s.moving=false;s.reset=false;}}
  if(a.kind==='reset'){if(s.guard&&!s.emergency)s.reset=true;else warn('ปิด Guard และปลด E-Stop ก่อน RESET');}
  if(a.kind==='start'){if(s.guard&&!s.emergency&&(!s.tripSeen||s.reset))s.moving=true;else warn('ตรวจ Guard, E-Stop และ RESET ก่อน START');}
  if(a.kind==='step'&&s.moving&&s.guard&&!s.emergency){s.position=Math.min(4,s.position+1);if(s.position===4){s.finished=true;s.moving=false;}}break;
 case 'turbine':
  if(a.kind==='lube'){toggle('lube');if(!s.lube){s.speed=0;s.valve=0;}}
  if(a.kind==='steam'){if(s.lube&&!s.trip)s.valve=a.value;else warn('เปิด Lube และตรวจ Trip ก่อนเปิด Steam');}
  if(a.kind==='step'&&s.lube&&!s.trip){const target=s.valve*40;s.speed+=Math.sign(target-s.speed)*Math.min(1000,Math.abs(target-s.speed));if(s.speed>=2000&&s.speed<=3000)s.operated=true;if(s.speed>3300){s.trip=true;s.tripSeen=true;s.speed=0;s.valve=0;}}
  if(a.kind==='reset'){if(s.trip&&s.lube&&s.speed===0&&s.valve===0){s.trip=false;s.reset=true;}else warn('RESET ได้เมื่อ Trip, Speed 0, Valve 0 และ Lube พร้อม');}break;
 case 'gateway':
  if(a.kind==='protocol'){s.protocol=s.protocol==='MODBUS'?'OPC UA':'MODBUS';s.mapped=false;}
  if(a.kind==='map'){if(s.protocol==='MODBUS')s.mapped=true;else warn('เลือก MODBUS สำหรับ Register ตัวอย่าง 40001');}
  if(a.kind==='read'){if(s.mapped)s.edge=s.local;else warn('Map Tag ก่อนอ่านข้อมูล');}
  if(a.kind==='uplink')toggle('uplink');if(a.kind==='sensor')s.local=s.local>=100?0:s.local+10;
  if(a.kind==='publish'){if(s.edge===null)warn('Read Field Data ก่อน Publish');else if(s.uplink){s.cloud=s.edge;s.sent=true;if(s.buffer.length){s.replayed=true;s.buffer=[];}}else{s.buffer=[...s.buffer,s.edge].slice(-10);s.offlineSeen=true;}}break;
 case 'industrial-network':
  if(a.kind==='segment')s.segmented=true;if(a.kind==='policy')s.policy=s.policy==='ALLOW ALL'?'TELEMETRY ONLY':'ALLOW ALL';
  if(['segment','policy'].includes(a.kind)){s.tested=false;s.viewed=false;}
  if(a.kind==='test'){s.tested=true;s.allowed=true;s.blocked=s.segmented&&s.policy==='TELEMETRY ONLY';s.logs=['SCADA → PLC TCP/502 ALLOW','IT Laptop → PLC TCP/502 '+(s.blocked?'DENY':'ALLOW')];s.viewed=false;}
  if(a.kind==='logs'){if(s.tested)s.viewed=true;else warn('Test Traffic ก่อนดู Logs');}break;
 }
 return s;
}
export function industrialEvaluate(type,s){
 const entries={
 dcs:()=>[['เปิด Backup B',s.backup],['ควบคุม PV ถึง SP 60',s.stable&&s.pv===60&&s.sp===60],['Controller B รับงานเมื่อ A หยุด',s.failedOver&&!s.primary&&s.backup&&s.auto]],
 cnc:()=>[['ทดสอบ E-Stop ขณะเดินงาน',s.tripSeen],['จบงานจำลองครบ 3 ขั้น',s.completed&&!s.estop&&s.guard]],
 'hmi-alarms':()=>[['ตรวจพบ Alarm',s.seen],['รับทราบและแก้สาเหตุ',s.ack&&s.temp<70],['RESET แล้ว Alarm หาย',s.reset&&!s.alarm]],
 'scada-trends':()=>[['เก็บ Trend อย่างน้อย 3 ตัวอย่าง',s.samples.length>=3],['ตรวจพบ STALE และกู้การสื่อสาร',s.outageSeen&&s.recovered&&s.connected&&s.quality==='GOOD'],['เปิด Trend History',s.historyRead]],
 engineering:()=>[['สำรองก่อน Download',s.backup&&s.deployed],['Historian บันทึกครบ 3 ตัวอย่าง',s.recorded],['Restore กลับ revision 1',s.restored&&s.revision===1]],
 'sensor-calibration':()=>[['Capture จุดต่ำและสูง',s.low&&s.high],['Calibrate แล้ว',s.calibrated],['ทดสอบ 12 mA ได้ 50%',s.measured&&s.raw===12&&s.pct===50]],
 actuator:()=>[['วาล์วเคยเปิดเต็ม',s.openSeen],['ตรวจพบวาล์วติด',s.faultSeen],['แก้ไขแล้ว Position ตรง Command 50%',s.recovered&&!s.blocked&&s.air&&s.position===50&&s.command===50]],
 generator:()=>[['เครื่องเคยเดิน',s.started],['โหลดถึง 50% และปลดโหลด',s.loaded&&s.unloaded],['เปิด Breaker และหยุดเครื่อง',s.stopped&&!s.running&&!s.breaker&&s.load===0]],
 'conveyor-safety':()=>[['ทดสอบ Guard หยุดสายพาน',s.tripSeen],['RESET ก่อนเริ่มใหม่',s.reset],['ส่งกล่องถึงปลายสายพาน',s.finished&&s.guard&&!s.emergency]],
 turbine:()=>[['เคยเดินที่ 2000–3000 rpm',s.operated],['ทดสอบ Overspeed Trip',s.tripSeen],['RESET หลังหยุด',s.reset&&!s.trip&&s.speed===0&&s.valve===0]],
 gateway:()=>[['Map และส่งค่าขึ้น Cloud',s.mapped&&s.sent],['เก็บ Buffer ขณะ WAN ขาด',s.offlineSeen],['Replay หลัง WAN กลับมา',s.replayed&&s.uplink&&s.buffer.length===0&&s.cloud===s.edge]],
 'industrial-network':()=>[['แบ่งเครือข่ายและกำหนดนโยบาย',s.segmented&&s.policy==='TELEMETRY ONLY'],['อนุญาต SCADA และปฏิเสธ IT ไป PLC',s.tested&&s.allowed&&s.blocked],['ตรวจ Logs',s.viewed]]
 }[type]();
 const checks=entries.map(([label,done])=>({label,done:Boolean(done)}));return {checks,passed:checks.every(c=>c.done),score:Math.round(checks.filter(c=>c.done).length/checks.length*100)};
}
