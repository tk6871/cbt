import {test,expect} from '@playwright/test';
import fs from 'node:fs';import crypto from 'node:crypto';
import {textbookDirectSources,textbookEntries,textbookDirectPageMap} from '../src/cbt/textbookPages';
import {rasterDimensions} from './raster-dimensions.mjs';
import {enterBookReader,chooseBookPage} from './textbook-reader-test-helpers';
test.use({serviceWorkers:'block'});
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=(p:string)=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const old=read('data/hansol-book-direct.json'),review=read('tools/hansol-direct-boundary-review.json'),published=read('data/hansol-book-direct-boundaries.json');
test('127경계 개별검토·117분리/10오인식 구분·기존632영역과 저장ID 보존',()=>{
 expect(review.originalIndexSha256).toBe(sha('data/hansol-book-direct.json'));
 expect(published.originalIndexSha256).toBe(review.originalIndexSha256);
 expect(review.entries).toHaveLength(127);expect(published.entries).toHaveLength(127);
 expect(review.entries.filter((r:any)=>r.status==='split')).toHaveLength(117);
 expect(review.entries.filter((r:any)=>r.status==='not-question')).toHaveLength(6);
 expect(review.entries.filter((r:any)=>r.status==='covered-question')).toHaveLength(4);
 const map=new Map(textbookDirectSources.map(r=>[r.id,r]));expect(map.size).toBe(749);
 for(const row of old.locations){
  const current=map.get(row.id);
  if(row.split){expect(current).toBeTruthy();expect(current!.questionRect).toEqual(row.questionRect);expect(current!.solutionRect).toEqual(row.solutionRect);expect(current!.number).toBe(row.number);}
  else{const decision=published.entries.find((r:any)=>r.id===row.id);expect(decision.originalQuestionRect).toEqual(row.questionRect);expect(!!current).toBe(decision.status==='split');}
 }
 for(const r of textbookDirectSources){
  expect(r.split).toBe(true);expect(r.grading).toBe('self-check-only');expect((r as any).answer).toBeUndefined();
  expect(textbookEntries.filter(e=>e.directSourceId===r.id)).toHaveLength(1);
  for(const p of [...r.questionParts,...r.solutionParts]){
   const size=p.size||textbookDirectPageMap.get(p.page)!.size;const [x,y,w,h]=p.rect;
   expect(x).toBeGreaterThanOrEqual(0);expect(y).toBeGreaterThanOrEqual(0);expect(w).toBeGreaterThan(0);expect(h).toBeGreaterThan(0);
   expect(x+w).toBeLessThanOrEqual(size[0]);expect(y+h).toBeLessThanOrEqual(size[1]);
  }
 }
 expect(map.get('hansol-direct-1-175-5')!.number).toBe(41);
 expect(map.get('hansol-direct-3-267-2')!.number).toBe(48);
 expect(map.get('hansol-direct-4-185-17')!.number).toBe(9);
 const positions=textbookDirectSources.map(r=>`${r.page}:${r.number}`);expect(new Set(positions).size).toBe(positions.length);
});
test('이어지는2영역은 원해상도만 추가·SHA/크기 검사·일반 은행과기존개선본 불변',()=>{
 expect(published.assets).toHaveLength(2);
 for(const p of published.assets){expect(sha(p.asset)).toBe(p.sha256);expect(rasterDimensions(p.asset)).toEqual(p.size);expect(p.processing).toBe('native-resolution crop only');}
 // This baseline was recorded before the first boundary edit.
 for(const [path,hash] of Object.entries(review.preservedFiles)){
  expect(sha(path),path).toBe(hash);
 }
});
test('조건표·공통그림 유지/다음 열·쪽 풀이 닫힘/번호 복구·저장·테마',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('modern-cbt-qualification-industrial','hvac');localStorage.setItem('unified-cbt-dynamic-ui','false');sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');});
 await page.addLocatorHandler(page.locator('.pwa-error-notice'),async()=>{await page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click();});
 await page.goto('/?safe=1');await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();await enterBookReader(page);
 const examples=[['1-106','33',1,'1-106'],['1-112','69',1,'1-113'],['3-120','13',1,'3-120'],['3-207','3',2,'3-207'],['3-209','6',2,'3-209'],['3-378','11',1,'3-378'],['4-185','10',1,'4-186'],['4-51','9',1,'4-51']] as const;
 for(const [bookPage,n,count,solutionPage] of examples){
  await chooseBookPage(page,bookPage);
  const card=page.locator(`[data-source-id="hansol-direct-${bookPage}-${n}"]`);await expect(card).toBeVisible();
  await expect(card.locator('.direct-caution')).toHaveCount(0);await expect(card.locator('.direct-question-parts .direct-region')).toHaveCount(count);
  await expect(card.locator('.direct-solution-parts')).toHaveCount(0);await expect(card.locator('.direct-solution')).not.toHaveAttribute('open','');
  const q=card.locator('.direct-question-parts img').first();await expect(q).toHaveJSProperty('complete',true);expect(await q.evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBeGreaterThan(0);
  const selected=card.getByRole('button',{name:'③',exact:true});await selected.click();await expect(selected).toHaveAttribute('aria-pressed','true');
  await card.locator('.direct-solution summary').click();await expect(card.locator(`.direct-solution-parts .direct-region[data-page="${solutionPage}"] img`)).toBeVisible();
  await card.locator('.direct-solution summary').click();await expect(card.locator('.direct-solution-parts')).toHaveCount(0);
  for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);const filter=await q.evaluate(el=>getComputedStyle(el).filter);expect(theme==='dark'?filter.includes('invert'):filter==='none').toBe(true);}
  await card.screenshot({path:`/private/tmp/hansol-boundary-${bookPage}-${n}.png`});
 }
 await chooseBookPage(page,'4-185');const restored=page.locator('[data-source-id="hansol-direct-4-185-10"]');await expect(restored.getByRole('button',{name:'③',exact:true})).toHaveAttribute('aria-pressed','true');await expect(restored.locator('.direct-solution-parts')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await chooseBookPage(page,'1-64');await expect(page.locator('[data-source-id="hansol-direct-1-64-2"]')).toHaveCount(0);
 await chooseBookPage(page,'2-60');await expect(page.locator('[data-source-id="hansol-direct-2-60-6"]')).toHaveCount(0);
});
