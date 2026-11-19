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
  let atlas;
  let backdrop;
  const spriteBounds = [
    [86,7,202,351],[376,72,330,239],[742,71,324,242],[1107,85,319,194],
    [11,415,342,257],[383,401,322,294],[813,389,179,308],[1180,366,191,331],
    [0,827,362,194],[393,780,301,252],[754,780,302,252],[1092,769,350,257]
  ];
  function loadImage(url) {
    return new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>resolve(image);
      image.onerror=()=>reject(new Error('โหลดภาพอุปกรณ์ไม่สำเร็จ กรุณาโหลดหน้าใหม่'));
      image.src=url;
    });
  }
  const ready=Promise.all([
    loadImage('/assets/images/game/equipment-atlas.png'),
    loadImage('/assets/images/game/workshop.png')
  ]).then(images=>{
    [atlas,backdrop]=images;
    canvas.dataset.assets='ready';
  });
  function sprite(index,x,y,w,h,opacity=1) {
    if(!atlas)return;
    const [sx,sy,sw,sh]=spriteBounds[index];
    ctx.save();ctx.globalAlpha=opacity;
    ctx.drawImage(atlas,sx,sy,sw,sh,x,y,w,h);
    ctx.restore();
  }
  function glow(x,y,w,h,on=true) {
    if(!on)return;
    ctx.save();ctx.shadowColor=palette.cyan;ctx.shadowBlur=20;
    ctx.strokeStyle='#76e6ec99';ctx.lineWidth=2;
    ctx.beginPath();ctx.roundRect(x,y,w,h,12);ctx.stroke();ctx.restore();
  }
  function displayPanel(x,y,w,h) {
    sprite(4,x,y,w,h);
  }


  function text(value,x,y,size=20,color=palette.text,align='center') {
    ctx.font = '600 '+size+'px system-ui';
    ctx.fillStyle=color; ctx.textAlign=align;
    ctx.fillText(value,x,y);
  }
  function rect(x,y,w,h,color='#17303e',stroke='#4b7185',radius=12) {
    ctx.fillStyle=color;ctx.strokeStyle=stroke;ctx.lineWidth=2;
    ctx.beginPath();ctx.roundRect(x,y,w,h,radius);ctx.fill();ctx.stroke();
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
  function tank(x,y,level,title,reading=level) {
    sprite(0,x-6,y-10,177,314);
    // The water mask fits inside the glass window of the generated tank sprite.
    const glass={x:x+28,y:y+71,w:112,h:145};
    const surface=glass.y+glass.h-level*glass.h/100;
    ctx.save();ctx.beginPath();ctx.roundRect(glass.x,glass.y,glass.w,glass.h,8);ctx.clip();
    ctx.beginPath();ctx.moveTo(glass.x,glass.y+glass.h);ctx.lineTo(glass.x,surface);
    for(let dx=0;dx<=glass.w;dx+=4)ctx.lineTo(glass.x+dx,surface+Math.sin(dx/16+phase*2)*2);
    ctx.lineTo(glass.x+glass.w,glass.y+glass.h);ctx.closePath();
    const water=ctx.createLinearGradient(0,surface,0,glass.y+glass.h);
    water.addColorStop(0,'#66eff7d9');water.addColorStop(1,'#087b9bcf');
    ctx.fillStyle=water;ctx.fill();
    ctx.strokeStyle='#d7ffff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(glass.x,surface);ctx.lineTo(glass.x+glass.w,surface);ctx.stroke();
    ctx.restore();
    text(Math.round(reading)+'%',x+82,y+157,27);
    text(title,x+82,y-25,21,palette.cyan);
  }
  function motor(x,y,on) {
    sprite(1,x-20,y-22,230,150);
    if(on) {
      ctx.save();ctx.translate(x+179,y+52);ctx.rotate(phase*3);
      ctx.strokeStyle='#bde9efcc';ctx.lineWidth=3;
      for(let i=0;i<5;i++){
        ctx.rotate(Math.PI*2/5);ctx.beginPath();ctx.moveTo(4,0);ctx.quadraticCurveTo(24,-12,31,0);ctx.stroke();
      }
      ctx.restore();glow(x-20,y-22,230,150);
    }
  }
  function plc(x,y) {
    sprite(2,x-10,y-10,240,170);
    lamp(x+42,y+65,true,'');
    lamp(x+65,y+65,Boolean(run.pump),'');
  }
  function valve(x,y,on) {
    sprite(3,x-100,y-35,200,130);
    path([[x-115,y+50],[x-100,y+50]],on?palette.cyan:'#789aaa',15,on);
    path([[x+100,y+50],[x+115,y+50]],on?palette.cyan:'#789aaa',15,on);
    glow(x-103,y-38,206,136,on);
    text(on?'เปิดอยู่':run.status==='passed'?'วาล์วปิดแล้ว':'คลิกเปิดวาล์ว',x,y+115,23,on?palette.green:palette.amber);
  }
  function deviceIcon(kind,x,y) {
    const item=[5,2,6,7][kind];
    const dimensions=[[145,120],[145,110],[77,125],[80,135]][kind];
    sprite(item,x-dimensions[0]/2,y-dimensions[1]/2,...dimensions);
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
    tank(760,335,displayedLevel,'PROCESS',s.level);
    deviceIcon(3,150,150);text('LEVEL SENSOR',150,240,21);
    plc(395,200);
    displayPanel(45,380,240,165);text('HMI',165,450,28,palette.cyan);text('START COMMAND',165,483,16);
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
        sprite(i===1?10:9,x,85,115,100);
        text('BOX '+(i+1),x+57,158,17);text('ลากขึ้นสายพาน',x+57,205,15);
        add('parcel-'+i,x,90,115,100,'ลากกล่อง '+(i+1),null,{kind:'parcel',key:String(i)});
      }
    }
    sprite(8,65,300,720,280);
    ctx.save();ctx.beginPath();ctx.roundRect(100,323,630,53,8);ctx.clip();
    ctx.strokeStyle='#82a8b355';ctx.lineWidth=2;
    for(let i=-1;i<22;i++){const x=100+i*35+(s.moving?phase*45%35:0);ctx.beginPath();ctx.moveTo(x,327);ctx.lineTo(x+12,365);ctx.stroke();}
    ctx.restore();
    rect(80,220,180,65,'#173d50',palette.cyan);text('วางกล่องที่นี่ ↓',170,260,21,palette.cyan);
    add('belt-load',65,215,240,190,'วางกล่องบนสายพาน',null,null,{kind:'belt',key:'load'});
    if(s.parcel!==null) {
      const x=145+displayedPosition*110;
      sprite(s.parcel===1?10:9,x,260,85,75);
      text('BOX '+(s.parcel+1),x+42,308,16);
    }
    sprite(7,450,187,70,105);circle(485,247,8,s.parcel!==null&&s.position>=2?(s.parcel===1?palette.red:palette.cyan):'#213c4c');
    text('COLOR SENSOR',485,185,19,palette.cyan);
    path([[485,266],[485,310]],s.parcel!==null&&s.position>=2?palette.red:'#3b626f',5);
    rect(815,230,150,120,'#184b43',palette.green);text('GOOD',890,282,25,palette.green);
    rect(815,440,150,120,'#5c3036',palette.red);text('REJECT',890,493,24,palette.red);
    text(s.sorted.filter(id=>id!==1).length+' กล่อง',890,324,18,palette.green);
    text(s.sorted.includes(1)?'1 กล่อง':'0 กล่อง',890,535,18,palette.red);
    sprite(11,655,235,160,135);
    path([[745,352],[810,s.gate==='good'?290:490]],palette.amber,6);
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
      displayPanel(640,125,305,245);text('SCADA',790,200,28,palette.cyan);text(s.remote+'%',790,265,44,s.remote>=run.target?palette.amber:palette.green);text(s.remote>=run.target?'HIGH ALARM':'NORMAL',790,310,22);
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
        displayPanel(325,50,375,220);text('HMI / คลิก START',510,118,22,palette.cyan);
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
    if(backdrop)ctx.drawImage(backdrop,0,0,1000,640);
    ctx.fillStyle='#07172550';ctx.fillRect(0,0,1000,640);
    if(type==='classify')drawClassify(run.state);
    else if(type==='build')drawBuild(run.state);
    else if(type==='conveyor')drawConveyor(run.state);
    else drawProcess(run.state);
    if(gesture?.moved && gesture.source.drag) {
      ctx.save();ctx.globalAlpha=.85;
      if(gesture.source.drag.kind==='wire'){
        path([[gesture.source.x+gesture.source.w/2,gesture.source.y+gesture.source.h/2],[gesture.current.x,gesture.current.y]],palette.amber,6);
      } else {
        if(gesture.source.drag.kind==='parcel')sprite(Number(gesture.source.drag.key)===1?10:9,gesture.current.x-55,gesture.current.y-45,110,90);
        else deviceIcon(Number(gesture.source.drag.key),gesture.current.x,gesture.current.y);
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
    ready,
    update(next) {if(next.state.parcel!==lastParcel){displayedPosition=0;lastParcel=next.state.parcel;}run=next;draw();syncHotspots();},
    setEnabled(value) {enabled=value;for(const button of overlay.children)button.disabled=!value;},
    destroy() {cancelAnimationFrame(frame);}
  };
}
