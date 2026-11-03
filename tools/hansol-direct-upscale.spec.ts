import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {resolveTextbookDirectImage,textbookDirectImage,textbookDirectPageMap,type TextbookDirectUpscale} from '../src/cbt/textbookPages';
import {enterBookReader,chooseBookPage} from './textbook-reader-test-helpers';
test.use({serviceWorkers:'block'});
const source=JSON.parse(fs.readFileSync('data/hansol-book-direct.json','utf8'));
const upgrades=JSON.parse(fs.readFileSync('data/hansol-book-direct-upscale.json','utf8'));
const sha=(p:string)=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
test('화질 연결은 원본 해시·좌표·정확한2배 크기가 일치할 때만 허용',()=>{
 const p=textbookDirectPageMap.get('1-25')!;
 const good:TextbookDirectUpscale={page:p.page,sourceAsset:p.asset,sourceSha256:p.sha256,coordinateSize:p.size,outputSize:p.size.map(n=>n*2),asset:'assets/hvac-hansol-book/direct-pages/upscaled-2x/1-25.webp',outputSha256:'a'.repeat(64),model:'realesrgan-x4plus-anime',tile:256,native:'arm64',pipeline:'4x -> 2x bicubic'};
 expect(resolveTextbookDirectImage(p,good).improved).toBe(true);
 for(const change of [{sourceSha256:'bad'},{page:'2-25'},{coordinateSize:[1,2]},{outputSize:p.size},{asset:'https://example.com/img.webp'},{pipeline:'original-resolution'}])expect(resolveTextbookDirectImage(p,{...good,...change}).asset).toBe(p.asset);
 expect(resolveTextbookDirectImage(p).asset).toBe(p.asset);
});
test('397확대본·원본 보존·크기·전역 형태 유지 감사',()=>{
 expect(upgrades.pages).toHaveLength(397);expect(upgrades.sourceIndexSha256).toBe(sha('data/hansol-book-direct.json'));
 for(const p of source.pages){
  const u=upgrades.pages.find((r:any)=>r.page===p.page);expect(u).toBeTruthy();
  expect(sha(p.asset)).toBe(p.sha256);expect(sha(u.asset)).toBe(u.outputSha256);
  expect(u.coordinateSize).toEqual(p.size);expect(u.outputSize).toEqual(p.size.map((n:number)=>n*2));
  expect(u.fidelity.luminanceCorrelation).toBeGreaterThan(.92);expect(u.fidelity.edgeCorrelation).toBeGreaterThan(.8);
  expect(textbookDirectImage(textbookDirectPageMap.get(p.page)!).asset).toBe(u.asset);
 }
});
test('2배 이미지도 문제/풀이 영역·선택 기록·다크/라이트 동일, 연결 실패 시 원본 대체',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('modern-cbt-qualification-industrial','hvac');localStorage.setItem('unified-cbt-dynamic-ui','false');sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');});
 await page.addLocatorHandler(page.locator('.pwa-error-notice'),async()=>{await page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click();});
 await page.goto('/?safe=1');await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();await enterBookReader(page);await chooseBookPage(page,'1-168');
 const card=page.locator('[data-source-id="hansol-direct-1-168-25"]');
 const image=card.locator('.direct-viewport img').first();
 await expect(card).toContainText('2배 화질 개선');await expect(image).toHaveJSProperty('naturalWidth',2684);
 const region=card.locator('.direct-viewport').first(),before=await region.boundingBox();
 const r=source.locations.find((r:any)=>r.id==='hansol-direct-1-168-25');expect(before!.width/before!.height).toBeCloseTo(r.questionRect[2]/r.questionRect[3],1);
 await card.getByRole('button',{name:'②',exact:true}).click();await expect(card.getByRole('button',{name:'②',exact:true})).toHaveAttribute('aria-pressed','true');
 await card.locator('.direct-solution summary').click();await expect(card.locator('.direct-solution')).toHaveAttribute('open','');
 for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);const filter=await image.evaluate(el=>getComputedStyle(el).filter);if(theme==='light')expect(filter).toBe('none');else expect(filter).toContain('invert');}
 await card.screenshot({path:'/private/tmp/hansol-direct-upscale-desktop.png'});
 const output=textbookDirectImage(textbookDirectPageMap.get('1-168')!).asset;
 await page.route(`**/${output}`,route=>route.abort());await chooseBookPage(page,'1-173');await chooseBookPage(page,'1-168');
 await expect(card).toContainText('원해상도 대체 표시');await expect(image).toHaveJSProperty('naturalWidth',1342);
 const after=await region.boundingBox();expect(after!.height).toBeCloseTo(before!.height,0);
 await expect(card.getByRole('button',{name:'②',exact:true})).toHaveAttribute('aria-pressed','true');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
