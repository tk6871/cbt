import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import katex from 'katex';
import {textbookDirectSources} from '../src/cbt/textbookPages';
import {textbookExplanationText} from '../src/cbt/textbookExplanationText';
import {enterBookReader,chooseBookPage} from './textbook-reader-test-helpers';
test.use({serviceWorkers:'block'});

test('승인32개만 표시·7수식 KaTeX·원문 변경 시 이미지로 복귀',()=>{
 const data=JSON.parse(fs.readFileSync('data/textbook-explanation-text.json','utf8'));
 expect(data.entries).toHaveLength(32);
 const approved=textbookDirectSources.filter(r=>textbookExplanationText(r));
 expect(approved).toHaveLength(32);
 let formulae=0;
 for(const entry of data.entries){
  const source=textbookDirectSources.find(r=>r.id===entry.id)!;
  expect(textbookExplanationText(source)).toBeTruthy();
  for(const a of entry.assets)expect(crypto.createHash('sha256').update(fs.readFileSync(a.asset)).digest('hex')).toBe(a.sha256);
  for(const block of entry.blocks)if(block.tex){
   expect(katex.renderToString(block.tex,{throwOnError:true})).not.toContain('katex-error');formulae++;
  }
  expect(textbookExplanationText({...source,number:source.number+100})).toBeUndefined();
  expect(textbookExplanationText({...source,questionParts:[{...source.questionParts[0]!,rect:[0,0,1,1]}]})).toBeUndefined();
  expect(textbookExplanationText({...source,solutionParts:[]})).toBeUndefined();
 }
 expect(formulae).toBe(7);
 const guards=JSON.parse(fs.readFileSync('tools/hansol-direct-boundary-review.json','utf8')).preservedFiles;
 for(const [path,sha] of Object.entries(guards))expect(crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')).toBe(sha);
});

test('간결한 해설·분수/루트·원문 접기·표시설정 저장·미검토 이미지 유지',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('modern-cbt-qualification-industrial','hvac');
  localStorage.setItem('unified-cbt-dynamic-ui','false');
  sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');
  sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');
 });
 await page.addLocatorHandler(page.locator('.pwa-error-notice'),async()=>{await page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click();});
 await page.goto('/?safe=1');
 await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();
 await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();await enterBookReader(page);
 await chooseBookPage(page,'3-266');
 const card=page.locator('[data-source-id="hansol-direct-3-266-3"]');
 await expect(card.locator('.direct-explanation-text')).toHaveCount(0);
 await card.locator('.direct-solution>summary').click();
 const text=card.locator('.direct-explanation-text');
 await expect(text).toContainText('유효전력을 피상전력으로');
 await expect(text.locator('.katex .mfrac')).not.toHaveCount(0);
 await expect(text.locator('.katex .sqrt')).not.toHaveCount(0);
 await expect(card.locator('.direct-solution-parts')).toHaveCount(0);
 await card.locator('.direct-solution-original>summary').click();
 const original=card.locator('.direct-solution-parts img');await expect(original).toBeVisible();
 await original.evaluate((im:HTMLImageElement)=>im.decode());
 for(const theme of ['dark','light']){
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  await expect(text).toBeVisible();
  const filter=await original.evaluate(el=>getComputedStyle(el).filter);
  if(theme==='light')expect(filter).toBe('none');else expect(filter).toContain('invert');
 }
 await card.locator('.direct-solution-original>summary').click();
 await page.locator('.textbook-pages').getByRole('button',{name:'교재 풀이 설정',exact:true}).click();
 const setting=page.locator('[data-setting="explanationDisplay"]');
 await setting.getByRole('button',{name:/원문 이미지/}).click();
 expect(await page.evaluate(()=>localStorage.getItem('cbt-explanation-display-v1'))).toBe('image');
 await page.getByRole('button',{name:'설정 닫기',exact:true}).click();
 await expect(text).toHaveCount(0);await expect(card.locator('.direct-solution-parts img')).toBeVisible();
 await page.reload();await expect(page.locator('.textbook-pages')).toBeVisible();
 await card.locator('.direct-solution>summary').click();await expect(text).toHaveCount(0);
 await expect(card.locator('.direct-solution-parts img')).toBeVisible();
 await page.locator('.textbook-pages').getByRole('button',{name:/설정/}).click();
 await setting.getByRole('button',{name:/확인된 텍스트 우선/}).click();
 await page.getByRole('button',{name:'설정 닫기',exact:true}).click();
 await expect(text).toBeVisible();
 await card.screenshot({path:'/private/tmp/textbook-compact-explanation.png'});
 await chooseBookPage(page,'1-168');
 const unreviewed=page.locator('[data-source-id="hansol-direct-1-168-25"]');
 await unreviewed.locator('.direct-solution>summary').click();
 await expect(unreviewed.locator('.direct-explanation-text')).toHaveCount(0);
 await expect(unreviewed.locator('.direct-solution-parts img')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
