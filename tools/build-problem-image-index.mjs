import fs from 'node:fs';
const source=JSON.parse(fs.readFileSync('data/problem-images-webp90.json','utf8')).mappings;
const dirs=new Map();
for (const [path,target] of Object.entries(source)) {
  const slash=path.lastIndexOf('/'), dir=path.slice(0,slash), name=path.slice(slash+1);
  const hash=/^assets\/problem-webp90\/([a-f0-9]{32})\.webp$/.exec(target)?.[1];
  if (slash<0||!name||name.includes('\n')||!hash) throw new Error(`Invalid mapping: ${path}`);
  const group=dirs.get(dir)||{names:[],hashes:[]};
  group.names.push(name);group.hashes.push(hash);dirs.set(dir,group);
}
const output=JSON.stringify([...dirs].map(([dir,{names,hashes}])=>[dir,names.join('\n'),hashes.join('')]))+'\n';
const path='data/problem-image-index.json';
if (process.argv.includes('--check')) {
  if (fs.readFileSync(path,'utf8')!==output) throw new Error('Packed WebP index is out of date');
} else fs.writeFileSync(path,output);
console.log({paths:Object.keys(source).length,dirs:dirs.size,bytes:Buffer.byteLength(output)});
