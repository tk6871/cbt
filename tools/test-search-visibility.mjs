import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
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
assert.equal(log.currentVersion,'6.0.1');
const prior=log.entries.filter(e=>!(e.scope==='industrial'&&e.version==='6.0.1'&&e.date==='2026.11.06')).map(e=>[e.scope,e.version,e.date]);
assert.equal(prior.length,206);
assert.equal(crypto.createHash('sha256').update(JSON.stringify(prior)).digest('hex'),'41c93c48363106a9adc807787f964189a6c69551493c0d6ee6fe67bbe0461008','Historical release identities changed');
const guards=JSON.parse(fs.readFileSync('tools/hansol-direct-boundary-review.json','utf8')).preservedFiles;
for(const [p,expected] of Object.entries(guards))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),expected,`${p}: question/source asset metadata changed`);
console.log(JSON.stringify({htmlPages:audit.pages,publicNotes:notes.length,historicalReleases:prior.length,protectedInputs:Object.keys(guards).length,idempotent:true,limits:'No access control, repository privacy or search removal is claimed'}));
