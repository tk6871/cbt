// Original-resolution QA sources are local-only after the WebP90 migration.
import fs from 'node:fs';
export function sourceAssetPath(file){
 if(fs.existsSync(file))return file;
 if(typeof file==='string'&&file.startsWith('assets/')&&!file.split('/').includes('..')){
  const archived=`work/problem-webp90/originals/${file}`;
  if(fs.existsSync(archived))return archived;
 }
 return file;
}
