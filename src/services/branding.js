import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {httpError} from './security.js';
export const MAX_LOGO_BYTES=2*1024*1024;
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
// The browser normalizes JPG/WEBP/PNG to a metadata-free, non-interlaced PNG.
export function validateLogo(bytes){
 const bad=()=>{throw httpError(400,'ไฟล์ภาพไม่ถูกต้อง กรุณาเลือก PNG, JPG หรือ WEBP แล้วอัปโหลดใหม่');};
 if(!Buffer.isBuffer(bytes)||bytes.length<57||bytes.length>MAX_LOGO_BYTES||!bytes.subarray(0,8).equals(signature))bad();
 let offset=8,width,height,channels,ended=false,seenHeader=false;const data=[];
 while(offset+12<=bytes.length){const length=bytes.readUInt32BE(offset),end=offset+12+length;if(end>bytes.length)bad();const kind=bytes.toString('ascii',offset+4,offset+8);if(crc32(bytes.subarray(offset+4,end-4))!==bytes.readUInt32BE(end-4))bad();const body=bytes.subarray(offset+8,end-4);
  if(!seenHeader&&kind!=='IHDR')bad();
  if(kind==='IHDR'){if(seenHeader||length!==13)bad();seenHeader=true;width=body.readUInt32BE(0);height=body.readUInt32BE(4);channels={0:1,2:3,4:2,6:4}[body[9]];if(!width||!height||width>2048||height>2048||body[8]!==8||!channels||body[10]||body[11]||body[12])bad();}
  else if(kind==='IDAT')data.push(body);
  else if(kind==='IEND'){if(length||end!==bytes.length||!data.length)bad();ended=true;break;}
  else if(kind[0]===kind[0].toUpperCase())bad();
  offset=end;
 }
 if(!ended)bad();const stride=width*channels+1;let pixels;try{pixels=inflateSync(Buffer.concat(data),{maxOutputLength:stride*height});}catch{bad();}if(pixels.length!==stride*height)bad();for(let y=0;y<height;y++)if(pixels[y*stride]>4)bad();
 return {image:bytes,mime:'image/png',digest:createHash('sha256').update(bytes).digest('hex'),width,height};
}
