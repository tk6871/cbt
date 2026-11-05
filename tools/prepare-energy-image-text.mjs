import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
const directory = 'work/private-notes/image-text';
const sandbox = {window:{}};
vm.runInNewContext(fs.readFileSync('data/energy-textbook.js','utf8'), sandbox);
const mapping = JSON.parse(fs.readFileSync('data/problem-images-webp90.json','utf8')).mappings;
const entries = new Map();
for (const round of sandbox.window.CBT_DATA_ENERGY_TEXTBOOK.rounds) for (const question of round.questions) {
  for (const [kind, originals] of [['question',[question.sourceImage]], ['explanation',question.explanationImages||[]]]) {
    for (const original of originals.filter(Boolean)) {
      const asset = mapping[original] || original;
      const bytes = fs.readFileSync(asset);
      entries.set(original, {id:crypto.createHash('sha256').update(original).digest('hex').slice(0,24), original, asset,
        sha256:crypto.createHash('sha256').update(bytes).digest('hex'), kind, number:question._originalNumber||question.number});
    }
  }
}
fs.mkdirSync(directory,{recursive:true});
fs.writeFileSync(path.join(directory,'inputs.json'),JSON.stringify([...entries.values()],null,2)+'\n');
fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify([...entries.values()].map(e=>({id:e.id,path:path.resolve(e.asset)})),null,2)+'\n');
console.log({images:entries.size,directory});
