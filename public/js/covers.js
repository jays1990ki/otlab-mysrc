import {drawCover} from './catalog-art.js';
const background=new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src='/assets/images/game/workshop.png';});
for(const img of document.querySelectorAll('img.lab-cover')){
 const paint=async()=>{const backdrop=await background;const canvas=document.createElement('canvas');canvas.width=820;canvas.height=350;canvas.className='lab-cover';canvas.dataset.simulator=img.dataset.simulator;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',img.alt||'ภาพอุปกรณ์ LAB');drawCover(canvas.getContext('2d'),img,img.dataset.simulator,820,350,backdrop);img.replaceWith(canvas);};
 if(img.complete&&img.naturalWidth)paint();else img.addEventListener('load',paint,{once:true});
}
