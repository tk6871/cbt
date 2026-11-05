import fs from 'node:fs';
import crypto from 'node:crypto';
const directory = 'work/private-notes/image-text';
const inputs = JSON.parse(fs.readFileSync(`${directory}/inputs.json`, 'utf8'));
const reviewed = JSON.parse(fs.readFileSync('tools/image-text-reviewed.json','utf8')).entries;
const markers = '①②③④';
function questionText(text, number) {
  // Never flatten a referenced figure/table or a calculation into plain OCR.
  if (/그림|선도|도표|회로|다음\s*표|표에서|계산|공식|구하[여시오는]|몇\s*(?:k|Pa|W|kg|℃|m)/i.test(text)) return undefined;
  const matches = [...text.matchAll(/[①②③④]/g)];
  if (matches.length !== 4 || new Set(matches.map(m=>m[0])).size !== 4) return undefined;
  const stem = text.slice(0,matches[0].index).replace(new RegExp(`^\\s*0?${number}\\s*[.)]?\\s*`),'').trim();
  const choices = Array(4).fill('');
  matches.forEach((m,i)=>{choices[markers.indexOf(m[0])] = text.slice(m.index+1,matches[i+1]?.index??text.length).trim();});
  if (stem.length < 5 || choices.some(t=>t.length<2)) return undefined;
  return {stem,choices};
}
const entries = {};
for (const input of inputs) {
  const raw = JSON.parse(fs.readFileSync(`${directory}/ocr/${input.id}.json`,'utf8'));
  const sha = crypto.createHash('sha256').update(fs.readFileSync(input.asset)).digest('hex');
  if (sha !== raw.sha256 || sha !== input.sha256) throw new Error(`Changed image: ${input.original}`);
  const text = raw.rows.map(r=>r.text).join('\n').replace(/^\s*해설\s*\n/,'').trim();
  const manual = reviewed[input.original];
  if (manual && manual.sha256 !== sha) throw new Error(`Reviewed source changed: ${input.original}`);
  const score = raw.rows.reduce((s,r)=>s+r.score,0)/Math.max(1,raw.rows.length);
  const graphics = /그림|선도|도표|회로|다음\s*표|표에서/.test(text);
  const question = manual?.question || (input.kind==='question' ? questionText(text,input.number) : undefined);
  entries[input.original] = {asset:input.asset,sha256:sha,kind:input.kind,
    status:manual?'reviewed':'provisional', text:manual?.text||text,
    ...(question?{question}:{}), eligible:!!manual||(input.kind==='question'?!!question:!graphics&&text.length>=15&&score>=.8),
    ...(manual?{basis:manual.basis}:{})};
}
const result = {schemaVersion:1,note:'OCR 임시 전사. reviewed만 직접 원문 대조. 도표·계산식은 임의 치환하지 않음. 원문 이미지와 정답·기록은 유지.',entries};
const output = JSON.stringify(result)+'\n';
if (process.argv.includes('--check')) {
  if (fs.readFileSync('data/image-text-candidates.json','utf8') !== output) throw new Error('Published image text differs from verified source bytes');
} else fs.writeFileSync('data/image-text-candidates.json',output);
console.log({entries:Object.keys(entries).length,reviewed:Object.values(entries).filter(e=>e.status==='reviewed').length,
  questions:Object.values(entries).filter(e=>e.kind==='question'&&e.eligible).length,
  explanations:Object.values(entries).filter(e=>e.kind==='explanation'&&e.eligible).length,bytes:Buffer.byteLength(output),check:process.argv.includes('--check')});
