import {readOriginalAsset} from './read-original-asset.mjs';
import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {verifyTextbookPageHash} from './verify-textbook-page-hash.mjs';
import katex from 'katex';
import {textbookDirectSources} from '../src/cbt/textbookPages';
import {textbookExplanationText} from '../src/cbt/textbookExplanationText';
import {enterBookReader,chooseBookPage} from './textbook-reader-test-helpers';
test.use({serviceWorkers:'block'});

test('승인195개만 표시·43수식 KaTeX·원문 변경 시 이미지로 복귀',()=>{
 const data=JSON.parse(fs.readFileSync('data/textbook-explanation-text.json','utf8'));
 expect(data.entries).toHaveLength(195);
 const approved=textbookDirectSources.filter(r=>textbookExplanationText(r));
 const archivedId='hansol-direct-1-25-16';
 expect(data.entries.filter((entry:{id:string})=>entry.id===archivedId)).toHaveLength(1);
 expect(textbookDirectSources.some(source=>source.id===archivedId)).toBe(false);
 expect(approved).toHaveLength(194);
 let formulae=0;
 for(const entry of data.entries){
  const source=textbookDirectSources.find(r=>r.id===entry.id)!;
  for(const a of entry.assets)verifyTextbookPageHash(a.asset,a.sha256);
  for(const block of entry.blocks)if(block.tex){
   expect(katex.renderToString(block.tex,{throwOnError:true})).not.toContain('katex-error');formulae++;
  }
  if(entry.id===archivedId)continue;
  expect(textbookExplanationText(source)).toBeTruthy();
  expect(textbookExplanationText({...source,number:source.number+100})).toBeUndefined();
  expect(textbookExplanationText({...source,questionParts:[{...source.questionParts[0]!,rect:[0,0,1,1]}]})).toBeUndefined();
  expect(textbookExplanationText({...source,solutionParts:[]})).toBeUndefined();
 }
 expect(formulae).toBe(43);
});

test('교재 경계 감사 원본 지문 해시 보존',()=>{
 const guards=JSON.parse(fs.readFileSync('tools/hansol-direct-boundary-review.json','utf8')).preservedFiles;
 // Later main revisions published reviewed explanations in these three banks.
 // Keep every other file pinned to the original page-boundary audit.
 for(const [path,sha] of Object.entries(guards)){
  const baseline=crypto.createHash('sha256').update(execFileSync('git',['show','1d7fa8c8:'+path],{maxBuffer:80_000_000})).digest('hex');
  expect(baseline,path).toBe(sha);
  if(path==='data/textbook-pages.json')continue; // Verified by the per-entry preservation test.
  const reviewedHash=crypto.createHash('sha256').update(execFileSync('git',['show','4949bd09:'+path],{maxBuffer:80_000_000})).digest('hex');
  expect(crypto.createHash('sha256').update(readOriginalAsset(path)).digest('hex'),path).toBe(reviewedHash);
 }
});

test('간결한 해설·분수/루트·원문 접기·표시설정 저장·미검토 이미지 유지',async({page},testInfo)=>{
 await page.addInitScript(()=>{
  localStorage.setItem('modern-cbt-qualification-industrial','hvac');
  localStorage.setItem('unified-cbt-dynamic-ui','false');
  sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');
  sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');
 });
 await page.addLocatorHandler(page.locator('.pwa-error-notice'),async()=>{await page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click();});
 await page.goto('/?safe=1');
 await page.getByRole('button',{name:'회차별 기출 고르기',exact:true}).click();
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
 await page.getByRole('button',{name:'해설·이미지',exact:true}).click();
 const setting=page.locator('[data-setting="explanationDisplay"]');
 await setting.getByRole('button',{name:/원문 이미지/}).click();
 expect(await page.evaluate(()=>localStorage.getItem('cbt-explanation-display-v1'))).toBe('image');
 await page.getByRole('button',{name:'설정 닫기',exact:true}).click();
 await expect(text).toHaveCount(0);await expect(card.locator('.direct-solution-parts img')).toBeVisible();
 await page.reload();await expect(page.locator('.textbook-pages')).toBeVisible({timeout:30000});
 await card.locator('.direct-solution>summary').click();await expect(text).toHaveCount(0);
 await expect(card.locator('.direct-solution-parts img')).toBeVisible();
 await page.locator('.textbook-pages').getByRole('button',{name:/설정/}).click();
 await setting.getByRole('button',{name:/확인된 텍스트 우선/}).click();
 await page.getByRole('button',{name:'설정 닫기',exact:true}).click();
 await expect(text).toBeVisible();
 await card.screenshot({path:testInfo.outputPath('textbook-compact-explanation.png')});
 await chooseBookPage(page,'4-148');
 const unreviewed=page.locator('[data-source-id="hansol-direct-4-148-6"]');
 await unreviewed.locator('.direct-solution>summary').click();
 await expect(unreviewed.locator('.direct-explanation-text')).toHaveCount(0);
 await expect(unreviewed.locator('.direct-solution-parts img')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
