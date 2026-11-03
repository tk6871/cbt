import assert from 'node:assert/strict';
export function validateBookImagePipeline(im){
 assert.ok(Array.isArray(im.sourceSize)&&im.sourceSize.length===2);
 assert.ok(im.sourceSize.every(n=>Number.isInteger(n)&&n>0));
 if(im.pipeline==='original-resolution'){
  assert.equal(im.model,'none');assert.equal(im.native,'none');assert.equal(im.tile,null);
  assert.deepEqual(im.outputSize,im.sourceSize);
  assert.equal(im.outputSha256,im.sourceSha256,'original PNG bytes must be unchanged');
  assert.match(im.asset,/-original\.png$/);
 }else{
  assert.equal(im.pipeline,'4x -> 2x bicubic');
  assert.equal(im.native,'arm64');assert.equal(im.tile,256);assert.equal(im.model,'realesrgan-x4plus-anime');
  assert.deepEqual(im.outputSize,im.sourceSize.map(n=>n*2));
 }
}
