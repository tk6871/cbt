import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {verifyProtectedInputs} from './verify-protected-inputs.mjs';
import {readOriginalAsset} from './read-original-asset.mjs';
import {rasterDimensions} from './raster-dimensions.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const display=read('data/problem-images-webp90.json');
const audit=read('data/problem-images-webp90-audit.json');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let sourceBytes=0,displayBytes=0;
const targets=new Map();
for(const [source,target] of Object.entries(display.mappings)){
 const r=audit.entries[source];assert.ok(r);assert.equal(r.asset,target);
 assert.match(target,/^assets\/problem-webp90\/[a-f0-9]{32}\.webp$/);
 if(!targets.has(target)){
  assert.deepEqual(rasterDimensions(target),r.size);assert.equal(sha(target),r.sha256);
  assert.equal(fs.statSync(target).size,r.bytes);targets.set(target,r.bytes);
 }
 if(process.argv.includes('--sources')){
  const original=readOriginalAsset(source);
  assert.equal(original.length,r.sourceBytes,source);
  assert.equal(crypto.createHash('sha256').update(original).digest('hex'),r.sourceSha256,source);
 }
 sourceBytes+=r.sourceBytes;displayBytes+=r.bytes;
}
for(const source of audit.retained)assert.ok(fs.existsSync(source));
const protectedInputs=verifyProtectedInputs();
assert.equal(Object.keys(display.mappings).length,17605);assert.equal(audit.retained.length,8);
console.log(JSON.stringify({mapped:17605,retained:8,uniqueTargets:targets.size,sourceBytes,displayBytes,uniqueBytes:[...targets.values()].reduce((a,b)=>a+b,0),sourceCheck:process.argv.includes('--sources'),protectedInputs}));
