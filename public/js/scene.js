const palette = { text:'#f0f7fa', muted:'#a9c5d6', cyan:'#62e6ed', green:'#83e7b0', amber:'#ffcb7c', red:'#ff9393' };
export function createScene({ canvas, overlay, type, onAction, onMessage }) {
  const ctx = canvas.getContext('2d');
  let run;
  let regions = [];
  let selection;
  let gesture;
  let phase = 0;
  let displayedLevel = 20;
  let displayedPosition = 0;
  let lastParcel = null;
  let frame;
  let previousTime = 0;
  let enabled = false;
  const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;

  function text(value,x,y,size=20,color=palette.text,align='center') {
    ctx.font = '600 '+size+'px system-ui';
    ctx.fillStyle=color; ctx.textAlign=align;
    ctx.fillText(value,x,y);
  }
  function rect(x,y,w,h,color='#17303e',stroke='#4b7185',radius=12) {
    ctx.fillStyle=color;ctx.strokeStyle=stroke;ctx.lineWidth=2;
    ctx.beginPath();ctx.roundRect(x,y,w,h,radius);ctx.fill();ctx.stroke();
  }
  function metal(x,y,w,h) {
    const gradient=ctx.createLinearGradient(x,y,x+w,y);
    gradient.addColorStop(0,'#365465');gradient.addColorStop(.3,'#9bb5c1');gradient.addColorStop(.55,'#557283');gradient.addColorStop(1,'#203c4d');
    rect(x,y,w,h,gradient,'#99b9c8',18);
  }
  function circle(x,y,r,color,stroke='#b7d3df') {
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=3;ctx.stroke();
  }
  function lamp(x,y,on,label) {
    circle(x,y,8,on?palette.green:'#354d59',on?palette.green:'#527080');
    text(label,x+18,y+6,16,palette.muted,'left');
  }
  function path(points,color,width=12,flow=false) {
    ctx.lineWidth=width;ctx.lineJoin='round';ctx.strokeStyle='#132c3b';
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
    ctx.lineWidth=width-5;ctx.strokeStyle=color;
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
    if(flow) {
      ctx.lineWidth=3;ctx.strokeStyle='#d5ffff';ctx.setLineDash([5,24]);ctx.lineDashOffset=-phase*40;
      ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.setLineDash([]);
    }
  }
  function rotor(x,y,r,on) {
    circle(x,y,r,on?'#15586a':'#203e4e');
    ctx.save();ctx.translate(x,y);ctx.rotate(on?phase*3:0);
    for(let i=0;i<4;i++) {ctx.rotate(Math.PI/2);rect(-5,-r+8,10,r-10,on?palette.cyan:'#7198aa','transparent',3);}
    ctx.restore();circle(x,y,7,'#dcebf1');
  }
  function tank(x,y,level,title,reading=level) {
    metal(x,y,165,280);
    ctx.save();ctx.beginPath();ctx.roundRect(x+12,y+14,141,248,8);ctx.clip();
    ctx.fillStyle='#0c2839';ctx.fillRect(x+12,y+14,141,248);
    const surface=y+262-level*2.48;
    ctx.beginPath();ctx.moveTo(x+12,y+262);ctx.lineTo(x+12,surface);
    for(let dx=0;dx<=142;dx+=4)ctx.lineTo(x+12+dx,surface+Math.sin(dx/20+phase*2)*3);
    ctx.lineTo(x+154,y+262);ctx.closePath();
    const water=ctx.createLinearGradient(0,surface,0,y+262);water.addColorStop(0,'#57dded');water.addColorStop(1,'#08748e');ctx.fillStyle=water;ctx.fill();
    ctx.restore();
    for(let i=0;i<=4;i++) {ctx.strokeStyle='#b2d4df';ctx.beginPath();ctx.moveTo(x+125,y+30+i*50);ctx.lineTo(x+145,y+30+i*50);ctx.stroke();}
    text(Math.round(reading)+'%',x+77,y+160,31);
    text(title,x+82,y-20,22,palette.cyan);
    rect(x+20,y+280,30,26,'#405f70');rect(x+115,y+280,30,26,'#405f70');
  }
  function motor(x,y,on) {
    metal(x,y,150,95);
    for(let i=0;i<6;i++){ctx.strokeStyle='#24495c';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x+20+i*17,y+15);ctx.lineTo(x+20+i*17,y+80);ctx.stroke();}
    rotor(x+155,y+48,45,on);
    rect(x+5,y+95,160,15,'#587988');
  }
  function plc(x,y) {
    metal(x,y,220,150);
    rect(x+16,y+15,188,82,'#0b2332');
    text('PLC',x+55,y+49,25,palette.cyan);
    for(let i=0;i<4;i++)lamp(x+30+i*40,y+78,Boolean(run.pump) || i===0,'');
    for(let i=0;i<8;i++)rect(x+13+i*25,y+118,16,20,'#25485a','#90b8c8',3);
  }
  function valve(x,y,on) {
    path([[x-70,y+50],[x+70,y+50]],on?palette.cyan:'#597c8e',24,on);
    ctx.fillStyle='#92b7c6';ctx.beginPath();ctx.moveTo(x-35,y+25);ctx.lineTo(x+35,y+75);ctx.lineTo(x+35,y+25);ctx.lineTo(x-35,y+75);ctx.closePath();ctx.fill();
    path([[x,y+50],[x,y-10]],'#8cb0c2',12);
    ctx.save();ctx.translate(x,y-15);ctx.rotate(on?Math.PI/2:0);
    rect(-48,-8,96,16,on?palette.green:'#f6be7c','transparent',5);ctx.restore();
    text(on?'เปิดอยู่':run.status==='passed'?'วาล์วปิดแล้ว':'คลิกเปิดวาล์ว',x,y+110,23,on?palette.green:palette.amber);
  }
  function deviceIcon(kind,x,y) {
    if(kind===0) {rect(x-52,y-38,104,65,'#203e50');rect(x-43,y-29,86,45,'#53c2db');path([[x,y+28],[x,y+46]],'#a6c8d8',12);path([[x-35,y+49],[x+35,y+49]],'#a6c8d8',10);}
    if(kind===1) {metal(x-55,y-40,110,80);rect(x-43,y-27,86,36,'#0c2638');for(let i=0;i<5;i++)lamp(x-35+i*17,y+23,i%2===0,'');}
    if(kind===2) {circle(x,y-10,34,'#ffe9a1');rect(x-16,y+21,32,24,'#87a8ba');if(motion){ctx.strokeStyle='#ffe9a1';for(let i=0;i<8;i++){const angle=i*Math.PI/4;ctx.beginPath();ctx.moveTo(x+Math.cos(angle)*44,y-10+Math.sin(angle)*44);ctx.lineTo(x+Math.cos(angle)*55,y-10+Math.sin(angle)*55);ctx.stroke();}}}
    if(kind===3) {metal(x-30,y-35,60,70);circle(x,y-3,15,palette.cyan);path([[x,y-35],[x,y-65]],'#86b8cf',6);for(let i=1;i<3;i++){ctx.strokeStyle=palette.cyan;ctx.beginPath();ctx.arc(x,y-60,15+i*12,Math.PI,Math.PI*2);ctx.stroke();}}
  }
  function add(id,x,y,w,h,label,action,drag,drop) {
    regions.push({id,x,y,w,h,label,action,drag,drop});
  }
  function port(id,x,y,label,drag,drop) {
    circle(x,y,15,drag && selection?.key===drag.key?palette.amber:palette.cyan,'#e4fbff');
    text(label,x,y-24,16,palette.cyan);
    add(id,x-25,y-25,50,50,label,null,drag,drop);
  }
  function drawClassify(s) {
    const names=['ERP','PLC','Smart light','Wireless sensor'];
    names.forEach((name,i)=>{
      const x=30+i*245;
      rect(x,85,220,210,selection?.key===String(i)?'#315366':'#172e3c');
      deviceIcon(i,x+110,155);text(name,x+110,224,21);
      text(['จัดการใบสั่งซื้อ','ควบคุมปั๊ม','ไฟอัจฉริยะในบ้าน','ตรวจการสั่นเครื่องจักร'][i],x+110,250,16,palette.muted);
      text(s.assignments[i] || 'ลากไปหมวดด้านล่าง',x+110,275,16,s.assignments[i]?palette.green:palette.muted);
      add('device-'+i,x,85,220,210,'ลาก '+name,null,{kind:'device',key:String(i)});
    });
    ['IT','OT','IoT','IIoT'].forEach((category,i)=>{
      const x=30+i*245;rect(x,395,220,165,'#0e2937',palette.cyan);
      text(category,x+110,435,30,palette.cyan);
      const placed=Object.entries(s.assignments).filter(([,value])=>value===category);
      if(!placed.length) text('วางอุปกรณ์ที่นี่',x+110,503,18);
      for(const [index,[device]] of placed.entries()) {
        ctx.save();ctx.translate(x+65+(index%2)*90,480+Math.floor(index/2)*52);ctx.scale(.45,.45);
        deviceIcon(Number(device),0,0);ctx.restore();
      }
      add('category-'+category,x,395,220,165,'วางใน '+category,null,null,{kind:'category',key:category});
    });
    text('อุปกรณ์ทำหน้าที่อะไร? ลากภาพไปวางในหมวดที่ใช่',500,40,24);
  }
  function drawBuild(s) {
    tank(760,320,displayedLevel,'PROCESS',s.level);
    deviceIcon(3,150,150);text('LEVEL SENSOR',150,240,21);
    plc(395,200);
    rect(55,390,220,145,'#325163');rect(72,407,186,104,'#102b3b');text('HMI',165,453,30,palette.cyan);text('START COMMAND',165,488,17);
    motor(760,170,run.pump);
    const src={sensor:[265,170],plc:[655,275],hmi:[300,460]};
    const dest={'PLC input':[370,225],PLC:[370,315],Pump:[740,220],HMI:[50,460]};
    for(const [from,to] of Object.entries(s.wires)) {
      const a=src[from],b=dest[to];
      ctx.strokeStyle=palette.cyan;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(...a);ctx.bezierCurveTo(a[0]+80,a[1],b[0]-80,b[1],...b);ctx.stroke();
      if(run.pump){ctx.setLineDash([6,22]);ctx.lineDashOffset=-phase*45;ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.setLineDash([]);}
    }
    for(const [key,[x,y]] of Object.entries(src))port('from-'+key,x,y,key.toUpperCase()+' OUT',{kind:'wire',key});
    for(const [key,[x,y]] of Object.entries(dest))port('to-'+key.replaceAll(' ','-'),x,y,key,null,{kind:'terminal',key});
    rect(400,60,220,65,s.power?'#235741':'#273e4b',palette.cyan);text(s.power?'● POWER ON':'คลิกเปิดระบบ',510,102,23);
    add('power',400,60,220,65,'เปิดหรือปิดระบบ',{kind:'power'});
  }
  function drawConveyor(s) {
    text('ลากกล่องขึ้นสายพาน → ตรวจสี → คัดแยก',500,45,25);
    for(let i=0;i<3;i++) {
      const x=55+i*150;
      if(!s.sorted.includes(i) && s.parcel!==i) {
        rect(x,90,115,100,i===1?'#b84b50':'#2789b7',i===1?'#ffc0b8':'#a0e2ff');
        text('BOX '+(i+1),x+57,145,20);text('ลากขึ้นสายพาน',x+57,175,14);
        add('parcel-'+i,x,90,115,100,'ลากกล่อง '+(i+1),null,{kind:'parcel',key:String(i)});
      }
    }
    rect(65,310,720,100,'#243c48','#8eafbe',35);
    ctx.save();ctx.beginPath();ctx.roundRect(73,318,704,84,28);ctx.clip();
    for(let i=-1;i<20;i++){const x=80+i*42+(s.moving?phase*45%42:0);path([[x,322],[x,398]],'#587b8d',8);}
    ctx.restore();rotor(110,360,33,s.moving);rotor(738,360,33,s.moving);
    rect(80,420,22,135,'#536f7f');rect(725,420,22,135,'#536f7f');
    rect(80,220,180,65,'#173d50',palette.cyan);text('วางกล่องที่นี่ ↓',170,260,21,palette.cyan);
    add('belt-load',65,215,240,190,'วางกล่องบนสายพาน',null,null,{kind:'belt',key:'load'});
    if(s.parcel!==null) {
      const x=145+displayedPosition*110;
      rect(x,260,85,75,s.parcel===1?'#b84b50':'#2789b7');
      text('BOX '+(s.parcel+1),x+42,305,18);
    }
    rect(450,200,70,65,'#456574');circle(485,240,18,s.parcel!==null&&s.position>=2?(s.parcel===1?palette.red:palette.cyan):'#213c4c');
    text('COLOR SENSOR',485,185,19,palette.cyan);
    path([[485,266],[485,310]],s.parcel!==null&&s.position>=2?palette.red:'#3b626f',5);
    rect(815,230,150,120,'#184b43',palette.green);text('GOOD',890,282,25,palette.green);
    rect(815,440,150,120,'#5c3036',palette.red);text('REJECT',890,493,24,palette.red);
    text(s.sorted.filter(id=>id!==1).length+' กล่อง',890,324,18,palette.green);
    text(s.sorted.includes(1)?'1 กล่อง':'0 กล่อง',890,535,18,palette.red);
    path([[730,360],[810,s.gate==='good'?290:490]],palette.amber,18);
    text('คลิกแขนคัดแยก',700,205,21,palette.amber);
    add('gate',660,210,155,270,'เปลี่ยนทิศทางแขนคัดแยก',{kind:'gate'});
    motor(340,460,s.moving);text('คลิกมอเตอร์ '+(s.moving?'STOP':'START'),430,610,22,palette.cyan);
    add('motor',325,440,240,175,'เริ่มหรือหยุดมอเตอร์สายพาน',{kind:'motor'});
    text(s.last || 'กล่องน้ำเงิน → GOOD • กล่องแดง → REJECT',500,635,17,s.last.includes('ผิด')?palette.red:palette.green);
  }
  function drawProcess(s) {
    if(type==='scada') {
      tank(90,160,displayedLevel,'RTU / STATION A',s.level);
      deviceIcon(3,400,180);
      for(let i=0;i<4;i++) {ctx.strokeStyle=s.connected?palette.cyan:'#47616f';ctx.globalAlpha=s.connected ? .4+.6*Math.sin(phase*2+i)**2 : .4;ctx.beginPath();ctx.arc(450,240,50+i*22,-.8,.8);ctx.stroke();ctx.globalAlpha=1;}
      rect(650,140,285,215,'#2b4b5e');rect(668,157,249,175,'#092b3b');text('SCADA',790,200,30,palette.cyan);text(s.remote+'%',790,265,44,s.remote>=run.target?palette.amber:palette.green);text(s.remote>=run.target?'HIGH ALARM':'NORMAL',790,310,22);
      text('คลิกถัง +5%',170,520,24,palette.cyan);add('level',80,140,190,390,'เพิ่มระดับสถานีทีละ 5%',{kind:'level',value:(s.level+5)%105});
      rect(310,410,260,75,s.connected?'#1f4d43':'#5b3036');text(s.connected?'คลิกตัดการสื่อสาร':'คลิกเชื่อมต่อกลับ',440,456,23);
      add('connection',310,410,260,75,'ตัดหรือเชื่อมต่อการสื่อสาร',{kind:'connection'});
      rect(650,410,285,75,'#1c4659',palette.cyan);text('คลิกส่งข้อมูล →',793,456,24);
      add('send',650,410,285,75,'ส่งข้อมูลเข้า SCADA',{kind:'send'});
      return;
    }
    tank(60,160,type==='plc'?(s.source?80:5):80,'SUPPLY');
    tank(755,160,type==='plc'?(s.full?100:30):type==='sensor'?displayedLevel:45,'PROCESS',type==='sensor'?s.level:type==='plc'?(s.full?100:30):45);
    const on=type==='sensor'?s.valve:run.pump;
    path([[225,360],[380,360],[620,360],[755,360]],on?palette.cyan:'#4b7185',24,on);
    if(type==='sensor') {
      valve(500,310,s.valve);add('valve',400,260,200,190,'เปิดหรือปิดวาล์ว',{kind:'valve'});
      text('คลิกที่ด้ามวาล์ว แล้วสังเกตระดับน้ำ',500,75,27,palette.cyan);
      text('เป้าหมาย '+run.target+'% — ปิดวาล์วเมื่อถึงระดับ',500,565,23,palette.amber);
    } else {
      motor(420,305,on);
      add('pump',410,300,215,135,'กด START หรือ STOP ที่ตัวมอเตอร์',{kind:s.command?'stop':'start'});
      text(on?'มอเตอร์กำลังหมุน':'คลิกมอเตอร์เพื่อ START',520,475,22,on?palette.green:palette.cyan);
      if(type==='plc') {
        plc(385,85);
        add('source',45,145,195,340,'เปลี่ยนสัญญาณน้ำต้นทาง',{kind:'source'});
        add('full',740,145,195,340,'จำลองถังรับเต็ม',{kind:'full'});
        text('คลิกถังเปลี่ยน INPUT',500,565,22,palette.cyan);
        circle(675,120,36,s.emergency?palette.red:'#b33139');text('E-STOP',675,184,17,palette.red);
        add('emergency',630,75,90,110,'กดหรือปล่อย Emergency Stop',{kind:'emergency'});
      } else {
        rect(330,65,365,180,'#345468');rect(350,85,325,135,'#102a3a');text('HMI / คลิก START',510,118,22,palette.cyan);
        text(s.alarm?'ALARM: NO FEEDBACK':on?'RUNNING':s.command?'WAITING FEEDBACK':'STOPPED',510,158,21,s.alarm?palette.red:palette.green);
        rect(380,180,110,28,'#23644c');text('START',435,201,16);
        rect(520,180,110,28,'#754047');text('STOP',575,201,16);
        add('start',360,170,140,60,'START บนจอ HMI',{kind:'start'});add('stop',510,170,140,60,'STOP บนจอ HMI',{kind:'stop'});
        rect(50,530,290,65,s.feedback?'#1e5543':'#293f4b');text('คลิก FEEDBACK '+(s.feedback?'ON':'OFF'),195,572,21);
        add('feedback',50,530,290,65,'เปิดหรือปิด feedback จากอุปกรณ์',{kind:'feedback'});
        rect(675,530,280,65,s.alarm?'#75402d':'#263c49');text('คลิก ACK ALARM',815,572,22,s.alarm?palette.amber:palette.muted);
        add('ack',675,530,280,65,'รับทราบ alarm',{kind:'ack'});
      }
    }
  }
  function draw() {
    if(!run)return;
    regions=[];
    ctx.clearRect(0,0,1000,640);
    const bg=ctx.createLinearGradient(0,0,0,640);bg.addColorStop(0,'#193545');bg.addColorStop(1,'#091d2b');ctx.fillStyle=bg;ctx.fillRect(0,0,1000,640);
    ctx.strokeStyle='#244656';ctx.lineWidth=1;
    for(let x=0;x<1000;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,640);ctx.stroke();}
    for(let y=0;y<640;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1000,y);ctx.stroke();}
    if(type==='classify')drawClassify(run.state);
    else if(type==='build')drawBuild(run.state);
    else if(type==='conveyor')drawConveyor(run.state);
    else drawProcess(run.state);
    if(gesture?.moved && gesture.source.drag) {
      ctx.save();ctx.globalAlpha=.85;
      if(gesture.source.drag.kind==='wire'){
        path([[gesture.source.x+gesture.source.w/2,gesture.source.y+gesture.source.h/2],[gesture.current.x,gesture.current.y]],palette.amber,6);
      } else {
        rect(gesture.current.x-55,gesture.current.y-35,110,70,'#27566a',palette.amber);text(gesture.source.drag.kind==='parcel'?'BOX '+(Number(gesture.source.drag.key)+1):'อุปกรณ์',gesture.current.x,gesture.current.y+8,18);
      }
      ctx.restore();
    }
  }
  function activate(region) {
    if(!enabled)return;
    if(region.action)onAction(region.action);
    else if(region.drag) {selection=region.drag;onMessage('เลือกแล้ว คลิกจุดปลายทางบนภาพ หรือจับลากไปวาง');draw();}
    else if(region.drop && selection)drop(selection,region.drop);
    else if(region.drop)onMessage('เลือกหรือลากอุปกรณ์จากด้านบนก่อน');
  }
  function drop(source,destination) {
    if(source.kind==='device' && destination.kind==='category')onAction({kind:'assign',device:Number(source.key),category:destination.key});
    else if(source.kind==='wire' && destination.kind==='terminal')onAction({kind:'wire',from:source.key,to:destination.key});
    else if(source.kind==='parcel' && destination.kind==='belt')onAction({kind:'load',parcel:Number(source.key)});
    else {onMessage('จุดวางนี้ไม่ตรงกับอุปกรณ์ ลองจุดที่มีกรอบหรือขั้วรับ');return;}
    selection=undefined;
  }
  function position(event) {
    const bounds=canvas.getBoundingClientRect();
    return {x:(event.clientX-bounds.left)*1000/bounds.width,y:(event.clientY-bounds.top)*640/bounds.height};
  }
  function hit(point) {return [...regions].reverse().find(r=>point.x>=r.x&&point.x<=r.x+r.w&&point.y>=r.y&&point.y<=r.y+r.h);}
  const stage=canvas.parentElement;
  stage.addEventListener('pointerdown',event=>{
    if(!enabled || event.button!==0)return;
    const point=position(event),source=hit(point);
    if(!source)return;
    event.preventDefault();
    gesture={source,start:point,current:point,moved:false,id:event.pointerId};
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove',event=>{
    if(!gesture)return;
    gesture.current=position(event);
    gesture.moved ||= Math.hypot(gesture.current.x-gesture.start.x,gesture.current.y-gesture.start.y)>10;
    stage.classList.toggle('dragging',gesture.moved);
    for(const button of overlay.children)button.classList.toggle('drop-ready',Boolean(gesture.source.drag && regions.find(r=>r.id===button.dataset.hit)?.drop));
  });
  stage.addEventListener('pointerup',event=>{
    if(!gesture)return;
    const current=gesture;gesture=undefined;stage.classList.remove('dragging');
    for(const button of overlay.children)button.classList.remove('drop-ready');
    if(current.moved && current.source.drag) {
      const destination=hit(position(event));
      if(destination?.drop)drop(current.source.drag,destination.drop);
      else onMessage('วางบนกรอบหมวดหมู่ ขั้วรับ หรือบริเวณรับกล่องบนสายพาน');
    } else if(!current.moved) activate(current.source);
    draw();
  });
  stage.addEventListener('pointercancel',()=>{gesture=undefined;stage.classList.remove('dragging');for(const b of overlay.children)b.classList.remove('drop-ready');});
  overlay.addEventListener('click',event=>{
    // Pointer gestures are handled above. Keyboard / assistive clicks have detail=0.
    if(event.detail!==0)return;
    const region=regions.find(r=>r.id===event.target.dataset.hit);
    if(region)activate(region);
  });
  function syncHotspots() {
    overlay.replaceChildren(...regions.map(region=>{
      const button=document.createElement('button');
      button.type='button';button.className='scene-hit';button.dataset.hit=region.id;
      button.setAttribute('aria-label',region.label);button.title=region.label;
      button.style.left=region.x/10+'%';button.style.top=region.y/6.4+'%';button.style.width=region.w/10+'%';button.style.height=region.h/6.4+'%';
      button.disabled=!enabled;return button;
    }));
  }
  function animate(time) {
    const delta=Math.min((time-previousTime)/1000,.05);previousTime=time;
    if(motion && !document.hidden)phase+=delta;
    if(run){displayedPosition += ((run.state.position || 0)-displayedPosition)*Math.min(1,delta*5);const level=run.state.level ?? 20;displayedLevel += (level-displayedLevel)*Math.min(1,delta*5);draw();}
    frame=requestAnimationFrame(animate);
  }
  frame=requestAnimationFrame(animate);
  return {
    update(next) {if(next.state.parcel!==lastParcel){displayedPosition=0;lastParcel=next.state.parcel;}run=next;draw();syncHotspots();},
    setEnabled(value) {enabled=value;for(const button of overlay.children)button.disabled=!value;},
    destroy() {cancelAnimationFrame(frame);}
  };
}
