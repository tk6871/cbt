import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {chromium} from '@playwright/test';
import {correctionFigures,correctionFigureHtml,correctionFigureAssets} from './textbook-correction-figures.mjs';

const diagram='assets/hvac/assets/comcbt/20110821/images/nq20110821m1.png';
const choices=Array.from({length:4},(_,i)=>({text:'',images:[`assets/hvac/assets/comcbt/20110821/images/nq20110821m1b${i+1}.png`]}));
const original={images:[diagram],choices};
const review={page:'1-176',number:45,retainSourceFigures:true};

test('도식이 있는 사본은 명시적 보존 확인 없이 만들 수 없음',()=>{
 assert.throws(()=>correctionFigures(original,{...review,retainSourceFigures:undefined}),/verify and retain/);
 assert.throws(()=>correctionFigures({images:[],choices:choices.map(()=>({images:[]}))},review),/no separate source figures/);
 assert.throws(()=>correctionFigures({...original,images:['assets/../private.png']},review),/inside assets/);
 const figures=correctionFigures(original,review);
 assert.equal(figures.stem.length,1);assert.deepEqual(figures.choices.map(x=>x.length),[1,1,1,1]);
 const assets=correctionFigureAssets(figures);assert.equal(assets.length,5);
 for(const asset of assets)assert.equal(asset.sha256,crypto.createHash('sha256').update(fs.readFileSync(asset.path)).digest('hex'));
 assert.match(correctionFigureHtml(figures.stem),/src="data:image\/png;base64,/);
});

test('기존 텍스트 전용 사본에는 그림을 추가하지 않음',()=>{
 const figures=correctionFigures({images:[],choices:choices.map(()=>({images:[]}))},{page:'1-1',number:1});
 assert.deepEqual(correctionFigureAssets(figures),[]);assert.equal(correctionFigureHtml(figures.stem),'');
});

test('분수 보기4개·선도를 모두 읽은 뒤 클릭 영역을 계산',async()=>{
 const figures=correctionFigures(original,review);const browser=await chromium.launch({channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:900,height:1000},deviceScaleFactor:2});
  await page.setContent(`<style>*{box-sizing:border-box}body{margin:0}article{width:742px;padding:24px;font:30px sans-serif}.stem-figures{display:grid;justify-items:center;margin-bottom:24px}.source-figure{display:block;max-width:100%;height:auto}.choices{display:grid;grid-template-columns:1fr 1fr;gap:20px}.choice{display:flex;align-items:flex-start;gap:10px;width:fit-content;max-width:100%}.choice-content{min-width:0}.choice .source-figure{min-width:140px}</style><article><p>대조한 선도와 분수 보기</p><div class="stem-figures">${correctionFigureHtml(figures.stem)}</div><div class="choices">${figures.choices.map((images,i)=>`<div class="choice"><span>${'①②③④'[i]}</span><span class="choice-content">${correctionFigureHtml(images)}</span></div>`).join('')}</div></article>`);
  await page.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
  const layout=await page.evaluate(()=>{
   const rect=el=>{const {x,y,width,height}=el.getBoundingClientRect();return {x,y,width,height};};
   return {article:rect(document.querySelector('article')),diagram:rect(document.querySelector('.stem-figures img')),choices:[...document.querySelectorAll('.choice')].map(el=>({...rect(el),image:rect(el.querySelector('img'))})),loaded:[...document.images].every(i=>i.complete&&i.naturalWidth>0)};
  });
  assert.equal(layout.loaded,true);assert.equal(layout.choices.length,4);
  for(const choice of layout.choices){assert.ok(choice.y>=layout.diagram.y+layout.diagram.height);assert.ok(choice.image.height>0);assert.ok(choice.image.x+choice.image.width<=choice.x+choice.width+.01);assert.ok(choice.x+choice.width<=layout.article.width);}
  fs.mkdirSync('work/textbook-correction-preview',{recursive:true});
  await page.locator('article').screenshot({path:'work/textbook-correction-preview/diagram-and-fractions.png'});
 }finally{await browser.close();}
});
