// Explicitly reviewed text variants only. No OCR transcription or heuristics.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {correctionFigures,correctionFigureAssets} from './textbook-correction-figures.mjs';
const sha=path=>crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
export function textbookSourceFingerprint(q){
 const text=JSON.stringify([q.text||'',q.html||'',q.ocrText||'',q.choices.map(c=>[c.text||'',c.html||'',c.images||[]]),q.answer,q.images||[],q.sourceImage||'']);
 let h=14695981039346656037n;for(const ch of text){h^=BigInt(ch.codePointAt(0));h=BigInt.asUintN(64,h*1099511628211n);}return h.toString(16);
}
export function makeTextCorrection(original,review){
 const key=`${review.page}:${review.number}`,c=review.correction;
 assert.equal(review.presentation,'text',key);assert.ok(c,key);
 assert.equal(review.sourceFingerprint,textbookSourceFingerprint(original),`${key}: original changed since direct review`);
 assert.equal(original.answer,review.answer,key);assert.equal(c.choices.length,4,key);
 for(const value of [c.text,...c.choices,c.note,c.explanation]){
  assert.equal(typeof value,'string',key);assert.ok(value.trim(),key);
  assert.ok(!/[\p{Co}\uFFFD]/u.test(value),`${key}: unreadable OCR characters`);
  assert.ok(!/<[^>]*>|&(?:#\w+|\w+);/u.test(value),`${key}: text must not hide HTML/figures`);
 }
 // A whole scan could contain a diagram not represented in original.images.
 if(original.sourceImage)assert.equal(review.sourceScanTextOnlyVerified,true,`${key}: visually confirm the whole source scan is text-only`);
 assert.ok(!/<img\b/i.test([original.html,...original.choices.map(c=>c.html||'')].join(' ')),`${key}: inline figures need separate review`);
 const replaced=review.replacedChoiceFigures||[];assert.equal(new Set(replaced).size,replaced.length,key);
 for(const path of replaced){
  assert.ok(!original.images?.includes(path),`${key}: cannot drop a stem diagram`);
  const affected=original.choices.map((choice,index)=>choice.images?.includes(path)?index:-1).filter(i=>i>=0);
  assert.ok(affected.length,`${key}: unknown choice figure`);
  for(const i of affected)assert.notEqual(original.choices[i].text,c.choices[i],`${key}: unchanged choice must retain its figure`);
 }
 const source={...original,choices:original.choices.map(choice=>({...choice,images:(choice.images||[]).filter(path=>!replaced.includes(path))}))};
 const figures=correctionFigures(source,review);
 return {...c,presentation:'text',sourceId:review.sourceId,sourceImage:original.sourceImage||null,
  sourceImageSha256:original.sourceImage?sha(original.sourceImage):null,
  images:Array.from(figures.stem,f=>f.path),choiceImages:Array.from(figures.choices,list=>Array.from(list,f=>f.path)),figureAssets:correctionFigureAssets(figures),
  ...(replaced.length?{replacedChoiceFigures:replaced.map(path=>({path,sha256:sha(path)}))}: {})};
}
