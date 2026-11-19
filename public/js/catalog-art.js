import {industrialMap} from './industrial-content.js';
// Photo-only rectangles exclude the clean control space in the training artwork.
export const photoCrops={classify:[0,116,736,551],sensor:[0,112,1340,829],plc:[85,118,713,805],hmi:[0,108,792,804],scada:[294,112,810,829],'bench-power':[0,103,1110,838],'bench-usb':[0,116,1107,825],'bench-float':[100,112,917,812],'bench-output':[45,119,1025,811]};
export function drawCover(ctx,img,type,w,h,backdrop){
 let crop=photoCrops[type];
 if(industrialMap[type]||type==='conveyor'){
  const index=industrialMap[type]?.art??8,cw=img.naturalWidth/4,ch=img.naturalHeight/3;
  ctx.fillStyle='#173446';ctx.fillRect(0,0,w,h);if(backdrop){const scale=Math.max(w/backdrop.width,h/backdrop.height);const sw=w/scale,sh=h/scale;ctx.drawImage(backdrop,(backdrop.width-sw)/2,(backdrop.height-sh)/2,sw,sh,0,0,w,h);ctx.fillStyle='#09233377';ctx.fillRect(0,0,w,h);}const size=Math.min(w*.90,h*1.45);ctx.drawImage(img,index%4*cw,Math.floor(index/4)*ch,cw,ch,(w-size)/2,(h-size)/2,size,size);return;
 }
 if(!crop)crop=[0,0,img.naturalWidth,img.naturalHeight];
 let [sx,sy,sw,sh]=crop;const scale=Math.max(w/sw,h/sh),visibleW=w/scale,visibleH=h/scale;sx+=(sw-visibleW)/2;sy+=(sh-visibleH)/2;ctx.drawImage(img,sx,sy,visibleW,visibleH,0,0,w,h);
}
