// Run on the Mac. Private intermediate OCR/cache files are never deployed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';

const directory = 'work/private-notes/image-text';
const banks = ['electric-craftsman','energy-book-earlier','energy-engineer','energy-midterm','energy-restored','energy-textbook','energy','forklift-craftsman','gas-craftsman','hazardous-craftsman','hvac-hansol-book','hvac-hansol','hvac','information-engineer','jewelry','maintenance-engineer','maintenance','safety'];
const mapping = JSON.parse(fs.readFileSync('data/problem-images-webp90.json','utf8')).mappings;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const entries = new Map();
const unique = new Map();
const counts = {};
function add(original, kind, number, bank, figure) {
  if (!original?.startsWith('assets/')) return;
  if (entries.has(original)) {
    if (figure) entries.get(original).figure = true;
    if (entries.get(original).kind !== kind) entries.get(original).figure = true;
    return;
  }
  const asset = mapping[original] || original;
  const digest = sha(fs.readFileSync(asset));
  const id = unique.get(digest)?.id || sha(original).slice(0,24);
  if (!unique.has(digest)) unique.set(digest,{id,path:path.resolve(asset)});
  entries.set(original,{id,original,asset,sha256:digest,kind,number,bank,figure});
  counts[bank]=(counts[bank]||0)+1;
}
// Energy pilot first so its exact SHA-checked cache IDs can be reused.
banks.splice(banks.indexOf('energy-textbook'),1);
banks.unshift('energy-textbook');
for (const bank of banks) {
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync(`data/${bank}.js`,'utf8'),context);
  for (const catalog of Object.values(context.window).flat()) for (const round of catalog.rounds||[]) for (const q of round.questions||[]) {
    const number=q._originalNumber||q.number;
    const figure=Boolean(q.images?.some(src=>src!==q.sourceImage)||q.choices?.some(c=>c.images?.length||/<img\b/i.test(c.html||'')));
    add(q.sourceImage,'question',number,bank,figure);
    for (const image of q.explanationImages||[]) add(image,'explanation',number,bank,(q.explanationImages?.length||0)>1);
  }
}
const corrections=JSON.parse(fs.readFileSync('data/textbook-pages.json','utf8')).entries;
for (const row of corrections) if (row.correction?.asset) add(row.correction.asset,'question',row.number,'textbook-corrections',false);
fs.mkdirSync(directory,{recursive:true});
fs.writeFileSync(`${directory}/catalog-inputs.json`,JSON.stringify([...entries.values()],null,2)+'\n');
const rows=[...unique.values()];
for(let i=0;i<2;i++) fs.writeFileSync(`${directory}/catalog-manifest-${i}.json`,JSON.stringify(rows.filter((_,n)=>n%2===i))+'\n');
console.log({images:entries.size,uniqueImages:rows.length,counts});
