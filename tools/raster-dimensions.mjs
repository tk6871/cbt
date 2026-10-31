// Read existing raster headers only; never decode/recompress or alter assets.
import fs from 'node:fs';
export function rasterDimensions(path){
 const b=fs.readFileSync(path);
 if(b.length>=24&&b.toString('hex',0,8)==='89504e470d0a1a0a')return [b.readUInt32BE(16),b.readUInt32BE(20)];
 if(b.length>=10&&/^GIF8[79]a$/.test(b.toString('ascii',0,6)))return [b.readUInt16LE(6),b.readUInt16LE(8)];
 if(b.length>=12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'){
  for(let p=12;p+8<=b.length;){const type=b.toString('ascii',p,p+4),length=b.readUInt32LE(p+4),d=p+8;if(d+length>b.length)break;
   if(type==='VP8X'&&length>=10)return [b.readUIntLE(d+4,3)+1,b.readUIntLE(d+7,3)+1];
   if(type==='VP8L'&&length>=5&&b[d]===0x2f){const bits=b.readUInt32LE(d+1);return [(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1];}
   if(type==='VP8 '&&length>=10&&b.toString('hex',d+3,d+6)==='9d012a')return [b.readUInt16LE(d+6)&0x3fff,b.readUInt16LE(d+8)&0x3fff];
   p=d+length+(length%2);
  }
 }
 if(b[0]===0xff&&b[1]===0xd8){
  for(let p=2;p+4<=b.length;){if(b[p]!==0xff){p++;continue;}const marker=b[p+1];p+=2;
   if(marker===0xff){p--;continue;}if(marker===0xd9||marker===0xda)break;if(marker===0x01||marker>=0xd0&&marker<=0xd8)continue;
   const length=b.readUInt16BE(p);if(length<2||p+length>b.length)break;
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&length>=7)return [b.readUInt16BE(p+5),b.readUInt16BE(p+3)];p+=length;
  }
 }
 throw new Error(`Unsupported/corrupt raster header: ${path}`);
}
