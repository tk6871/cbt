// Only separately stored, visually verified question/choice figures are reused.
// A whole source scan is never inserted into a text correction as a diagram.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

export function correctionFigures(original, review) {
 const stemPaths=original.images||[];
 const choicePaths=original.choices.map(choice=>choice.images||[]);
 const paths=[...stemPaths,...choicePaths.flat()];
 if(paths.length)assert.equal(review.retainSourceFigures,true,`${review.page}:${review.number}: separately verify and retain the source figures`);
 if(review.retainSourceFigures)assert.ok(paths.length,`${review.page}:${review.number}: no separate source figures to retain`);
 const image=path=>{
  assert.match(path,/^assets\/[\w./-]+\.(png|jpe?g|webp|gif)$/i);
  assert.ok(!path.split('/').includes('..'),'figure must stay inside assets');
  const bytes=fs.readFileSync(path);
  const extension=path.split('.').at(-1).toLowerCase();
  const mime=extension==='jpg'?'jpeg':extension;
  return {path,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),dataUrl:`data:image/${mime};base64,${bytes.toString('base64')}`};
 };
 return {stem:stemPaths.map(image),choices:choicePaths.map(paths=>paths.map(image))};
}

export function correctionFigureHtml(figures) {
 return figures.map(figure=>`<img class="source-figure" src="${figure.dataUrl}" alt="기존 CBT에서 대조한 그림">`).join('');
}

export function correctionFigureAssets(figures) {
 return [...figures.stem,...figures.choices.flat()].map(({path,sha256})=>({path,sha256}));
}
