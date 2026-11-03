import {test,expect} from '@playwright/test';
import fs from 'node:fs';import crypto from 'node:crypto';import vm from 'node:vm';
import {bookInkHiddenAssets,validBookInkHiddenAsset,resolveBookInkHidden,type BookInkHiddenAsset} from '../src/cbt/textbookInkHidden';
import {textbookDirectPageMap,textbookDirectImage,textbookStudyItems,textbookAssetUrl} from '../src/cbt/textbookPages';
import {rasterDimensions} from './raster-dimensions.mjs';
import {enterBookReader,chooseBookPage} from './textbook-reader-test-helpers';
test.use({serviceWorkers:'block'});
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=(p:string)=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
test('필기 숨김 연결 가드: 지정 원문·경로·SHA·좌표와 정확한2배 크기만 허용',()=>{
 const p=textbookDirectPageMap.get('1-25')!;
 const good:BookInkHiddenAsset={oldAsset:p.asset,oldSha256:p.sha256,asset:'assets/hvac-hansol-book/ink-hidden/upscaled-pages/1-25.webp',outputSha256:'a'.repeat(64),sourceAsset:'assets/hvac-hansol-book/ink-hidden/pages/1-25.png',sourceSha256:'b'.repeat(64),sourceSize:p.size,outputSize:p.size.map(n=>n*2),kind:'page'};
 expect(validBookInkHiddenAsset(good,p.asset,p.size)).toBe(true);
 for(const change of [{oldAsset:'other.png'},{asset:'https://example.com/file.webp'},{sourceSha256:'z'.repeat(64)},{outputSize:p.size},{sourceAsset:'../file.png'}])expect(validBookInkHiddenAsset({...good,...change},p.asset,p.size)).toBe(false);
 expect(validBookInkHiddenAsset(good,p.asset,[1,2])).toBe(false);
});
test('필기 영향14쪽/26영역만 교체·나머지383쪽/474개선본 보존',()=>{
 const manifest=read('data/hansol-book-ink-hidden.json');
 expect(manifest.sourceIndexSha256).toBe(sha('data/hansol-book-direct.json'));
 expect(bookInkHiddenAssets.filter(r=>r.kind==='page')).toHaveLength(14);expect(manifest.retainedPages).toHaveLength(383);
 expect(bookInkHiddenAssets.filter(r=>r.kind!=='page').length+manifest.retained.length).toBe(500);
 for(const r of bookInkHiddenAssets){
  expect(validBookInkHiddenAsset(r,r.oldAsset)).toBe(true);
  expect(sha(r.oldAsset)).toBe(r.oldSha256);expect(sha(r.sourceAsset)).toBe(r.sourceSha256);expect(sha(r.asset)).toBe(r.outputSha256);
  expect(rasterDimensions(r.asset)).toEqual(r.outputSize);
 }
 for(const p of textbookDirectPageMap.values()){
  const image=textbookDirectImage(p),clean=resolveBookInkHidden(p.asset,p.size);
  if(clean){expect(image.asset).toBe(clean.asset);expect(image.fallbackAsset).toBe(clean.sourceAsset);expect(image.pixelSize).toEqual(p.size.map(n=>n*2));}
  else{expect(image.asset).toBe(p.asset);expect(image.pixelSize).toEqual(p.size);expect(image.improved).toBe(false);}
 }
 const context:any={window:{}};vm.runInNewContext(fs.readFileSync('data/hvac-hansol-book.js','utf8'),context);
 const items:any[]=context.window.CBT_DATA_HVAC_HANSOL_BOOK.rounds.flatMap((round:any)=>round.questions.map((question:any)=>({round,question,id:`${round.id}:${question.number}`,subject:question._subject})));
 const copies=textbookStudyItems(items);expect(copies).toHaveLength(224);
 for(const copy of copies){const old=items.find(i=>copy.id.endsWith(`::${i.id}`))!;expect(old).toBeTruthy();expect(copy.question.answer).toBe(old.question.answer);expect(copy.question.answerHotspots).toEqual(old.question.answerHotspots);expect(copy.question.sourceImage).toBe(textbookAssetUrl(old.question.sourceImage));}
});
test('깨끗한2배 쪽 표시·다크/라이트·기록 유지·연결 실패 시 깨끗한 원해상도',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('modern-cbt-qualification-industrial','hvac');localStorage.setItem('unified-cbt-dynamic-ui','false');sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');});
 await page.addLocatorHandler(page.locator('.pwa-error-notice'),async()=>{await page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click();});
 await page.goto('/?safe=1');await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();await enterBookReader(page);await chooseBookPage(page,'1-25');
 const card=page.locator('[data-source-id="hansol-direct-1-25-16"]'),image=card.locator('.direct-viewport img').first();
 const selected=textbookDirectImage(textbookDirectPageMap.get('1-25')!);
 await expect(image).toHaveJSProperty('naturalWidth',selected.pixelSize[0]);await expect(image).toHaveAttribute('src',selected.asset);
 const before=await card.locator('.direct-viewport').first().boundingBox();
 await card.getByRole('button',{name:'②',exact:true}).click();
 for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);const filter=await image.evaluate(el=>getComputedStyle(el).filter);if(theme==='light')expect(filter).toBe('none');else expect(filter).toContain('invert');}
 await card.locator('.direct-solution summary').click();await card.screenshot({path:'/private/tmp/hansol-ink-hidden-desktop.png'});
 await page.route(`**/${selected.asset}`,route=>route.abort());await chooseBookPage(page,'1-173');await chooseBookPage(page,'1-25');
 await expect(image).toHaveAttribute('src',selected.fallbackAsset);await expect(image).toHaveJSProperty('naturalWidth',textbookDirectPageMap.get('1-25')!.size[0]);
 await expect(card.getByRole('button',{name:'②',exact:true})).toHaveAttribute('aria-pressed','true');
 const after=await card.locator('.direct-viewport').first().boundingBox();expect(after!.height).toBeCloseTo(before!.height,0);
});
