import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCampusGlb } from '../src/cbt/campusGlb.ts';
function glb(json: object): ArrayBuffer {
  const text = JSON.stringify(json), padded = text.padEnd(Math.ceil(text.length / 4) * 4, ' ');
  const bytes = new ArrayBuffer(20 + padded.length), view = new DataView(bytes);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, bytes.byteLength, true);
  view.setUint32(12, padded.length, true); view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(bytes, 20).set(new TextEncoder().encode(padded)); return bytes;
}
validateCampusGlb(glb({asset:{version:'2.0'},buffers:[{byteLength:0}]}));
for (const uri of ['https://example.com/private', '//example.com/a', '../texture.png', 'file:///tmp/a']) {
  assert.throws(() => validateCampusGlb(glb({images:[{uri}]})));
  assert.throws(() => validateCampusGlb(glb({buffers:[{uri}]})));
}
assert.throws(() => validateCampusGlb(new ArrayBuffer(4)));
assert.throws(() => validateCampusGlb(new ArrayBuffer(51*1024*1024)));
const model = readFileSync('assets/campus/models/office-lady.glb');
validateCampusGlb(model.buffer.slice(model.byteOffset, model.byteOffset+model.byteLength));
console.log('Campus GLB: valid model, malformed/oversized files and external dependencies checked.');
