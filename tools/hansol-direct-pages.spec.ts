import {readOriginalAsset} from './read-original-asset.mjs';
import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {textbookEntries,textbookStudyItems,textbookDirectSources,textbookDirectPageMap,textbookDirectImage} from '../src/cbt/textbookPages';
import {enterBookReader,chooseBookPage} from './textbook-reader-test-helpers';
test.use({serviceWorkers:'block'});
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const data=read('data/hansol-book-direct.json');
test('759원문·397원해상도 쪽·모든 영역·자가확인 분리',()=>{
 expect(data.locations).toHaveLength(759);expect(data.pages).toHaveLength(397);
 const ids=new Set(data.locations.map((r:any)=>r.id));expect(ids.size).toBe(759);
 const existing=new Map<string,string|undefined>(textbookEntries.filter(e=>e.sourceId).map(e=>[`${e.book}:${e.page}:${e.number}`,e.previousDirectId]));
 for(const p of data.pages){
  expect(crypto.createHash('sha256').update(readOriginalAsset(p.asset)).digest('hex')).toBe(p.sha256);
  expect(p.size).toEqual([p.sourceCrop[2]-p.sourceCrop[0],p.sourceCrop[3]-p.sourceCrop[1]]);
 }
 for(const r of data.locations){
  const printed=textbookDirectSources.find(s=>s.id===r.id);
  if(r.id==='hansol-direct-5-27-5'){expect(textbookEntries.find(e=>e.book==='hansol'&&e.page==='5-27'&&e.number===1)?.sourceId).toBe('hvac-hansol-2023-3:1');}
  else if(printed && existing.has(`hansol:${printed.page}:${printed.number}`)) expect(existing.get(`hansol:${printed.page}:${printed.number}`)).toBe(r.id);
  expect(r.grading).toBe('self-check-only');expect(r.answer).toBeUndefined();expect(r.text).toBeUndefined();
  const p=textbookDirectPageMap.get(r.page)!;expect(p).toBeTruthy();
  for(const rect of [r.questionRect,r.solutionRect,p.answerKeyRect].filter(Boolean)){
   expect(rect[0]).toBeGreaterThanOrEqual(0);expect(rect[1]).toBeGreaterThanOrEqual(0);
   expect(rect[2]).toBeGreaterThan(0);expect(rect[3]).toBeGreaterThan(0);
   expect(rect[0]+rect[2]).toBeLessThanOrEqual(p.size[0]);expect(rect[1]+rect[3]).toBeLessThanOrEqual(p.size[1]);
  }
  expect(r.split).toBe(!!r.solutionRect);
 }
 const direct=textbookEntries.filter(e=>e.directSourceId);expect(direct).toHaveLength(439);
 expect(textbookEntries.filter(e=>e.previousDirectId)).toHaveLength(303);
 expect(direct.every(e=>e.sourceId===null&&!e.fingerprint&&!e.correction&&!e.reviewHold)).toBe(true);
 expect(textbookStudyItems([],direct)).toEqual([]);
 expect(textbookDirectSources.filter(r=>r.split)).toHaveLength(743);
});
test('원문 선택 저장·책 풀이 접기·전체 쪽·다크/라이트·목차 복귀',async({page},info)=>{
 await page.addInitScript(()=>{
  localStorage.setItem('modern-cbt-qualification-industrial','hvac');
  localStorage.setItem('unified-cbt-dynamic-ui','false');
  sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');
  sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');
 });
 await page.addLocatorHandler(page.locator('.pwa-error-notice'),async()=>{await page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click();});
 await page.goto('/?safe=1');
 await page.getByRole('button',{name:'회차별 기출 고르기',exact:true}).click();
 await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
 await enterBookReader(page);await chooseBookPage(page,'1-168');
 const card=page.locator('[data-source-id="hansol-direct-1-168-25"]');await expect(card).toBeVisible();
 await expect(page.locator('.direct-reading-notice')).toContainText('자가확인');
 const image=card.locator('.direct-viewport img').first();
 await expect(image).toHaveJSProperty('naturalWidth',textbookDirectImage(textbookDirectPageMap.get('1-168')!).pixelSize[0]);
 await expect(card.locator('.direct-solution')).not.toHaveAttribute('open','');
 const choice=card.getByRole('button',{name:'②',exact:true});await choice.click();await expect(choice).toHaveAttribute('aria-pressed','true');
 expect(await page.evaluate(()=>localStorage.getItem('cbt-book-direct-choice-v1::hansol-direct-1-168-25'))).toBe('2');
 await expect(card.locator('.direct-solution')).toHaveAttribute('open','');
 await expect(card.locator('.direct-answer-label')).toContainText('정답 ②');
 for(const theme of ['light','dark']){
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  const filter=await image.evaluate(el=>getComputedStyle(el).filter);
  if(theme==='dark')expect(filter).toContain('invert');else expect(filter).toBe('none');
 }
 await card.screenshot({path:`/private/tmp/hansol-direct-${info.project.name}.png`});
 await card.locator('.direct-full-page summary').click();await expect(card.locator('.direct-full-page img')).toHaveCount(1);
 await expect(card.locator('.direct-full-page img')).toHaveJSProperty('complete',true);
 await chooseBookPage(page,'1-173');await chooseBookPage(page,'1-168');
 await expect(choice).toHaveAttribute('aria-pressed','true');await choice.click();await expect(choice).toHaveAttribute('aria-pressed','false');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const formerlyUnseparated=data.locations.find((r:any)=>!r.split);await chooseBookPage(page,formerlyUnseparated.page);
 const repaired=page.locator(`[data-source-id="${formerlyUnseparated.id}"]`);
 await expect(repaired.locator('.direct-caution')).toHaveCount(0);
 await expect(repaired.locator('.direct-solution-parts')).toHaveCount(0);
 await repaired.locator('.direct-solution>summary').click();
 await expect(repaired.locator('.direct-explanation-text')).toContainText('질소 78%');
 await repaired.locator('.direct-solution-original>summary').click();await expect(repaired.locator('.direct-solution-parts img')).toBeVisible();
});
