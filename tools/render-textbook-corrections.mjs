// Code-rendered, manually book-verified text. Never mutate a source scan or
// publish an unverified OCR transcription as a correction.
import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';
import assert from 'node:assert/strict';import {chromium} from '@playwright/test';
import {loadHansolReview} from './load-hansol-textbook-review.mjs';
import {rasterDimensions} from './raster-dimensions.mjs';
import {correctionFigures,correctionFigureHtml,correctionFigureAssets} from './textbook-correction-figures.mjs';
import {makeTextCorrection} from './textbook-text-correction.mjs';
const w={window:{}};for(const f of ['hvac','hvac-hansol'])vm.runInNewContext(fs.readFileSync(`data/${f}.js`,'utf8'),w);
const originals=new Map(Object.values(w.window).flatMap(b=>b.rounds.flatMap(r=>r.questions.map(q=>[`${r.id}:${q.number}`,q]))));
const review=loadHansolReview(originals);
// Inspect the small, figure-bearing subset without changing public assets/data.
const previewFigures=process.argv.includes('--preview-figures');
const pendingOnly=process.argv.includes('--pending-only');
assert.ok(!(previewFigures&&pendingOnly),'choose preview or pending publication');
const outputDir=previewFigures?'work/textbook-correction-preview':'assets/textbook-corrections';
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const font=fs.readFileSync('assets/fonts/NanumGothic-Regular.ttf').toString('base64');
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
fs.mkdirSync(outputDir,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:900,height:1800},deviceScaleFactor:2});
const result=pendingOnly?JSON.parse(fs.readFileSync('data/textbook-corrections.json','utf8')).entries:{};
let created=0;
try{for(const row of review.rows.filter(r=>r.correction&&(!previewFigures||r.retainSourceFigures))){
 if(pendingOnly&&result[`${row.page}:${row.number}`])continue;
 const original=originals.get(row.sourceId);assert.ok(original);assert.equal(original.answer,row.answer);assert.equal(row.correction.choices.length,4);
 if(row.presentation==='text'){result[`${row.page}:${row.number}`]=makeTextCorrection(original,row);continue;}
 const figures=correctionFigures(original,row);const figureAssets=correctionFigureAssets(figures);
 await page.setContent(`<style>@font-face{font-family:Book;src:url(data:font/ttf;base64,${font})}*{box-sizing:border-box}html,body{margin:0;background:white}#question{width:742px;padding:22px 24px;color:#111;font:30px/1.55 Book,sans-serif}.stem{margin:0 0 20px;word-break:keep-all;overflow-wrap:anywhere;white-space:pre-line}.stem-figures{display:grid;justify-items:center;gap:16px;margin:0 0 24px}.stem-figures .source-figure{display:block;max-width:100%;height:auto}.choices{display:grid;grid-template-columns:1fr 1fr;gap:18px 22px;padding:0 12px}.choices.long{grid-template-columns:1fr}.choice{display:flex;align-items:flex-start;gap:10px;width:fit-content;max-width:100%;word-break:keep-all;overflow-wrap:anywhere}.choice-content{min-width:0}.choice .source-figure{display:block;min-width:140px;max-width:100%;height:auto}.number{flex-shrink:0}</style><article id="question"><div class="stem">${row.number}. ${escape(row.correction.text)}</div>${figures.stem.length?`<div class="stem-figures">${correctionFigureHtml(figures.stem)}</div>`:''}<div class="choices ${row.correction.choices.some(c=>c.length>35)?'long':''}">${row.correction.choices.map((c,i)=>`<div class="choice" data-choice="${i+1}"><span class="number">${'①②③④'[i]}</span><span class="choice-content">${escape(c)}${correctionFigureHtml(figures.choices[i])}</span></div>`).join('')}</div></article>`);
 await page.evaluate(()=>document.fonts.ready);
 await page.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
 await page.locator('.choices').evaluate(el=>{if([...el.querySelectorAll('.choice')].some(c=>c.getBoundingClientRect().height>parseFloat(getComputedStyle(c).lineHeight)*1.25))el.classList.add('long');});
 const layout=await page.locator('#question').evaluate(el=>{const rect=el.getBoundingClientRect();return {size:[rect.width,rect.height],boxes:[...el.querySelectorAll('.choice')].map(c=>{const r=c.getBoundingClientRect();return {choice:Number(c.getAttribute('data-choice')),x:(r.x-rect.x)/rect.width*100,y:(r.y-rect.y)/rect.height*100,width:r.width/rect.width*100,height:r.height/rect.height*100};})};});
 const asset=`${outputDir}/hansol-${row.page}-${row.number}.png`;await page.locator('#question').screenshot({path:asset});
 const size=rasterDimensions(asset);
 // Browser screenshots ceil fractional CSS heights. Match the actual PNG,
 // not a rounded estimate, including the normalized answer rectangles.
 const sx=layout.size[0]*2/size[0],sy=layout.size[1]*2/size[1];
 const hotspots=layout.boxes.map(b=>({...b,x:b.x*sx,width:b.width*sx,y:b.y*sy,height:b.height*sy}));
 result[`${row.page}:${row.number}`]={...row.correction,asset,size,hotspots,sourceId:row.sourceId,sourceImage:original.sourceImage||null,sourceImageSha256:original.sourceImage?sha(original.sourceImage):null,...(figureAssets.length?{figureAssets}:{}),sha256:sha(asset)};
 created++;
}}finally{await browser.close();}
fs.writeFileSync(previewFigures?`${outputDir}/manifest.json`:'data/textbook-corrections.json',JSON.stringify({date:review.date,entries:result},null,2)+'\n');
console.log({manuallyReviewedCorrections:Object.keys(result).length,newlyRendered:created});
