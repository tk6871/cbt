import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const context={window:{}};
vm.runInNewContext(fs.readFileSync('data/energy-midterm.js','utf8'),context);
const paths=[...new Set(context.window.CBT_DATA_ENERGY_MIDTERM.rounds.flatMap(r=>r.questions.map(q=>q.sourceImage).filter(Boolean)))].map(p=>path.resolve(p));
fs.mkdirSync('work/energy-answer-geometry',{recursive:true});
fs.writeFileSync('work/energy-answer-geometry/inputs.json',JSON.stringify(paths,null,2)+'\n');
console.log(`${paths.length} original image references; catalog unchanged`);
if(process.argv.includes('--harness'))fs.writeFileSync('work/energy-answer-geometry/harness.html',`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"></head><body><div id="review"></div><script src="data/energy-midterm.js"></script><script type="module">
import {mountEnergyCard} from '/tools/energy-card-harness.tsx';
import {loadCatalogs} from '/src/cbt/catalog.ts';
const catalog=loadCatalogs().find(c=>c.key==='energy-midterm');const items=catalog.rounds.flatMap(round=>round.questions.filter(q=>q.sourceImage).map(question=>({round,question,subject:'에너지설비',id:round.id+':'+question.number})));
window.review = mountEnergyCard(items);
</script><style>body{margin:16px;background:#f2f4f8}#review{max-width:720px;margin:auto}.question-card{width:100%;box-sizing:border-box}</style></body></html>`);
