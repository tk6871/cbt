// Mechanical, recoverable narrowing requested by the user. Preserve all
// previously captured/generated material privately; publish affected ink only.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');process.chdir(root);
const work='work/hansol-ink-hidden',read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const planPath=`${work}/jobs.json`,plan=read(planPath);
if(plan.scope==='affected-ink-only'){console.log('Already restricted; no changes.');process.exit(0);}
assert.equal(plan.jobs.length,423);assert.equal(plan.retained.length,474);
const kept=plan.jobs.filter(r=>r.kind!=='page'||r.removedInkPixels>=8);
const omitted=plan.jobs.filter(r=>r.kind==='page'&&r.removedInkPixels<8);
assert.equal(kept.length,40);assert.equal(omitted.length,383);
const archive=`${work}/unneeded-generated`;fs.mkdirSync(archive,{recursive:true});
function preserve(p){if(fs.existsSync(p)){const to=`${archive}/${path.basename(p)}`;assert.ok(!fs.existsSync(to));fs.renameSync(p,to);}}
fs.writeFileSync(`${archive}/all-pages-plan-before-scope-change.json`,JSON.stringify(plan,null,2)+'\n');
const ledgerPath=`${work}/upscale-ledger.json`,ledger=fs.existsSync(ledgerPath)?read(ledgerPath):{};
fs.writeFileSync(`${archive}/all-pages-ledger-before-scope-change.json`,JSON.stringify(ledger,null,2)+'\n');
for(const r of omitted){
 assert.ok(/^assets\/hvac-hansol-book\/ink-hidden\/pages\/[1-5]-\d+\.png$/.test(r.sourceAsset));
 assert.equal(sha(r.sourceAsset),r.sourceSha256);
 const to=`${archive}/pages/${path.basename(r.sourceAsset)}`;fs.mkdirSync(path.dirname(to),{recursive:true});assert.ok(!fs.existsSync(to));fs.renameSync(r.sourceAsset,to);r.sourceAsset=to;
 if(fs.existsSync(r.asset)){
  const destination=`${archive}/upscaled-pages/${path.basename(r.asset)}`;fs.mkdirSync(path.dirname(destination),{recursive:true});assert.ok(!fs.existsSync(destination));
  if(ledger[r.key])assert.equal(sha(r.asset),ledger[r.key].outputSha256);
  fs.renameSync(r.asset,destination);
 }
 delete ledger[r.key];
}
// An interrupted inference may leave one partial output outside the ledger;
// only the exact omitted-page targets above can be moved, never old originals.
preserve(`${work}/release-journal.json`);
preserve(`${work}/upscale-progress.json`);
plan.scope='affected-ink-only';plan.jobs=kept;plan.retainedPages=omitted;
plan.limits+=' Latest scope: replace only the14 affected pages and26 native crops; preserve383 unaffected pages and474 native improvements.';
fs.writeFileSync(planPath,JSON.stringify(plan,null,2)+'\n');
fs.writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+'\n');
console.log(JSON.stringify({affectedPages:14,nativeCrops:26,jobs:40,unaffectedPagesPreserved:383,oldNativeImprovedPreserved:474,alreadyComplete:Object.keys(ledger).length,omittedMovedPrivately:383}));
