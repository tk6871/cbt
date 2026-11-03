import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {enterBookReader,chooseBookPage} from './textbook-reader-test-helpers';
test.use({serviceWorkers:'block'});
const rows=JSON.parse(fs.readFileSync('tools/hansol-numeric-text-review.json','utf8')).rows.filter((r:any)=>r.reviewBatch==='values-48-2026-11-03'&&r.correction);

test('교재 수치 정정26곳: 직접선택·취소·책 조건 설명·원본 선도 유지',async({page})=>{
 test.setTimeout(180_000);
 await page.addInitScript(()=>{
  localStorage.setItem('modern-cbt-qualification-industrial','hvac');
  localStorage.setItem('unified-cbt-dynamic-ui','false');
  sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');
  sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');
 });
 await page.addLocatorHandler(page.locator('.pwa-error-notice'),async()=>{await page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click();});
 await page.goto('/?safe=1');
 await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();
 await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
 await enterBookReader(page);
 expect(rows).toHaveLength(26);
 for(const r of rows){
  await chooseBookPage(page,r.page);
  const card=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:`교재 ${r.number}번`,exact:true})}).locator('.question-card');
  await expect(card.locator('.source-image-stage')).toHaveCount(0);
  // The hidden layout probe contains four divs with the same styling class.
  const choices=card.locator('button.choice-button');await expect(choices).toHaveCount(4);
  await expect(card).toContainText(r.correction.text);
  for(let i=0;i<4;i++){
   const c=choices.nth(i);await expect(c).toContainText(r.correction.choices[i]);
   await c.hover();await c.click();await expect(c).toHaveClass(/selected/);
   if(i===(r.correction.answer??r.answer)-1)await expect(card.locator('.explanation-box')).toContainText(r.correction.explanation);
   await c.click();await expect(c).not.toHaveClass(/selected/);
  }
  if(r.page==='5-88')await expect(card.locator('img[src*="nq20070513m4.png"]')).toHaveCount(1);
  if(r.page==='1-114'&&r.number===78)await expect(card.locator('img[src*="nq20080727m17b"]')).toHaveCount(0);
  for(const theme of ['light','dark']){
   await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   expect(await card.locator('.question-text').evaluate(el=>getComputedStyle(el).color)).not.toBe('rgba(0, 0, 0, 0)');
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(['4-37','1-109'].includes(r.page))await card.screenshot({path:`/private/tmp/hansol-values-followup-${r.page}.png`});
 }
});
