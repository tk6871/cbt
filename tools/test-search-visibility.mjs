import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {verifyProtectedInputs} from './verify-protected-inputs.mjs';
import {auditSearchExclusion,withSearchExclusion,searchRobotsPolicy} from './search-visibility-policy.mjs';

const fixtures=[
 '<!doctype html><html><head><meta charset="utf-8"><title>App</title></head><body>App</body></html>',
 '<html><head>\n <meta charset="utf-8">\n<meta name="robots" content="index,follow">\n<title>App</title></head></html>',
 '<html><head><meta name="ROBOTS" content="noindex"><meta name="robots" content="nofollow"></head></html>',
 '<html lang="ko"><meta charset="utf-8"><title>Retained report</title><main>Report</main></html>',
];
for(const input of fixtures){
 const output=withSearchExclusion(input);
 assert.equal(withSearchExclusion(output),output,'Search policy injection must be idempotent');
 assert.equal([...output.matchAll(/name="robots"/g)].length,1);
 assert.ok(output.includes(searchRobotsPolicy));
}
const audit=auditSearchExclusion();assert.ok(audit.pages>=6);
assert.ok(fs.readFileSync('package.json','utf8').includes('search-visibility-policy.mjs --write && vite build'));
// Audit public explanatory text, not question provenance, source IDs or rights.
const forbidden=/한솔|교보|에듀강/;
const notes=['README.md','CHANGELOG.md','WORK_STATE.md','data/changelog-vue.js','data/changelog.js'];
function markdown(folder){for(const e of fs.readdirSync(folder,{withFileTypes:true})){const p=`${folder}/${e.name}`;if(e.isDirectory())markdown(p);else if(e.isFile()&&p.endsWith('.md'))notes.push(p);}}
markdown('docs');
for(const p of notes)assert.ok(!forbidden.test(fs.readFileSync(p,'utf8')),`${p}: named source returned to public notes`);
const context={window:{}};vm.runInNewContext(fs.readFileSync('data/changelog-vue.js','utf8'),context);
const log=context.window.CBT_CHANGELOG;
assert.equal(log.currentVersion,log.entries.find(e=>e.scope==='industrial').version);
const releaseIndex=log.entries.findIndex(e=>e.scope==='industrial'&&e.version==='6.1'&&e.date==='2026.11.10');
assert.ok(releaseIndex>=0,'Missing 6.1 release boundary');
const prior=log.entries.slice(releaseIndex+1).map(e=>[e.scope,e.version,e.date]);
assert.equal(prior.length,207);
assert.equal(crypto.createHash('sha256').update(JSON.stringify(prior)).digest('hex'),'d8f90bbdc9f5fd8441eea5c3cdf42f77d273174c097871659e97c0883fc28c00','Historical release identities changed');
const protectedInputs=verifyProtectedInputs();
console.log(JSON.stringify({htmlPages:audit.pages,publicNotes:notes.length,historicalReleases:prior.length,protectedInputs,idempotent:true,limits:'No access control, repository privacy or search removal is claimed'}));
