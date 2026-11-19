import { httpError } from './security.js';

export const benchTemplates = [
  {key:'bench-power',name:'Bench • DC Power',title:'Bench Wiring 1 • DC Power & Multimeter',summary:'เลือกแรงดัน ต่อโพรบ และวัดไฟเลี้ยง PLC',lesson:'แบบจำลองนี้กำหนด PLC ใช้ไฟ 24 VDC เลือกย่านวัด DC ต่อโพรบแดงที่ +24V และดำที่ 0V จากนั้นกด CHECK ค่าแรงดันและขั้วของโพรบมีผลต่อค่าที่อ่านได้',mission:'เลือก 24 VDC คลิกย่าน DC บนมิเตอร์ ลากโพรบแดงและดำเข้าขั้ว PLC แล้วกด CHECK',image:3,target:0},
  {key:'bench-usb',name:'Bench • USB / Serial',title:'Bench Wiring 2 • USB / Serial',summary:'เลือกสายและเชื่อมต่อ Engineering Laptop กับ PLC จำลอง',lesson:'เลือก USB Cable สำหรับพอร์ต USB หรือ USB-to-RS-485 Adapter สำหรับพอร์ต RS-485 ในแบบจำลอง ลากหัวสายไปยังพอร์ตที่ตรงกันแล้วกด Connect เพื่อทดสอบสถานะ การเชื่อมต่อนี้เป็นการจำลองในเว็บ',mission:'เลือกสาย ลากหัวสายจาก Laptop ไปพอร์ตที่ถูกต้อง แล้วกด Connect USB หรือ Connect RS-485',image:3,target:0},
  {key:'bench-float',name:'Bench • Control Wiring',title:'Bench Wiring 3 • Float Sensor & DI 0',summary:'ต่อไฟและสัญญาณลูกลอยเข้าขั้ว PLC แล้วทดสอบ DI',lesson:'ลูกลอยจำลองมีขั้ว +24V, SIG และ 0V ต่อไฟจาก Power Supply ให้ครบ แล้วต่อ SIG เข้าที่ DI 0 กด Test Float เพื่อสลับ HIGH/LOW และดูช่อง DI ที่ได้รับสัญญาณ',mission:'ลาก +24V และ 0V ไป Power Supply ลาก SIG ไป DI 0 แล้วกด Test Float ให้ DI 0 เป็น ON',image:3,target:0},
  {key:'bench-output',name:'Bench • Output & Relay',title:'Bench Wiring 4 • Output, Relay & Motor',summary:'ทดสอบเส้นทาง PLC Output ผ่าน Relay ไปยังมอเตอร์',lesson:'ภาพแสดงวงจรที่ต่อสายไว้แล้ว ปุ่ม Test Output สั่ง PLC Output ON จากนั้น Relay จะทำงานและมอเตอร์จำลองเริ่มหมุน สังเกตไฟและสถานะทั้งสามจุด',mission:'กด Test Output บนภาพ แล้วตรวจว่า Output, Relay และ Motor ทำงานสัมพันธ์กัน',image:3,target:0}
];
export const benchTypes = new Set(benchTemplates.map(lab=>lab.key));
export function benchInitial(type) {
  if(type==='bench-power') return {voltage:12,mode:'off',probes:{red:null,black:null},reading:null,measured:false};
  if(type==='bench-usb') return {tool:'usb',port:null,connected:false,message:''};
  if(type==='bench-float') return {wires:{},high:false,tested:false};
  if(type==='bench-output') return {output:false,relay:false,motor:false,tested:false};
  throw httpError(400,'ไม่พบแล็บ Bench');
}
export function benchAction(type,previous,action) {
  const s=structuredClone(previous);
  if(type==='bench-power') {
    if(action.kind==='voltage' && [12,24,48].includes(action.value)){s.voltage=action.value;s.reading=null;s.measured=false;}
    else if(action.kind==='mode'){s.mode=s.mode==='dc'?'off':'dc';s.reading=null;s.measured=false;}
    else if(action.kind==='probe' && ['red','black'].includes(action.from) && ['24V','0V'].includes(action.to)){s.probes[action.from]=action.to;s.measured=false;s.reading=null;}
    else if(action.kind==='measure') {
      const correct=s.probes.red==='24V' && s.probes.black==='0V';
      const reversed=s.probes.red==='0V' && s.probes.black==='24V';
      s.reading=s.mode==='dc' && (correct || reversed) ? s.voltage*(reversed?-1:1) : null;
      s.measured=correct && s.mode==='dc' && s.voltage===24;
    } else throw httpError(400,'คำสั่งวัดไฟไม่ถูกต้อง');
  } else if(type==='bench-usb') {
    if(action.kind==='tool' && ['usb','rs485'].includes(action.value)){s.tool=action.value;s.port=null;s.connected=false;}
    else if(action.kind==='wire' && action.from==='laptop' && ['usb','rs485'].includes(action.to)){s.port=action.to;s.connected=false;s.message='ต่อหัวสายแล้ว กด Connect เพื่อทดสอบ';}
    else if(action.kind==='connect'){s.connected=s.port===s.tool;s.message=s.connected?'Device Detected':'เลือกสายและลากหัวสายไปพอร์ตที่ตรงกันก่อน';}
    else throw httpError(400,'คำสั่งเชื่อมต่อไม่ถูกต้อง');
  } else if(type==='bench-float') {
    if(action.kind==='wire' && ['power','common','signal'].includes(action.from) && ['24V','0V',...Array.from({length:8},(_,i)=>'DI'+i)].includes(action.to)){s.wires[action.from]=action.to;s.tested=false;}
    else if(action.kind==='test'){s.high=!s.high;s.tested=s.high && s.wires.power==='24V' && s.wires.common==='0V' && s.wires.signal==='DI0';}
    else throw httpError(400,'คำสั่งลูกลอยไม่ถูกต้อง');
  } else if(type==='bench-output') {
    if(action.kind!=='test')throw httpError(400,'คำสั่ง Output ไม่ถูกต้อง');
    s.output=!s.output;s.relay=s.output;s.motor=s.relay;s.tested=s.motor;
  }
  return s;
}
export function benchEvaluate(type,s) {
  const checks=type==='bench-power'?[
    {label:'เลือกแหล่งจ่าย 24 VDC',done:s.voltage===24},
    {label:'เลือกย่านวัด DC',done:s.mode==='dc'},
    {label:'ต่อโพรบแดง +24V และดำ 0V',done:s.probes.red==='24V'&&s.probes.black==='0V'},
    {label:'กด CHECK และวัดได้ 24.0 V DC',done:s.measured}
  ]:type==='bench-usb'?[
    {label:'เลือกสายที่ตรงกับพอร์ต',done:s.tool===s.port},
    {label:'กด Connect แล้วตรวจพบอุปกรณ์',done:s.connected}
  ]:type==='bench-float'?[
    {label:'ต่อไฟ +24V และ 0V ให้ Sensor',done:s.wires.power==='24V'&&s.wires.common==='0V'},
    {label:'ต่อ SIG เข้า DI 0',done:s.wires.signal==='DI0'},
    {label:'ทดสอบ HIGH แล้ว DI 0 เป็น ON',done:s.tested}
  ]:[
    {label:'PLC Output เป็น ON',done:s.output},
    {label:'Relay ทำงาน',done:s.relay},
    {label:'Motor RUNNING',done:s.tested&&s.motor}
  ];
  return {checks,passed:checks.every(check=>check.done),score:Math.round(checks.filter(check=>check.done).length/checks.length*100)};
}
