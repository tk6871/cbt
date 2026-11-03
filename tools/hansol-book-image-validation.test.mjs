import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {validateBookImagePipeline} from './hansol-book-image-validation.mjs';
import {rasterDimensions} from './raster-dimensions.mjs';
test('원래 해상도는 원본 바이트·크기 유지, 기존 업스케일 이력과 구분',()=>{
 const audit=JSON.parse(fs.readFileSync('data/hansol-book-native-audit.json','utf8'));
 for(const [key,im] of Object.entries(audit.images)){
  validateBookImagePipeline(im);assert.deepEqual(rasterDimensions(im.asset),im.outputSize);
  if(im.pipeline==='original-resolution'){
   const bytes=fs.readFileSync(`work/hansol-book-native/original/${key}.png`);
   assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),im.outputSha256);
   assert.deepEqual(fs.readFileSync(im.asset),bytes);
  }
 }
 // Current completed upscales are retained. Exercise the original-only route
 // against the unchanged staged PNG without replacing a published asset.
 assert.equal(audit.images['1-28-22-question'].pipeline,'4x -> 2x bicubic');
 assert.equal(audit.images['1-28-22-explanation'].pipeline,'4x -> 2x bicubic');
 const bytes=fs.readFileSync('work/hansol-book-native/original/1-28-22-question.png');
 const hash=crypto.createHash('sha256').update(bytes).digest('hex');
 const im={sourceSize:[556,491],outputSize:[556,491],sourceSha256:hash,outputSha256:hash,asset:'assets/hvac-hansol-book/questions/1-28-22-original.png',model:'none',native:'none',tile:null,pipeline:'original-resolution'};
 validateBookImagePipeline(im);
 assert.throws(()=>validateBookImagePipeline({...im,outputSize:im.sourceSize.map(n=>n*2)}));
 assert.throws(()=>validateBookImagePipeline({...im,outputSha256:'changed'}));
 assert.throws(()=>validateBookImagePipeline({...im,model:'realesrgan-x4plus-anime'}));
 assert.throws(()=>validateBookImagePipeline({...im,pipeline:'unverified-conversion'}));
});
