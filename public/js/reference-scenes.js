const color={cyan:'#4df2f7',green:'#67ff7c',muted:'#8195a4',red:'#ff757a',text:'#f5f9fc'};
export function createReferenceScene({canvas,overlay,type,onAction,onUi,onMessage}) {
  const ctx=canvas.getContext('2d');
  const crop=type==='bench-float'?72:0;
  canvas.height=941-crop;
  if(crop)canvas.parentElement.classList.add('crop-browser');
  let image,run,regions=[],selected,gesture,enabled=false,busy=true;
  let phase=0,lastTime=0,frame,focusId;
  let level=20;
  let motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ready=new Promise((resolve,reject)=>{
    image=new Image();
    image.onload=()=>{canvas.dataset.assets='ready';resolve();};
    image.onerror=()=>reject(new Error('โหลดภาพหน้าฝึกไม่ได้ กรุณาโหลดหน้าใหม่'));
    image.src='/assets/images/reference/'+type+'.png';
  });
  const text=(value,x,y,size=28,fill=color.text,align='center')=>{
    ctx.font='700 '+size+'px Inter,system-ui,sans-serif';ctx.textAlign=align;ctx.fillStyle=fill;
    ctx.shadowColor='#051421';ctx.shadowBlur=3;ctx.fillText(String(value),x,y);ctx.shadowBlur=0;
  };
  function panel(x,y,w,h,stroke='#7cb0c6',fill) {
    const gradient=ctx.createLinearGradient(x,y,x+w,y+h);
    gradient.addColorStop(0,'#19394dfb');gradient.addColorStop(1,'#091f30fd');
    ctx.fillStyle=fill || gradient;ctx.strokeStyle=stroke;ctx.lineWidth=2;
    ctx.beginPath();ctx.roundRect(x,y,w,h,12);ctx.fill();ctx.stroke();
  }
  function pill(x,y,w,h,label,on=false,alarm=false) {
    panel(x-7,y-6,w+14,h+12,'#173449','#173449');
    panel(x,y,w,h,alarm?color.red:on?color.green:'#74828d',alarm?'#773d40':on?'#116a38':'#354452');
    text(label,x+w/2,y+h*.7,Math.min(29,h*.55),on?color.green:color.text);
  }
  function led(x,y,on,r=13) {
    ctx.save();ctx.fillStyle='#183345';ctx.beginPath();ctx.arc(x,y,r+5,0,Math.PI*2);ctx.fill();ctx.shadowColor=on?color.green:'#152534';ctx.shadowBlur=on?18:0;
    ctx.fillStyle=on?color.green:'#76838d';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function dashed(points,active=true,width=5) {
    ctx.save();ctx.strokeStyle=active?color.cyan:'#6c8494';ctx.lineWidth=width;
    ctx.setLineDash([10,8]);ctx.lineDashOffset=active?-phase*32:0;
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.restore();
  }
  function water(x,y,w,h,percent) {
    ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,8);ctx.clip();
    ctx.fillStyle='#12303b';ctx.fillRect(x,y,w,h);
    const surface=y+h-h*percent/100;
    const gradient=ctx.createLinearGradient(x,surface,x,y+h);gradient.addColorStop(0,'#4defffdb');gradient.addColorStop(1,'#008bb7df');
    ctx.beginPath();ctx.moveTo(x,y+h);ctx.lineTo(x,surface);
    for(let dx=0;dx<=w;dx+=4)ctx.lineTo(x+dx,surface+Math.sin(dx/14+phase*3)*2.5);
    ctx.lineTo(x+w,y+h);ctx.closePath();ctx.fillStyle=gradient;ctx.fill();
    ctx.restore();
  }
  function spinning(x,y,r,on) {
    if(!on)return;
    ctx.save();ctx.translate(x,y);ctx.rotate(phase*4);ctx.strokeStyle='#b2f8ffb0';ctx.lineWidth=4;
    for(let i=0;i<5;i++){ctx.rotate(Math.PI*2/5);ctx.beginPath();ctx.moveTo(5,0);ctx.quadraticCurveTo(r,-r*.35,r,0);ctx.stroke();}
    ctx.restore();
  }
  function hit(id,x,y,w,h,label,action,drag,drop,ui) {regions.push({id,x,y,w,h,label,action,drag,drop,ui});}
  function pin(id,x,y,label,drag,drop) {
    ctx.save();ctx.strokeStyle=color.cyan;ctx.lineWidth=3;ctx.shadowColor=color.cyan;ctx.shadowBlur=12;
    ctx.beginPath();ctx.arc(x,y,17,0,Math.PI*2);ctx.stroke();ctx.restore();
    hit(id,x-26,y-26,52,52,label,null,drag,drop);
  }
  function button(id,x,y,w,h,label,action,ui) {
    panel(x,y,w,h,color.cyan,'#10d3df');text(label,x+w/2,y+h*.68,Math.min(39,h*.53),'#03212a');
    hit(id,x,y,w,h,label,action,null,null,ui);
  }
  function classify(s) {
    panel(744,290,906,282,'#98b6c7','#192b39f5');
    const remaining=[0,2,3,1].filter(id=>!Object.hasOwn(s.assignments,id)).slice(0,3);
    const crops={0:[756,320,265,230],2:[1060,303,252,242],3:[1343,303,267,242]};
    remaining.forEach((id,index)=>{
      const x=763+index*290;
      if(id===1){panel(x,307,260,239,'#d7d0c7','#eee7dd');ctx.drawImage(image,475,691,155,132,x+50,329,155,132);text('Pump Control',x+130,510,26,'#152b39');}
      else {const [sx,sy,sw,sh]=crops[id];ctx.drawImage(image,sx,sy,sw,sh,x,307,260,239);}
      hit('device-'+id,x,307,260,239,'ลาก '+['Accounting','Pump Control','Smart Home Sensor','Vibration Monitoring'][id],null,{kind:'device',key:id});
    });
    ['IT','OT','IoT','IIoT'].forEach((category,i)=>{
      const x=65+i*390;panel(x,675,337,153,'#5e859a','#142a38f8');
      const items=Object.entries(s.assignments).filter(([,value])=>value===category);
      if(!items.length)text('วางการ์ดที่นี่',x+168,760,24,'#a4c2d1');
      items.forEach(([id],index)=>{
        const device=Number(id),compact=items.length>1;
        const cardX=x+8+(compact?(index%2)*162:0),cardY=686+(compact?Math.floor(index/2)*65:0);
        const cardW=compact?156:321,cardH=compact?61:131;
        panel(cardX,cardY,cardW,cardH,'#c6c0b7','#ece6dd');
        const icons=[[790,335,185,135],[475,695,150,125],[1090,320,185,125],[1370,333,180,125]];
        const [sx,sy,sw,sh]=icons[device];
        ctx.drawImage(image,sx,sy,sw,sh,cardX+8,cardY+8,compact?54:145,cardH-16);
        const labels=['Accounting','Pump Control','Smart Home','Vibration'];
        text(labels[device],cardX+(compact?108:238),cardY+cardH*.57,compact?13:22,'#172d39');
        hit('device-'+device,cardX,cardY,cardW,cardH,'ย้ายการ์ด '+labels[device],null,{kind:'device',key:device});
      });
      hit('category-'+category,x,675,337,153,'วางใน '+category,null,null,{kind:'category',key:category});
    });
    hit('check',1405,862,246,64,'Check',null,null,null,'check');
  }
  function sensor(s) {
    water(176,312,90,269,level);water(980,349,201,228,level);
    panel(1221,479,423,156,'#365268','#0d2838');text(s.level+'%',1430,595,92,color.cyan);
    panel(1543,296,104,61,'#17394b','#17394b');text(s.level+'%',1595,343,32);
    panel(1238,318,315,25,'#68899a','#49606f');
    ctx.fillStyle=color.cyan;ctx.fillRect(1242,321,307*s.level/100,19);
    const knob=1242+307*s.level/100;ctx.fillStyle='#72ffff';ctx.strokeStyle='#f8ffff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(knob,330,18,0,Math.PI*2);ctx.fill();ctx.stroke();
    button('valve',1223,684,434,122,s.valve?'Close Valve':'Open Valve',{kind:'valve'});
    hit('valve-image',715,544,207,191,'เปิดหรือปิดวาล์วบนภาพ',{kind:'valve'});
    hit('level-slider',1236,300,320,62,'ลากระดับน้ำ',null,{kind:'slider',key:'sensor'});
    if(s.valve)dashed([[610,670],[970,670],[970,571]],true,7);
    spinning(560,679,29,s.valve);
  }
  function plc(s) {
    const wired=s.inputWired ?? s.ran;
    const on=run.pump;
    pill(890,589,337,66,wired?'I0.0  CONNECTED':'I0.0  NOT WIRED',wired);
    pill(1292,589,312,66,'Q0.0  '+(on?'ON':'OFF'),on);
    panel(880,320,210,147,'#4c8b94');text(s.full?'Level HIGH':'Level Low',986,447,26,s.full?color.red:color.cyan);
    panel(1402,322,200,146,'#4c8b94');text(on?'Pump ON':'Pump OFF',1501,448,28,on?color.green:color.muted);
    pin('from-sensor',239,514,'ลาก Level Sensor', {kind:'wire',key:'sensor'});
    pin('to-I0.0',943,618,'PLC I0.0',null,{kind:'terminal',key:'I0.0'});
    pin('to-I0.1',1336,618,'PLC I0.1 ทดสอบขั้วผิด',null,{kind:'terminal',key:'I0.1'});
    if(wired)dashed([[239,514],[520,566],[875,618]],true,6);
    button('run-logic',953,720,614,125,on?'Stop Logic':'Run Logic',{kind:on?'stop':'start'});
    hit('full',465,230,300,435,'คลิกถังรับเพื่อจำลองเต็ม',{kind:'full'});
    hit('source',108,220,285,444,'คลิกถังต้นทางเปลี่ยนระดับ',{kind:'source'});
    water(345,365,24,271,s.source?80:5);water(680,367,20,199,s.full?100:30);
    spinning(651,742,27,on);
  }
  function hmi(s) {
    pill(1324,270,259,65,s.command?'ON':'OFF',s.command);
    pill(1325,408,270,65,s.feedback?'ON':'WAITING',s.feedback);
    panel(1229,519,395,124,s.alarm?color.red:color.cyan,'#153142');
    text(s.alarm?'ALARM':run.pump?'RUNNING':s.command?'STARTING':'STOPPED',1430,578,38,s.alarm?color.red:color.text);
    ctx.fillStyle='#415260';ctx.fillRect(1250,616,340,17);ctx.fillStyle=color.cyan;ctx.fillRect(1250,616,run.pump?340:s.command?Math.min(300,s.ticks*90):0,17);
    button('start',909,728,690,118,s.command?'Stop Pump':'Start Pump',{kind:s.command?'stop':'start'});
    hit('feedback',890,385,731,122,'คลิกแถว Pump Feedback เพื่อจำลอง Feedback',{kind:'feedback'});
    hit('ack',884,518,741,145,'คลิกแถว Pump เพื่อ ACK Alarm',{kind:'ack'});
    spinning(613,728,28,run.pump);
    if(run.pump)dashed([[370,645],[370,585],[518,585]],true,5);
  }
  function scada(s) {
    const a=s.remote,b=s.remoteB ?? 18;
    panel(138,348,166,77,'#153347','#153347');text(s.level+'%',218,410,50);
    panel(134,664,171,75,'#153347','#153347');text((s.levelB ?? 18)+'%',218,720,48);
    pill(213,459,86,40,run.pump?'ON':'OFF',Boolean(run.pump));
    pill(213,774,95,40,s.pumpB?'ON':'OFF',Boolean(s.pumpB));
    hit('pump-A',205,453,101,55,'Pump Station A',{kind:'pump'});
    hit('pump-B',205,768,101,55,'Pump Station B',{kind:'pump',station:'B'});
    panel(718,592,181,72,'#13374b','#13374b');text(a+'%',808,645,39,color.cyan);
    panel(936,592,157,72,'#13374b','#13374b');text(b+'%',1015,645,39,b<20?color.red:color.cyan);
    panel(1288,553,137,72,'#183e53','#183e53');text(a+'%',1356,605,34);
    panel(1288,638,137,72,'#533441','#533441');text(b+'%',1356,685,34);
    pill(738,681,146,40,(s.remotePumpA ?? true)?'Pump ON':'Pump OFF',s.remotePumpA ?? true);
    pill(946,681,147,42,b<20?'Low Level':'NORMAL',b>=20,b<20);
    pill(1440,563,65,39,(s.remotePumpA ?? true)?'ON':'OFF',s.remotePumpA ?? true);
    pill(1440,649,65,39,s.remotePumpB?'ON':'OFF',Boolean(s.remotePumpB));
    pill(1517,650,131,40,b<20?'Low Level':'NORMAL',b>=20,b<20);
    pill(1515,248,92,45,s.connected?'ON':'OFF',s.connected);
    pill(1515,320,92,45,s.connectedB?'ON':'OFF',s.connectedB);
    hit('connection',1197,234,435,69,'RTU A ตัดหรือเชื่อมต่อ',{kind:'connection'});
    hit('connection-B',1197,305,435,70,'RTU B ตัดหรือเชื่อมต่อ',{kind:'connection',station:'B'});
    hit('level',42,323,265,124,'เพิ่มระดับสถานี A 5%',{kind:'level',value:Math.min(100,s.level+5)});
    hit('level-B',42,639,265,115,'เพิ่มระดับสถานี B 5%',{kind:'level',station:'B',value:Math.min(100,(s.levelB ?? 18)+5)});
    hit('send',1224,774,401,89,'Send Level',{kind:'send'});
    dashed([[520,471],[570,471],[570,600],[634,600]],s.connected);
    dashed([[520,722],[570,722],[570,650],[634,650]],s.connectedB);
    water(470,249,26,107,s.level);water(1031,273,27,102,s.levelB ?? 18);
  }
  function power(s) {
    [12,24,48].forEach((voltage,i)=>{
      const x=1163+i*165;panel(x,270,149,53,s.voltage===voltage?color.cyan:'#64869c');
      text(voltage+' VDC',x+75,305,24,s.voltage===voltage?color.cyan:color.text);
      hit('voltage-'+voltage,x,270,149,53,'เลือก '+voltage+' VDC',{kind:'voltage',value:voltage});
    });
    panel(884,313,196,95,'#819f8e','#c3d5ba');
    text(s.reading===null?'—':s.reading.toFixed(1),978,384,58,'#10231c');
    panel(1180,454,309,78,color.cyan,'#002f3f');text(s.reading===null?'— V DC':s.reading.toFixed(1)+' V DC',1335,509,40,color.cyan);
    hit('mode',845,465,202,149,'คลิกหมุนมิเตอร์ไปย่าน DC',{kind:'mode'});
    pill(855,471,68,34,s.mode==='dc'?'DC':'OFF',s.mode==='dc');
    led(1599,482,s.voltage===24,22);led(775,230,s.voltage===24,11);
    pin('probe-red',1029,706,'ลากโพรบแดง',{kind:'probe',key:'red'});
    pin('probe-black',955,707,'ลากโพรบดำ',{kind:'probe',key:'black'});
    pin('terminal-24V',494,520,'ขั้ว PLC +24V',null,{kind:'terminal',key:'24V'});
    pin('terminal-0V',518,520,'ขั้ว PLC 0V',null,{kind:'terminal',key:'0V'});
    for(const [from,to] of Object.entries(s.probes)) if(to)dashed([[from==='red'?1029:955,706],[780,850],[to==='24V'?494:518,520]],true,3);
    hit('measure',1145,803,195,86,'CHECK วัดแรงดัน',{kind:'measure'});
    hit('hint',1350,810,147,74,'Hint',null,null,null,'help');
    hit('reset',1508,810,148,74,'Reset',null,null,null,'reset');
  }
  function usb(s) {
    const tool=s.tool==='usb'?'USB':'RS-485';
    panel(1138,421,504,92,s.tool==='usb'?color.cyan:'#759cb1','#173b50ce');
    ctx.drawImage(image,1205,434,230,76,1205,434,230,76);text('USB Cable',1525,465,26);text('PC ↔ Controller',1518,496,21);
    panel(1138,524,504,94,s.tool==='rs485'?color.cyan:'#759cb1','#173b50ce');
    ctx.drawImage(image,1204,544,229,67,1204,544,229,67);text('USB-to-RS-485',1522,564,24);text('Adapter',1522,594,23);
    hit('tool-usb',1138,421,504,92,'เลือก USB Cable',{kind:'tool',value:'usb'});
    hit('tool-rs485',1138,524,504,94,'เลือก RS-485 Adapter',{kind:'tool',value:'rs485'});
    pin('from-laptop',1013,806,'ลากหัวสายจาก Laptop',{kind:'wire',key:'laptop'});
    pin('port-usb',638,387,'พอร์ต USB ของ PLC',null,{kind:'terminal',key:'usb'});
    pin('port-rs485',642,498,'พอร์ต RS-485 ของ PLC',null,{kind:'terminal',key:'rs485'});
    if(s.port)dashed([[1013,806],[800,848],[s.port==='usb'?638:642,s.port==='usb'?387:498]],true,7);
    panel(883,511,193,64,'#254661','#254661');text(s.connected?'Device Online':'Not connected',979,552,21,s.connected?color.green:color.text);
    button('connect',1192,695,405,69,'Connect '+tool,{kind:'connect'});
    panel(1127,807,529,112,s.connected?color.green:'#678da1',s.connected?'#064b3c':'#18364b');
    text(s.connected?'✓ Device Detected':'Device Not Connected',1391,852,31,s.connected?color.green:color.text);
    text('Interface: '+tool+'  •  '+(s.connected?'Online':'Offline'),1390,893,23);
  }
  function float(s) {
    const powered=s.wires.power==='24V' && s.wires.common==='0V';
    const index=/^DI[0-7]$/.test(s.wires.signal || '')?Number(s.wires.signal.slice(2)):-1;
    const on=powered && s.high;
    panel(1067,283,574,107,'#244c61','#102f42');
    text((powered?'☑':'☐')+'  Provide 24 VDC to float sensor',1370,316,22);
    text((index===0?'☑':'☐')+'  Wire sensor signal to DI 0',1370,348,22);
    text((s.tested?'☑':'☐')+'  Test Float → DI 0 ON',1370,380,22);
    pill(1438,478,144,38,s.high?'HIGH (ON)':'LOW (OFF)',s.high);
    for(let i=0;i<8;i++){
      const x=1091+i*69;panel(x,661,64,96,i===index && on?color.cyan:'#49687a','#163549');
      text('DI '+i,x+32,684,18);led(x+32,710,on&&i===index,12);text(on&&i===index?'ON':'OFF',x+32,750,17,on&&i===index?color.green:color.text);
    }
    panel(1069,805,576,89,s.tested?color.green:'#5d869d',s.tested?'#06483b':'#16384b');
    text(s.tested?'DI 0 is ON.':'Complete wiring and test HIGH',1349,847,26,s.tested?color.green:color.text);
    text('Float sensor • '+(powered?'24 VDC':'Power wiring required'),1350,879,20);
    pill(63,851,341,48,'Float: '+(s.high?'HIGH (ON)':'LOW (OFF)'),s.high);
    pin('float-power',539,732,'ลาก +24V ของ Sensor',{kind:'wire',key:'power'});
    pin('float-common',645,732,'ลาก 0V ของ Sensor',{kind:'wire',key:'common'});
    pin('float-signal',591,732,'ลาก SIG ของ Sensor',{kind:'wire',key:'signal'});
    pin('supply-24V',234,424,'Power Supply +24V',null,{kind:'terminal',key:'24V'});
    pin('supply-0V',272,424,'Power Supply 0V',null,{kind:'terminal',key:'0V'});
    for(let i=0;i<8;i++)pin('di-'+i,594+i*41,394,'PLC DI '+i,null,{kind:'terminal',key:'DI'+i});
    const origins={power:[539,732],common:[645,732],signal:[591,732]};
    for(const [from,to] of Object.entries(s.wires)){
      const end=to==='24V'?[234,424]:to==='0V'?[272,424]:[594+Number(to.slice(2))*41,394];
      dashed([origins[from],[origins[from][0],550],end],true,4);
    }
    ctx.save();ctx.strokeStyle='#68f4ffb0';ctx.lineWidth=4;
    ctx.beginPath();
    for(let x=80;x<406;x+=4){const y=(s.high?755:812)+Math.sin(x/18+phase*2)*3;if(x===80)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
    ctx.stroke();ctx.restore();
    hit('test-float',1270,535,308,49,'Test Float',{kind:'test'});
    button('next',1487,825,142,55,'Next',null,'next');
  }
  function output(s) {
    led(402,487,s.output,13);led(639,480,s.relay,10);
    pill(1498,559,115,37,s.output?'ON':'OFF',s.output);
    pill(1498,634,115,37,s.relay?'ON':'OFF',s.relay);
    pill(1498,708,115,41,s.motor?'RUNNING':'STOPPED',s.motor);
    hit('test-output',1246,364,389,81,'Test Output',{kind:'test'});
    hit('reset',1231,847,139,59,'Reset',null,null,null,'reset');
    hit('help',1386,847,137,59,'Help',null,null,null,'help');
    hit('back',1535,847,129,59,'Back',null,null,null,'back');
    spinning(1145,659,39,s.motor);
    if(s.output)dashed([[397,589],[397,741],[587,741],[587,583]],true,4);
  }
  const drawers={classify,sensor,plc,hmi,scada,'bench-power':power,'bench-usb':usb,'bench-float':float,'bench-output':output};
  function draw() {
    if(!run || !image?.complete)return;
    regions=[];
    ctx.save();ctx.translate(0,-crop);ctx.drawImage(image,0,0,1672,941);
    drawers[type](run.state);
    if(type==='bench-power'){
      hit('training-game',1126,4,200,65,'Training Game',null,null,null,'labs');
      hit('top-help',1334,4,165,65,'OT Basics',null,null,null,'help');
      hit('top-settings',1500,4,120,65,'Settings',null,null,null,'settings');
      hit('top-fullscreen',1622,4,50,65,'Full Screen',null,null,null,'fullscreen');
    } else if(type==='bench-float'){
      hit('lab-guide',1230,84,152,50,'Lab Guide',null,null,null,'help');
      hit('top-help',1396,84,113,50,'Help',null,null,null,'help');
      hit('top-settings',1522,84,137,50,'Settings',null,null,null,'settings');
    } else if(type==='bench-usb' || type==='bench-output'){
      const centers=type==='bench-usb'?[1305,1415,1520,1626]:[1405,1468,1532,1604];
      centers.forEach((x,i)=>hit('bench-stage-'+i,x-24,4,48,60,'Bench Stage '+(i+1),null,null,null,'bench-stage-'+i));
    } else {
      const centers=type==='sensor'?[1203,1284,1364,1444,1524,1604]:type==='plc'?[1229,1307,1385,1465,1545,1622]:type==='hmi'?[1224,1302,1383,1463,1545,1626]:[1243,1320,1397,1474,1552,1628];
      centers.forEach((x,i)=>hit('stage-'+i,x-30,3,60,77,'Stage '+(i+1),null,null,null,'stage-'+i));
    }
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
