// Recoverable retirement of obsolete public instructions/report artifacts.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const selected=['GITHUB_PAGES_올리는방법.txt','사용방법.txt','관리자_방문기록_설정방법.txt',
 'output/pdf/hvac-practical-book-video-comparison-2026-10-07.pdf',
 'output/pdf/hvac-practical-calculation-one-shot.pdf','output/pdf/hvac-practical-formula-quick-sheet.pdf',
 ...fs.readdirSync('docs').filter(name=>/\.(html|json)$/.test(name)).map(name=>`docs/${name}`)];
const backup='work/private-notes/retired-public-v59';
fs.mkdirSync(backup,{recursive:true});
const existingPath=`${backup}/manifest.json`;
const entries=fs.existsSync(existingPath)?JSON.parse(fs.readFileSync(existingPath,'utf8')).entries:[];
const apply=process.argv.includes('--apply');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for(const source of selected){
 if(!fs.existsSync(source))continue;
 const target=path.join(backup,source),entry={source,backup:target,bytes:fs.statSync(source).size,sha256:sha(source)};
 if(fs.existsSync(target))throw new Error(`Refusing to overwrite archived file: ${target}`);
 if(apply){fs.mkdirSync(path.dirname(target),{recursive:true});fs.renameSync(source,target);if(sha(target)!==entry.sha256)throw new Error(source);entries.push(entry);}
}
if(apply)fs.writeFileSync(existingPath,JSON.stringify({entries},null,2)+'\n');
console.log({apply,files:apply?entries.length:selected.filter(p=>fs.existsSync(p)).length,bytes:apply?entries.reduce((n,e)=>n+e.bytes,0):selected.filter(p=>fs.existsSync(p)).reduce((n,p)=>n+fs.statSync(p).size,0),backup});
