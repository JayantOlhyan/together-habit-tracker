import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await cp('lib/model.mjs', 'dist/model.mjs');
// Generate exact raster app icons without an external graphics dependency.
function crc32(b){let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^(0xedb88320&-(c&1));}return (c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([length,t,data,crc]);}
function png(size){const row=size*4+1,raw=Buffer.alloc(row*size);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const dx=x/size-.5,dy=y/size-.5,r=Math.hypot(dx,dy);const line=(Math.abs(dx)<.039||Math.abs(dy)<.039||Math.abs(dx-dy)<.055||Math.abs(dx+dy)<.055)&&r<.28&&r>.085;const color=line?[216,235,139]:[36,75,57];const i=y*row+1+x*4;raw[i]=color[0];raw[i+1]=color[1];raw[i+2]=color[2];raw[i+3]=255;}const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
for(const size of [192,512])await writeFile(`dist/icon-${size}.png`,png(size));
console.log('Built Together into dist/');
