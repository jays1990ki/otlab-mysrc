const color={cyan:'#55edf1',green:'#74f5a1',muted:'#a7bacb',red:'#ff858a',text:'#f2f8fc'};
// Clean artwork contains equipment only. Every control and value is painted once here.
export function createReferenceScene({canvas,overlay,type,onAction,onUi,onMessage}) {
  const ctx=canvas.getContext('2d');
  const crop=0;
  canvas.height=941;
  let image,atlas,toolsImage,run,regions=[],selected,gesture,enabled=false,busy=true;
  let phase=0,lastTime=0,frame,focusId;
  let level=20;
  let motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  function loadImage(path){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('โหลดภาพหน้าฝึกไม่ได้ กรุณาโหลดหน้าใหม่'));img.src=path;});}
  const ready=Promise.all([loadImage('/assets/images/reference-clean/'+type+'.png'),loadImage('/assets/images/game/equipment-atlas.png'),loadImage('/assets/images/reference-clean/usb-tools.png')]).then(([base,sprites,tools])=>{image=base;atlas=sprites;toolsImage=tools;canvas.dataset.assets='ready';});
  const text=(value,x,y,size=28,fill=color.text,align='center')=>{
    ctx.font='600 '+size+'px Inter,system-ui,sans-serif';ctx.textAlign=align;ctx.fillStyle=fill;ctx.fillText(String(value),x,y);
  };
  function panel(x,y,w,h,stroke='#41647b',fill) {
    const gradient=ctx.createLinearGradient(x,y,x+w,y+h);gradient.addColorStop(0,'#17364b');gradient.addColorStop(1,'#0c2334');
    ctx.fillStyle=fill||gradient;ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(x,y,w,h,18);ctx.fill();if(stroke)ctx.stroke();
  }
  function pill(x,y,w,h,label,on=false,alarm=false) {
    panel(x,y,w,h,alarm?'#b45765':on?'#409774':'#51677b',alarm?'#522e3e':on?'#164d3c':'#253b4e');
    text(label,x+w/2,y+h*.68,Math.min(26,h*.51),alarm?color.red:on?color.green:color.muted);
  }
  function led(x,y,on,r=12){ctx.save();ctx.fillStyle=on?color.green:'#61788b';ctx.shadowColor=color.green;ctx.shadowBlur=on?15:0;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.restore();}
  function dashed(points,active=true,width=4){ctx.save();ctx.strokeStyle=active?color.cyan:'#658094';ctx.lineWidth=width;ctx.setLineDash([10,8]);ctx.lineDashOffset=active?-phase*32:0;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.restore();}
  // Coordinates describe the INSIDE of each new glass window, never its bezel.
  function water(x,y,w,h,percent){ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,Math.min(12,w/2));ctx.clip();const surface=y+h-h*Math.max(0,Math.min(100,percent))/100;const g=ctx.createLinearGradient(x,surface,x,y+h);g.addColorStop(0,'#6de9eecc');g.addColorStop(1,'#078eb2bb');ctx.beginPath();ctx.moveTo(x,y+h);ctx.lineTo(x,surface);for(let dx=0;dx<=w;dx+=3)ctx.lineTo(x+dx,surface+Math.sin(dx/16+phase*2)*1.6);ctx.lineTo(x+w,y+h);ctx.closePath();ctx.fillStyle=g;ctx.fill();const glass=ctx.createLinearGradient(x,y,x+w,y);glass.addColorStop(0,'#ffffff20');glass.addColorStop(.3,'#ffffff00');glass.addColorStop(.85,'#ffffff00');glass.addColorStop(1,'#ffffff18');ctx.fillStyle=glass;ctx.fillRect(x,y,w,h);ctx.restore();}
  function spinning(x,y,r,on){if(!on)return;ctx.save();ctx.translate(x,y);ctx.rotate(phase*4);ctx.strokeStyle='#b2f8ffb0';ctx.lineWidth=4;for(let i=0;i<5;i++){ctx.rotate(Math.PI*2/5);ctx.beginPath();ctx.moveTo(5,0);ctx.quadraticCurveTo(r,-r*.35,r,0);ctx.stroke();}ctx.restore();}
  function hit(id,x,y,w,h,label,action,drag,drop,ui){regions.push({id,x,y,w,h,label,action,drag,drop,ui});}
  function pin(id,x,y,label,drag,drop){ctx.save();ctx.strokeStyle=color.cyan;ctx.lineWidth=3;ctx.shadowColor=color.cyan;ctx.shadowBlur=10;ctx.beginPath();ctx.arc(x,y,15,0,Math.PI*2);ctx.stroke();ctx.restore();hit(id,x-24,y-24,48,48,label,null,drag,drop);}
  function button(id,x,y,w,h,label,action,ui){ctx.save();ctx.shadowColor='#16d2df44';ctx.shadowBlur=16;const g=ctx.createLinearGradient(x,y,x,y+h);g.addColorStop(0,'#69f3f3');g.addColorStop(1,'#16c7d5');panel(x,y,w,h,'#91fbfc',g);ctx.restore();text(label,x+w/2,y+h*.66,Math.min(34,h*.48),'#052d39');hit(id,x,y,w,h,label,action,null,null,ui);}
  function title(label,x,y,size=30){text(label,x,y,size,color.text,'left');}
  function note(label,x,y,size=22){text(label,x,y,size,color.muted,'left');}
  function sidebar(x,label){panel(x,137,1650-x,780,'#3d697e');title(label,x+28,185,32);}
  function row(x,y,w,label,value,on=false,alarm=false,id,action){panel(x,y,w,88);title(label,x+24,y+54,27);pill(x+w-183,y+19,160,50,value,on,alarm);if(id)hit(id,x,y,w,88,label,action);}
  function badge(label,x,y,w=180){panel(x,y,w,46,'#5296a7','#112e40');text(label,x+w/2,y+31,22,color.cyan);}
  function sprite(index,x,y,w,h){const cw=atlas.width/4,ch=atlas.height/3;ctx.drawImage(atlas,(index%4)*cw,Math.floor(index/4)*ch,cw,ch,x,y,w,h);}
  function header(){const g=ctx.createLinearGradient(0,0,1672,112);g.addColorStop(0,'#18364c');g.addColorStop(1,'#091b2c');ctx.fillStyle=g;ctx.fillRect(0,0,1672,112);ctx.fillStyle=color.cyan;ctx.fillRect(0,110,1672,2);title('OT BASIC LAB',32,56,34);const names={classify:'OT, IT, IoT & IIoT',sensor:'Sensor & Actuator',plc:'PLC & I/O',hmi:'HMI',scada:'RTU & SCADA','bench-power':'Bench Wiring · DC Power','bench-usb':'Bench Wiring · USB / Serial','bench-float':'Bench Wiring · Control Wiring','bench-output':'Bench Wiring · Output & Actuator'};note(names[type],32,90,23);const bench=type.startsWith('bench-'),seq=bench?['bench-power','bench-usb','bench-float','bench-output']:['classify','sensor','plc','hmi','scada','build'];const start=bench?1002:860;seq.forEach((key,i)=>{const x=start+i*68;ctx.fillStyle=key===type?color.cyan:'#17364b';ctx.strokeStyle=key===type?color.cyan:'#7395a9';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,54,23,0,Math.PI*2);ctx.fill();ctx.stroke();text(i+1,x,63,25,key===type?'#07313b':color.text);hit((bench?'bench-stage-':'stage-')+i,x-26,26,52,56,'Stage '+(i+1),null,null,null,(bench?'bench-stage-':'stage-')+i);});button('top-help',1335,25,136,57,'คู่มือ',null,'help');button('top-settings',1488,25,155,57,'ตั้งค่า',null,'settings');}
  function classify(s){
    panel(735,152,910,425);title('Drag & Drop',765,200);note('จับคู่การ์ดกับประเภทระบบ',765,238,26);
    const names=['Accounting','Pump Control','Smart Home','Vibration Monitor'],icons=[5,4,6,7];
    const remaining=[0,2,3,1].filter(id=>!Object.hasOwn(s.assignments,id)).slice(0,3);
    remaining.forEach((id,i)=>{const x=764+i*289;panel(x,267,260,276,'#7c9da9','#edf0ec');sprite(icons[id],x+40,280,180,165);text(names[id],x+130,505,24,'#183747');hit('device-'+id,x,267,260,276,'ลาก '+names[id],null,{kind:'device',key:id});});
    ['IT','OT','IoT','IIoT'].forEach((category,i)=>{const x=35+i*409;panel(x,614,383,220);title(category,x+22,660,32);const items=Object.entries(s.assignments).filter(([,v])=>v===category);if(!items.length){ctx.save();ctx.setLineDash([8,7]);panel(x+17,684,349,128,'#4b8096','#102c3d');ctx.restore();text('วางการ์ดที่นี่',x+191,757,25,color.muted);}items.forEach(([key],j)=>{const id=Number(key),compact=items.length>1,cy=680+(compact?j*32:0),h=compact?31:135;panel(x+17,cy,349,h,'#7594a1','#edf0ec');if(!compact)sprite(icons[id],x+24,cy+6,132,120);text(names[id],x+(compact?190:252),cy+h*.58,compact?20:23,'#173546');hit('device-'+id,x+17,cy,349,h,'ย้าย '+names[id],null,{kind:'device',key:id});});hit('category-'+category,x,675,383,155,'วางใน '+category,null,null,{kind:'category',key:category});});
    button('check',1405,858,239,62,'Check',null,'check');
  }
  function sensor(s){sidebar(1192,'Sensor & Actuator');panel(1215,222,412,165);title('Water Level',1238,263);const x=1244,y=326,w=264;ctx.fillStyle='#365365';ctx.beginPath();ctx.roundRect(x,y,w,12,6);ctx.fill();ctx.fillStyle=color.cyan;ctx.beginPath();ctx.roundRect(x,y,w*s.level/100,12,6);ctx.fill();ctx.fillStyle='#a8ffff';ctx.strokeStyle='#f0ffff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x+w*s.level/100,y+6,17,0,Math.PI*2);ctx.fill();ctx.stroke();text(s.level+'%',1568,344,28);hit('level-slider',x,y-20,w,52,'ลากระดับน้ำ',null,{kind:'slider',key:'sensor'});panel(1215,414,412,215);title('Sensor Reading',1238,459);text(s.level+'%',1421,574,84,color.cyan);note('เป้าหมาย '+run.target+'%',1240,674,25);button('valve',1221,714,401,98,s.valve?'Close Valve':'Open Valve',{kind:'valve'});badge(s.valve?'VALVE OPEN':'VALVE CLOSED',1238,840,365);hit('valve-image',700,535,184,217,'เปิดหรือปิดวาล์วบนภาพ',{kind:'valve'});drawGlass(s);}
  function plc(s){const wired=s.inputWired??s.ran,on=run.pump;sidebar(841,'PLC · Input / Logic / Output');const labels=['INPUT','LOGIC','OUTPUT'];labels.forEach((label,i)=>{const x=864+i*251;panel(x,224,233,248,i===0&&wired?color.cyan:'#41647b');text(label,x+116,271,26,color.cyan);sprite(i===0?7:i===1?2:1,x+49,290,135,104);text(i===0?(s.full?'Level HIGH':'Level LOW'):i===1?'Fill Tank':on?'Pump ON':'Pump OFF',x+116,439,24,i===2&&on?color.green:color.text);});title('I/O Monitor',869,527);pill(895,565,323,74,wired?'I0.0  CONNECTED':'I0.0  NOT WIRED',wired);pill(1272,565,322,74,'Q0.0  '+(on?'ON':'OFF'),on);pin('from-sensor',204,452,'ลาก Level Sensor',{kind:'wire',key:'sensor'});pin('to-I0.0',923,602,'PLC I0.0',null,{kind:'terminal',key:'I0.0'});pin('to-I0.1',1299,602,'PLC I0.1 ทดสอบขั้วผิด',null,{kind:'terminal',key:'I0.1'});if(wired)dashed([[204,452],[480,548],[923,602]]);button('run-logic',887,704,715,100,on?'Stop Logic':'Run Logic',{kind:on?'stop':'start'});note('คลิกถังรับเพื่อทดสอบระดับเต็ม',886,861,26);hit('full',510,240,270,425,'คลิกถังรับเพื่อจำลองเต็ม',{kind:'full'});hit('source',148,240,293,425,'คลิกถังต้นทางเปลี่ยนระดับ',{kind:'source'});drawGlass(s);spinning(688,784,28,on);}
  function hmi(s){sidebar(841,'HMI · Pump Control');row(870,223,751,'Pump Command',s.command?'ON':'OFF',s.command);row(870,335,751,'Pump Feedback',s.feedback?'ON':'WAITING',s.feedback,false,'feedback',{kind:'feedback'});panel(870,448,751,203,s.alarm?'#bd5c6c':'#41647b');title('Pump Status',897,497);const status=s.alarm?'ALARM':run.pump?'RUNNING':s.command?'STARTING':'STOPPED';text(status,1246,560,43,s.alarm?color.red:run.pump?color.green:color.text);ctx.fillStyle='#2e485d';ctx.beginPath();ctx.roundRect(899,595,692,15,7);ctx.fill();const progress=run.pump?1:s.command?Math.min(.9,s.ticks/3):0;if(progress){ctx.fillStyle=s.alarm?color.red:color.cyan;ctx.beginPath();ctx.roundRect(899,595,692*progress,15,7);ctx.fill();}hit('ack',870,448,751,203,'คลิก Pump Status เพื่อ ACK Alarm',{kind:'ack'});button('start',884,709,723,101,s.command?'Stop Pump':'Start Pump',{kind:s.command?'stop':'start'});note(s.alarm?'คลิก Feedback แล้ว ACK ที่ Pump Status':'คลิก Pump Feedback เพื่อจำลองสัญญาณตอบกลับ',884,862,23);spinning(587,751,28,run.pump);}
  function stationCard(x,y,label,percent,pump,remote=false){panel(x,y,281,200);title(label,x+21,y+39,29);text(percent+'%',x+140,y+108,50,color.cyan);pill(x+69,y+134,145,44,pump?'Pump ON':'Pump OFF',pump);}
  function scada(s){const a=s.remote,b=s.remoteB??18;sidebar(1134,'RTU & SCADA');row(1158,225,468,'RTU A',s.connected?'ON':'OFF',s.connected,false,'connection',{kind:'connection'});row(1158,326,468,'RTU B',s.connectedB?'ON':'OFF',s.connectedB,false,'connection-B',{kind:'connection',station:'B'});title('Station Overview',1160,470,29);panel(1158,493,468,226);['Station','Level','Pump','Alarm'].forEach((v,i)=>text(v,[1206,1311,1410,1540][i],530,19,color.muted));[a,b].forEach((v,i)=>{const y=563+i*76;ctx.fillStyle=i&&b<20?'#472f3e':'#163447';ctx.fillRect(1170,y-16,444,69);text(i?'B':'A',1205,y+29,28);text(v+'%',1309,y+29,29,color.cyan);text((i?s.remotePumpB:(s.remotePumpA??true))?'ON':'OFF',1411,y+29,23);text(v<20?'Low Level':'NORMAL',1542,y+29,19,v<20?color.red:color.muted);});button('send',1172,774,440,92,'Send Level',{kind:'send'});stationCard(24,250,'Station A',s.level,s.pumpA??true);stationCard(24,676,'Station B',s.levelB??18,Boolean(s.pumpB));hit('level',34,295,260,88,'เพิ่มระดับสถานี A 5%',{kind:'level',value:Math.min(100,s.level+5)});hit('level-B',34,721,260,88,'เพิ่มระดับสถานี B 5%',{kind:'level',station:'B',value:Math.min(100,(s.levelB??18)+5)});hit('pump-A',92,384,145,44,'Pump Station A',{kind:'pump'});hit('pump-B',92,810,145,44,'Pump Station B',{kind:'pump',station:'B'});title('SCADA',627,612,23);[['A',a,s.remotePumpA??true],['B',b,Boolean(s.remotePumpB)]].forEach(([name,v,p],i)=>{const x=622+i*164;panel(x,627,153,128);text(name,x+18,650,18,color.text,'left');text(v+'%',x+76,693,32,v<20?color.red:color.cyan);text(p?'Pump ON':v<20?'Low Level':'Pump OFF',x+76,735,18,v<20?color.red:p?color.green:color.muted);});dashed([[522,625],[567,625],[567,676],[610,676]],s.connected);dashed([[522,765],[569,765],[569,722],[610,722]],s.connectedB);drawGlass(s);}
  function power(s){sidebar(1127,'DC Power · 24 VDC');panel(1151,223,475,137);title('Supply Voltage',1175,265,27);[12,24,48].forEach((v,i)=>{const x=1169+i*148;panel(x,291,135,48,s.voltage===v?color.cyan:'#41647b',s.voltage===v?'#125469':'#193b50');text(v+' VDC',x+67,324,23);hit('voltage-'+v,x,291,135,48,'เลือก '+v+' VDC',{kind:'voltage',value:v});});panel(1151,390,475,200);title('Measurement',1175,435);text(s.reading===null?'— V DC':s.reading.toFixed(1)+' V DC',1360,529,55,color.cyan);led(1584,510,s.voltage===24,15);panel(1151,620,475,139);title('Measure Voltage',1174,664,28);note('ต่อโพรบเข้าขั้ว PLC +24V และ 0V',1174,706,22);note('เลือกย่าน DC แล้วกด CHECK',1174,740,22);button('measure',1154,798,215,73,'CHECK',{kind:'measure'});button('hint',1387,798,108,73,'HINT',null,'help');button('reset',1510,798,116,73,'RESET',null,'reset');const g=glass[type]?.meter;if(g){const [x,y,w,h]=g;ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,9);ctx.clip();text(s.reading===null?'—':s.reading.toFixed(1),x+w/2,y+h*.75,h*.73,'#20372f');ctx.restore();}const p=ports[type];text('PLC',510,454,30,color.muted);badge('+24V',354,611,104);badge('0V',488,611,104);dashed([[433,566],[406,611]],false,2);dashed([[458,566],[540,611]],false,2);hit('mode',p.mode[0]-70,p.mode[1]-60,140,120,'คลิกหน้าปัดเลือก DC',{kind:'mode'});badge(s.mode==='dc'?'DC VOLTAGE':'METER OFF',p.mode[0]-88,p.mode[1]+88,176);pin('probe-red',...p.red,'ลากโพรบแดง',{kind:'probe',key:'red'});pin('probe-black',...p.black,'ลากโพรบดำ',{kind:'probe',key:'black'});pin('terminal-24V',...p.positive,'PLC +24V',null,{kind:'terminal',key:'24V'});pin('terminal-0V',...p.negative,'PLC 0V',null,{kind:'terminal',key:'0V'});for(const [from,to]of Object.entries(s.probes))if(to)dashed([p[from],[770,875],to==='24V'?p.positive:p.negative],true,3);}
  function usb(s){const tool=s.tool==='usb'?'USB':'RS-485';sidebar(1107,'USB / SERIAL');note('เลือกสายและเชื่อมต่อ Laptop กับ PLC',1134,235,24);[['usb','USB Cable','PC to Controller'],['rs485','RS-485 Adapter','USB to RS-485 A/B']].forEach(([key,label,detail],i)=>{const y=275+i*137;panel(1134,y,486,112,s.tool===key?color.cyan:'#41647b',s.tool===key?'#16465b':'#123044');ctx.strokeStyle=s.tool===key?color.cyan:'#6b879b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(1167,y+55,13,0,Math.PI*2);ctx.stroke();if(s.tool===key){ctx.fillStyle=color.cyan;ctx.beginPath();ctx.arc(1167,y+55,7,0,Math.PI*2);ctx.fill();}ctx.drawImage(toolsImage,i*toolsImage.width/2,0,toolsImage.width/2,toolsImage.height,1188,y+12,142,88);title(label,1348,y+47,25);note(detail,1348,y+82,19);hit('tool-'+key,1134,y,486,112,'เลือก '+label,{kind:'tool',value:key});});title('Connect Device',1136,587,29);button('connect',1142,621,470,81,'Connect '+tool,{kind:'connect'});panel(1134,745,486,135,s.connected?'#408c71':'#41647b');title(s.connected?'Device Detected':'Device Not Connected',1157,793,29);note('Interface  '+tool,1157,834,24);text(s.connected?'ONLINE':'OFFLINE',1565,855,22,s.connected?color.green:color.muted,'right');const p=ports[type];text('USB',590,432,20,color.cyan,'left');text('RS-485',590,509,18,color.cyan,'left');pin('from-laptop',...p.laptop,'ลากสายจาก Laptop',{kind:'wire',key:'laptop'});pin('port-usb',...p.usb,'พอร์ต USB ของ PLC',null,{kind:'terminal',key:'usb'});pin('port-rs485',...p.rs485,'พอร์ต RS-485 ของ PLC',null,{kind:'terminal',key:'rs485'});if(s.port)dashed([p.laptop,[820,872],p[s.port]],true,5);if(p.screen){const [x,y,w,h]=p.screen;panel(x,y,w,h,'#597f9c','#153c60');text('ENGINEERING TOOL',x+w/2,y+42,22,color.cyan);text(s.connected?'DEVICE ONLINE':'NOT CONNECTED',x+w/2,y+91,22,s.connected?color.green:color.muted);}}
  function float(s){const powered=s.wires.power==='24V'&&s.wires.common==='0V',index=/^DI[0-7]$/.test(s.wires.signal||'')?Number(s.wires.signal.slice(2)):-1,on=powered&&s.high;sidebar(1038,'Control Wiring');panel(1063,221,560,163);[['Provide 24 VDC to float sensor',powered],['Wire sensor signal to DI 0',index===0],['Test Float and verify DI 0 ON',s.tested]].forEach(([v,done],i)=>{led(1090,259+i*45,done,8);title(v,1114,267+i*45,23);});title('Virtual Float Test',1066,435);pill(1445,405,175,46,s.high?'HIGH (ON)':'LOW (OFF)',s.high);button('test-float',1070,470,545,74,'Test Float',{kind:'test'});title('I/O Monitor',1067,600);for(let i=0;i<8;i++){const x=1064+i*70;panel(x,621,64,110,i===index&&on?color.cyan:'#41647b');text('DI '+i,x+32,651,19);led(x+32,677,on&&i===index,11);text(on&&i===index?'ON':'OFF',x+32,714,17,on&&i===index?color.green:color.muted);}panel(1063,771,560,122,s.tested?'#408c71':'#41647b');title(s.tested?'DI 0 is ON':'Complete wiring and test',1084,816,25);note(powered?'24 VDC connected':'Power wiring required',1084,854,21);button('next',1472,804,128,57,'Next',null,'next');const p=ports[type];for(const [key,label]of [['power','+24V'],['common','0V'],['signal','SIG']])pin('float-'+key,...p[key],'ลาก '+label+' ของ Sensor',{kind:'wire',key});pin('supply-24V',...p.supply24,'Power Supply +24V',null,{kind:'terminal',key:'24V'});pin('supply-0V',...p.supply0,'Power Supply 0V',null,{kind:'terminal',key:'0V'});for(let i=0;i<8;i++){text('DI'+i,p.di[0]+i*p.step,p.di[1]-29,13,color.cyan);pin('di-'+i,p.di[0]+i*p.step,p.di[1],'PLC DI '+i,null,{kind:'terminal',key:'DI'+i});}for(const [key,label]of [['power','+24V'],['signal','SIG'],['common','0V']])text(label,p[key][0],p[key][1]-32,18,color.cyan);for(const [from,to]of Object.entries(s.wires)){const dest=to==='24V'?p.supply24:to==='0V'?p.supply0:[p.di[0]+Number(to.slice(2))*p.step,p.di[1]];dashed([p[from],[p[from][0],530],dest],true,3);}water(301,595,191,198,s.high?78:23);badge('Float  '+(s.high?'HIGH (ON)':'LOW (OFF)'),55,864,350);}
  function output(s){sidebar(1191,'Output & Actuator');panel(1217,220,409,154);title('Test Output',1240,264);note('PLC Output → Relay → Motor',1240,311,22);note('ทดสอบการทำงานของโหลด',1240,349,23);button('test-output',1227,405,390,82,'Test Output',{kind:'test'});title('System Status',1218,549);row(1217,578,409,'Output',s.output?'ON':'OFF',s.output);row(1217,678,409,'Relay',s.relay?'ON':'OFF',s.relay);row(1217,778,409,'Motor',s.motor?'RUNNING':'STOPPED',s.motor);const p=ports[type];led(...p.output,s.output,10);led(...p.relay,s.relay,10);spinning(...p.motor,34,s.motor);}
  // These values are calibrated against the v1.5 artwork, in the canvas coordinate space.
  const glass={plc:{a:[312,354,25,246],b:[680,356,23,211]},sensor:{a:[164,311,16,233],b:[968,391,158,302]},scada:{a:[437,254,25,149],b:[908,255,25,148]},'bench-power':{meter:[790,389,126,71]}};
  const ports={
    'bench-power':{mode:[831,561],red:[390,766],black:[290,794],positive:[433,566],negative:[458,566]},
    'bench-usb':{laptop:[1000,797],usb:[545,431],rs485:[550,507],screen:[704,548,280,144]},
    'bench-float':{power:[652,711],common:[770,711],signal:[705,711],supply24:[322,414],supply0:[342,414],di:[565,403],step:26},
    'bench-output':{output:[467,339],relay:[637,383],motor:[620,717]}
  };
  function drawGlass(s){const g=glass[type];if(!g)return;water(...g.a,type==='plc'?(s.source?80:5):type==='scada'?s.level:level);water(...g.b,type==='plc'?(s.full?100:30):type==='scada'?(s.levelB??18):level);}
  const drawers={classify,sensor,plc,hmi,scada,'bench-power':power,'bench-usb':usb,'bench-float':float,'bench-output':output};
  function draw() {
    if(!run || !image?.complete)return;
    regions=[];
    ctx.save();ctx.translate(0,-crop);ctx.drawImage(image,0,0,1672,941);
    if(type==='sensor')ctx.drawImage(image,0,112,1340,829,0,112,1190,829);
    if(type==='plc'||type==='hmi'){ctx.fillStyle='#0a1f31';ctx.fillRect(800,112,872,829);}
    drawers[type](run.state);
    header();
    if(gesture?.moved && gesture.source.drag && gesture.source.drag.kind!=='slider'){
      if(['wire','probe'].includes(gesture.source.drag.kind))dashed([[gesture.source.x+gesture.source.w/2,gesture.source.y+gesture.source.h/2],[gesture.current.x,gesture.current.y]],true,5);
      else{
        const r=gesture.source;ctx.globalAlpha=.85;ctx.drawImage(canvas,r.x,r.y-crop,r.w,r.h,gesture.current.x-r.w/2,gesture.current.y-r.h/2,r.w,r.h);ctx.globalAlpha=1;
      }
    }
    ctx.restore();
  }
  function activate(region) {
    if(busy)return;
    if(region.ui)return onUi(region.ui);
    if(!enabled)return;
    if(region.action)return onAction(region.action);
    if(region.drag){selected=region.drag;onMessage('เลือกแล้ว คลิกปลายทางหรือลากไปวาง');}
    else if(region.drop && selected)drop(selected,region.drop);
    else if(region.drop)onMessage('เลือกต้นทางหรือหัวสายก่อน');
  }
  function drop(source,dest) {
    let action;
    if(source.kind==='device' && dest.kind==='category')action={kind:'assign',device:source.key,category:dest.key};
    if(source.kind==='wire' && dest.kind==='terminal')action={kind:'wire',from:source.key,to:dest.key};
    if(source.kind==='probe' && dest.kind==='terminal')action={kind:'probe',from:source.key,to:dest.key};
    if(!action)return onMessage('วางที่ขั้วรับหรือกรอบหมวดหมู่ที่ตรงกัน');
    selected=undefined;onAction(action);
  }
  function position(event) {
    const bounds=canvas.getBoundingClientRect();
    return {x:(event.clientX-bounds.left)*1672/bounds.width,y:(event.clientY-bounds.top)*(941-crop)/bounds.height+crop};
  }
  function find(point,dropping=false) {
    const candidates=[...regions].reverse().filter(r=>point.x>=r.x&&point.x<=r.x+r.w&&point.y>=r.y&&point.y<=r.y+r.h);
    let terminals=candidates.filter(r=>dropping?r.drop:r.drag || r.drop);
    if(!dropping && terminals.some(r=>r.drag))terminals=terminals.filter(r=>r.drag);
    terminals.sort((a,b)=>Math.hypot(point.x-a.x-a.w/2,point.y-a.y-a.h/2)-Math.hypot(point.x-b.x-b.w/2,point.y-b.y-b.h/2));
    return terminals[0] || candidates[0];
  }
  const stage=canvas.parentElement;
  stage.addEventListener('pointerdown',event=>{
    const point=position(event),source=find(point);
    if(busy || !source || (!enabled&&!source.ui) || event.button!==0)return;
    event.preventDefault();gesture={source,start:point,current:point,moved:false};stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove',event=>{
    if(!gesture)return;
    gesture.current=position(event);gesture.moved ||= Math.hypot(gesture.current.x-gesture.start.x,gesture.current.y-gesture.start.y)>8;
    stage.classList.toggle('dragging',gesture.moved);
    for(const node of overlay.children)node.classList.toggle('drop-ready',Boolean(gesture.source.drag && regions.find(r=>r.id===node.dataset.hit)?.drop));
  });
  stage.addEventListener('pointerup',event=>{
    if(!gesture)return;
    const previous=gesture;gesture=undefined;stage.classList.remove('dragging');
    for(const node of overlay.children)node.classList.remove('drop-ready');
    if(previous.source.drag?.kind==='slider'){
      const p=position(event),r=previous.source;
      return onAction({kind:'level',value:Math.round(Math.max(0,Math.min(1,(p.x-r.x)/r.w))*20)*5});
    }
    if(previous.moved && previous.source.drag){
      const destination=find(position(event),true);
      if(destination?.drop)drop(previous.source.drag,destination.drop);
      else onMessage('ปล่อยลงบนขั้วรับหรือช่องวางที่สว่าง');
    }else if(!previous.moved)activate(previous.source);
  });
  stage.addEventListener('pointercancel',()=>{gesture=undefined;stage.classList.remove('dragging');for(const node of overlay.children)node.classList.remove('drop-ready');});
  overlay.addEventListener('click',event=>{
    if(event.detail!==0)return;
    const region=regions.find(r=>r.id===event.target.dataset.hit);
    if(region)activate(region);
  });
  overlay.addEventListener('keydown',event=>{
    if(event.target.dataset.hit!=='level-slider' || busy || !enabled || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    const value=event.key==='Home'?0:event.key==='End'?100:Math.max(0,Math.min(100,run.state.level+(event.key==='ArrowRight'?5:-5)));
    onAction({kind:'level',value});
  });
  function sync() {
    overlay.replaceChildren(...regions.map(r=>{
      const node=document.createElement('button');node.type='button';node.dataset.hit=r.id;node.className='ref-hit'+(r.drag?' draggable':'');
      node.setAttribute('aria-label',r.label);node.title=r.label;
      if(r.id==='level-slider'){node.setAttribute('role','slider');node.setAttribute('aria-valuemin','0');node.setAttribute('aria-valuemax','100');node.setAttribute('aria-valuenow',String(run.state.level));}
      node.style.left=r.x/1672*100+'%';node.style.top=(r.y-crop)/(941-crop)*100+'%';
      node.style.width=r.w/1672*100+'%';node.style.height=r.h/(941-crop)*100+'%';
      node.disabled=busy || (!enabled&&!r.ui);return node;
    }));
  }
  function animate(time) {
    const delta=Math.min((time-lastTime)/1000,.05);lastTime=time;
    if(motion&&!document.hidden)phase+=delta;
    if(run){level+=((run.state.level ?? 20)-level)*Math.min(1,delta*5);draw();}
    frame=requestAnimationFrame(animate);
  }
  frame=requestAnimationFrame(animate);
  return {
    ready,
    update(next){run=next;draw();sync();},
    setAvailability(active,working){
      if(working && overlay.contains(document.activeElement))focusId=document.activeElement.dataset.hit;
      enabled=active;busy=working;
      for(const node of overlay.children){const r=regions.find(r=>r.id===node.dataset.hit);node.disabled=working || (!active&&!r?.ui);}
      if(!working && focusId){const node=[...overlay.children].find(item=>item.dataset.hit===focusId);if(node && !node.disabled)node.focus({preventScroll:true});focusId=undefined;}
    },
    isDragging(){return Boolean(gesture);},
    setMotion(allowed){motion=allowed;},
    destroy(){cancelAnimationFrame(frame);}
  };
}
