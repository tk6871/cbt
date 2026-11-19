import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const context={window:{}};
vm.runInNewContext(fs.readFileSync('data/energy-textbook.js','utf8'),context);
const paths=context.window.CBT_DATA_ENERGY_TEXTBOOK.rounds.flatMap(r=>r.questions.map(q=>path.resolve(q.sourceImage)));
const work='work/energy-textbook/answer-geometry';
fs.mkdirSync(work,{recursive:true});
fs.writeFileSync(`${work}/inputs.json`,JSON.stringify(paths,null,2)+'\n');
fs.writeFileSync(`${work}/harness.html`, `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"></head><body><div id="review"></div><script src="data/energy-midterm.js"></script><script src="data/energy-textbook.js"></script><script type="module">
import {mountEnergyCard} from '/tools/energy-card-harness.tsx';
import {loadCatalogs} from '/src/cbt/catalog.ts';
const catalog=loadCatalogs().find(c=>c.key==='energy-midterm');const items=catalog.rounds.flatMap(round=>round.questions.filter(q=>q.midtermTextbook).map(question=>({round,question,subject:'에너지설비',id:question._originRoundId+':'+question._originalNumber})));
window.review = mountEnergyCard(items);
</script><style>body{margin:16px;background:#f2f4f8}#review{max-width:720px;margin:auto}.question-card{width:100%;box-sizing:border-box}</style></body></html>`);
console.log(`${paths.length} textbook question images prepared for private OCR geometry`);
