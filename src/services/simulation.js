import { httpError } from './security.js';

export const templates = [
  { key: 'classify', name: 'OT / IT / IoT / IIoT', title: 'OT, IT, IoT & IIoT', summary: 'จำแนกอุปกรณ์จากหน้าที่และบริบทการใช้งาน', lesson: 'IT ประมวลผลข้อมูลธุรกิจ OT ควบคุมกระบวนการทางกายภาพ IoT เชื่อมอุปกรณ์ทั่วไปผ่านเครือข่าย และ IIoT ใช้เทคโนโลยีลักษณะนี้ในอุตสาหกรรม หมวดหมู่ในบทนี้เลือกตามบริบทหลักของอุปกรณ์', mission: 'เลือกอุปกรณ์ทีละชิ้น แล้วจัดลงหมวดหมู่ให้ครบทั้งสี่รายการ', image: 1, target: 0 },
  { key: 'sensor', name: 'Sensor & Actuator', title: 'Sensor & Actuator', summary: 'เปิดวาล์วเติมน้ำ แล้วปิดเมื่อถึงระดับเป้าหมาย', lesson: 'Sensor ตรวจระดับน้ำ ส่วน actuator ควบคุมวาล์ว ในการจำลองนี้การเปิดวาล์วเพิ่มระดับน้ำ 5% ต่อหนึ่งรอบเวลา แรงดันไฟและปริมาณการไหลถูกย่อให้เหมาะกับการเรียน', mission: 'เปิดวาล์วเติมน้ำ ใช้ปุ่มเดินเวลาเพื่อเพิ่มระดับน้ำ และปิดวาล์วเมื่อถึงเป้าหมาย', image: 2, target: 50 },
  { key: 'plc', name: 'PLC & Interlock', title: 'PLC & I/O Interlock', summary: 'ทดสอบ logic ของปั๊มกับเงื่อนไขป้องกันถังล้น', lesson: 'PLC อ่าน input และประเมิน logic ซ้ำเป็นรอบ ปั๊มตัวอย่างเดินได้เมื่อได้รับคำสั่ง START มีน้ำต้นทาง ถังรับยังไม่เต็ม และไม่ได้กด Emergency Stop', mission: 'เดินปั๊มหนึ่งครั้ง แล้วจำลองถังรับเต็มเพื่อให้ interlock หยุดปั๊ม', image: 3, target: 0 },
  { key: 'hmi', name: 'HMI Control', title: 'Human-Machine Interface', summary: 'ส่งคำสั่ง ตรวจ feedback และรับทราบ alarm', lesson: 'คำสั่ง START และ feedback ของปั๊มเป็นคนละสัญญาณ หากไม่มี feedback หลังพ้นเวลารอ ระบบตัวอย่างแสดง alarm ผู้ปฏิบัติงานต้องตรวจสอบ feedback และรับทราบ alarm', mission: 'กด START เดินเวลา 3 รอบจนเกิด alarm จากนั้นเปิด feedback แล้วกด ACK', image: 4, target: 0 },
  { key: 'scada', name: 'RTU & SCADA', title: 'RTU & SCADA', summary: 'สำรวจค่าหน้างานและส่งข้อมูลไปยังห้องควบคุม', lesson: 'RTU ส่งค่าที่วัดได้ให้ SCADA ค่าในห้องควบคุมเป็นค่าที่ได้รับล่าสุด เมื่อการสื่อสารขาดหาย ค่าอาจค้างอยู่ ในบทนี้สถานี A มีเกณฑ์ HIGH ที่ระดับเป้าหมายหรือสูงกว่า', mission: 'ทำให้สถานี A ถึงระดับ HIGH ส่งข้อมูลเข้า SCADA ตัดการสื่อสารและทดลองส่งอีกครั้ง แล้วเชื่อมต่อกลับและส่งข้อมูลใหม่', image: 5, target: 70 },
  { key: 'build', name: 'Build an ICS', title: 'Build an ICS', summary: 'ต่อสัญญาณ Sensor, PLC, Pump และ HMI ให้ครบวงจร', lesson: 'Sensor ต่อเข้า PLC input, PLC output ต่อ actuator และ HMI ส่งคำสั่งเข้า PLC ในแบบจำลองนี้เมื่อเปิดระบบและต่อครบวงจร ปั๊มจะถ่ายน้ำจนถึงระดับเป้าหมายแล้วหยุด', mission: 'ต่อสายสัญญาณทั้งสาม เปิดระบบและเดินเวลาจนปั๊มหยุดที่ระดับเป้าหมาย', image: 6, target: 60 },
  { key: 'conveyor', name: 'Conveyor Sorting', title: 'Conveyor & Color Sensor', summary: 'ลากกล่องขึ้นสายพาน ตรวจสี และคัดแยกด้วยแขนผลัก', lesson: 'มอเตอร์ขับสายพานให้กล่องผ่าน color sensor จากนั้น actuator เปลี่ยนเส้นทาง กล่องสีน้ำเงินต้องไปช่อง GOOD และกล่องสีแดงไปช่อง REJECT หากคัดผิดสามารถลากกล่องเดิมมาลองใหม่ได้', mission: 'ลากกล่องขึ้นสายพาน คลิกมอเตอร์เพื่อเริ่ม แล้วคลิกแขนคัดแยกให้กล่องน้ำเงินไป GOOD และกล่องแดงไป REJECT จนครบ 3 กล่อง', image: 3, target: 0 }
];
export const devices = [
  { name: 'ERP • ระบบใบสั่งซื้อ', answer: 'IT' },
  { name: 'PLC • ควบคุมปั๊ม', answer: 'OT' },
  { name: 'Smart light • ไฟในบ้าน', answer: 'IoT' },
  { name: 'Wireless vibration sensor • วิเคราะห์เครื่องจักร', answer: 'IIoT' }
];
export function initialState(type) {
  switch (type) {
    case 'conveyor': return { parcel: null, position: 0, moving: false, gate: 'good', sorted: [], last: '' };
    case 'classify': return { assignments: {} };
    case 'sensor': return { level: 20, valve: false, filled: false };
    case 'plc': return { source: true, full: false, emergency: false, command: false, ran: false, interlocked: false };
    case 'hmi': return { command: false, feedback: false, ticks: 0, alarm: false, alarmSeen: false, acknowledged: false };
    case 'scada': return { level: 20, remote: 20, connected: true, sent: false, outageSeen: false, recovered: false, history: [20] };
    case 'build': return { wires: {}, power: false, level: 20, ran: false };
    default: throw httpError(400, 'ไม่พบชนิดของแบบจำลอง');
  }
}
export function pumpOn(type, state, target) {
  if (type === 'plc') return state.command && state.source && !state.full && !state.emergency;
  if (type === 'hmi') return state.command && state.feedback;
  if (type === 'build') return state.power && state.wires.sensor === 'PLC input' && state.wires.plc === 'Pump' && state.wires.hmi === 'PLC' && state.level < target;
  return false;
}
export function applyAction(type, previous, action, target) {
  const state = structuredClone(previous);
  const bool = (key) => { state[key] = !state[key]; };
  switch (type) {
    case 'conveyor':
      if (action.kind === 'load' && Number.isInteger(action.parcel) && action.parcel >= 0 && action.parcel <= 2 && state.parcel === null && !state.sorted.includes(action.parcel)) {
        state.parcel = action.parcel;
        state.position = 0;
        state.last = '';
      } else if (action.kind === 'motor') bool('moving');
      else if (action.kind === 'gate') state.gate = state.gate === 'good' ? 'reject' : 'good';
      else if (action.kind === 'tick') {
        if (state.moving && state.parcel !== null) {
          state.position++;
          if (state.position >= 5) {
            const correct = (state.parcel === 1 ? 'reject' : 'good') === state.gate;
            if (correct) state.sorted.push(state.parcel);
            if (state.sorted.length === 3) state.moving = false;
            state.last = correct ? 'คัดแยกถูกต้อง' : 'คัดแยกผิดช่อง ลากกล่องเดิมมาลองใหม่';
            state.parcel = null;
            state.position = 0;
          }
        }
      } else break;
      return state;
    case 'classify':
      if (action.kind !== 'assign' || !Number.isInteger(action.device) || action.device < 0 || action.device > 3 || !['IT','OT','IoT','IIoT'].includes(action.category)) break;
      state.assignments[action.device] = action.category;
      return state;
    case 'sensor':
      if (action.kind === 'valve') bool('valve');
      else if (action.kind === 'tick') {
        if (state.valve) { state.level = Math.min(100, state.level + 5); state.filled = true; }
      } else break;
      return state;
    case 'plc':
      if (['source', 'full', 'emergency'].includes(action.kind)) bool(action.kind);
      else if (action.kind === 'start') state.command = true;
      else if (action.kind === 'stop') state.command = false;
      else break;
      if (pumpOn(type, state, target)) state.ran = true;
      if (state.ran && state.full && state.command && !pumpOn(type, state, target)) state.interlocked = true;
      return state;
    case 'hmi':
      if (action.kind === 'start') state.command = true;
      else if (action.kind === 'stop') state.command = false;
      else if (action.kind === 'feedback') bool('feedback');
      else if (action.kind === 'ack') { if (state.alarm && state.feedback) { state.acknowledged = true; state.alarm = false; } }
      else if (action.kind === 'tick') {
        if (state.command && !state.feedback) state.ticks++;
        if (state.ticks >= 3 && state.command && !state.feedback) { state.alarm = true; state.alarmSeen = true; }
      } else break;
      return state;
    case 'scada':
      if (action.kind === 'level' && Number.isInteger(action.value) && action.value >= 0 && action.value <= 100) state.level = action.value;
      else if (action.kind === 'connection') bool('connected');
      else if (action.kind === 'send') {
        if (state.connected) {
          state.remote = state.level;
          state.history = [...state.history, state.remote].slice(-20);
          if (state.remote >= target) state.sent = true;
          if (state.outageSeen) state.recovered = true;
        } else state.outageSeen = true;
      } else break;
      return state;
    case 'build':
      if (action.kind === 'wire' && ['sensor','plc','hmi'].includes(action.from) && ['PLC input','Pump','PLC','HMI'].includes(action.to)) state.wires[action.from] = action.to;
      else if (action.kind === 'power') bool('power');
      else if (action.kind === 'tick') {
        if (pumpOn(type, state, target)) { state.level = Math.min(100, state.level + 5); state.ran = true; }
      } else break;
      return state;
  }
  throw httpError(400, 'คำสั่งจำลองไม่ถูกต้อง');
}
export function evaluate(type, state, target) {
  const checks = {
    conveyor: [0,1,2].map(id => ({ label: 'กล่อง '+(id+1)+' → '+(id===1?'REJECT':'GOOD'), done: state.sorted?.includes(id) })),
    classify: devices.map((device, i) => ({ label: device.name, done: state.assignments?.[i] === device.answer })),
    sensor: [{ label: 'ได้เติมน้ำผ่านวาล์ว', done: state.filled }, { label: 'ระดับน้ำตรงเป้าหมาย ' + target + '%', done: state.level === target }, { label: 'ปิดวาล์วแล้ว', done: !state.valve }],
    plc: [{ label: 'ปั๊มเคยเดิน', done: state.ran }, { label: 'ถังรับเต็มแล้ว interlock หยุดปั๊ม', done: state.interlocked && state.full && !pumpOn(type, state, target) }],
    hmi: [{ label: 'ตรวจพบ alarm จาก feedback ล่าช้า', done: state.alarmSeen }, { label: 'รับ feedback และปั๊มเดิน', done: state.feedback && state.command }, { label: 'รับทราบ alarm', done: state.acknowledged && !state.alarm }],
    scada: [{ label: 'ส่งค่า HIGH เข้า SCADA', done: state.sent }, { label: 'ตรวจพบการสื่อสารขาดหาย', done: state.outageSeen }, { label: 'ส่งข้อมูลหลังเชื่อมต่อกลับ', done: state.recovered && state.connected && state.remote >= target }],
    build: [{ label: 'ต่อสาย Sensor → PLC input', done: state.wires?.sensor === 'PLC input' }, { label: 'ต่อสาย PLC output → Pump', done: state.wires?.plc === 'Pump' }, { label: 'ต่อสาย HMI → PLC', done: state.wires?.hmi === 'PLC' }, { label: 'ระบบเคยเดินและหยุดที่เป้าหมาย ' + target + '%', done: state.ran && state.power && state.level === target && !pumpOn(type, state, target) }]
  }[type];
  const passed = checks.every(check => check.done);
  return { checks, passed, score: Math.round(checks.filter(check => check.done).length / checks.length * 100) };
}
