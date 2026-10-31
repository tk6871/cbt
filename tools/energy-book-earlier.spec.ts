import {test,expect} from '@playwright/test';
import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';
import type {Catalog} from '../src/cbt/types';
import {textbookEntries,textbookStudyItems} from '../src/cbt/textbookPages';
test.use({serviceWorkers:'block'});
test('교재21회1680개 고유 문항·구회차640 정답/자산/좌표·기존 은행 보존',()=>{
 const w:{window:Record<string,Catalog>}={window:{}};
 for(const file of ['energy','energy-textbook','energy-midterm','energy-restored','energy-book-earlier'])vm.runInNewContext(fs.readFileSync(`data/${file}.js`,'utf8'),w);
 const bank=w.window.CBT_DATA_ENERGY_BOOK_EARLIER;
 expect(bank.rounds).toHaveLength(8);expect(bank.rounds.flatMap(r=>r.questions)).toHaveLength(640);
 const audit=JSON.parse(fs.readFileSync('data/energy-book-earlier-import-audit.json','utf8'));
 const printed=JSON.parse(fs.readFileSync('tools/energy-earlier-printed-answers.json','utf8'));
 expect(audit.buttonFallback).toEqual([]);expect(audit.geometryWithFourChoices).toBe(640);
 const sha=(p:string)=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 for(const [key,value] of Object.entries(audit.preservedBanks))expect(sha(`data/${key}.js`)).toBe(value);
 for(const row of Object.values(audit.images) as any[]){expect(sha(row.asset)).toBe(row.outputSha256);expect(row.outputSize).toEqual(row.sourceSize.map((n:number)=>n*2));expect(row.tile).toBe(256);expect(row.native).toBe('arm64');}
 for(const r of bank.rounds){
  expect(r.questions.map(q=>q.number)).toEqual(Array.from({length:80},(_,i)=>i+1));
  for(const q of r.questions){
   expect(q.answer).toBe(Number(printed[`${r.year}-${r.session?.replace(/회$/,'')}`].replace(/\s/g,'')[q.number-1]));
   const row=audit.rows.find((a:any)=>a.key===`${r.year}-${r.session.replace(/회$/,'')}-${q.number}`);
   expect(row.answer).toBe(q.answer);expect(q.answer).toBeGreaterThanOrEqual(1);expect(q.answer).toBeLessThanOrEqual(4);
   expect(q.imageOnly).toBe(true);expect(q.explanationImages).toHaveLength(1);expect(q.answerHotspots?.map(b=>b.choice)).toEqual([1,2,3,4]);
   const boxes=q.answerHotspots!;for(const b of boxes){expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.width).toBeGreaterThan(0);expect(b.height).toBeGreaterThan(0);expect(b.x+b.width).toBeLessThanOrEqual(100.01);expect(b.y+b.height).toBeLessThanOrEqual(100.01);}
   for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const a=boxes[i],b=boxes[j];expect(Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)),`${r.id}:${q.number}`).toBeLessThan(.02);}
  }
 }
 expect(bank.rounds[0].questions.find(q=>q.number===54)?.answer).toBe(2);
 const items=Object.values(w.window).flatMap(b=>b.rounds.flatMap(r=>r.questions.map(q=>({round:r,question:q,id:`${q._originRoundId||r.id}:${q._originalNumber||q.number}`,subject:q.sourceSubject||r.subjects[0]}))));
 const result=textbookStudyItems(items).filter(i=>i.id.startsWith('book-study::energy::'));
 expect(result).toHaveLength(1709);expect(new Set(textbookEntries.filter(e=>e.book==='energy').map(e=>e.sourceId)).size).toBe(1680);
 expect(w.window.CBT_DATA_ENERGY.rounds.flatMap(r=>r.questions)).toHaveLength(2640);
 expect(w.window.CBT_DATA_ENERGY_MIDTERM.rounds.flatMap(r=>r.questions)).toHaveLength(179);
 expect(w.window.CBT_DATA_ENERGY_TEXTBOOK.rounds.flatMap(r=>r.questions)).toHaveLength(191);
});
test('구회차 교재 로드·직접 선택·해설/원본·다크/라이트·쪽 저장과 CBT 이어풀기',async({page},info)=>{
 const requests:string[]=[],errors:string[]=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('modern-cbt-qualification-industrial','energy');localStorage.setItem('unified-cbt-dynamic-ui','false');localStorage.setItem('unified-cbt-answer-layout','hotspot');sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');});
 await page.addLocatorHandler(page.locator('.pwa-error-notice'),async()=>{await page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click();});
 async function open(){await page.goto('/?safe=1');if((page.viewportSize()?.width||1440)<=900)await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();}
 await open();expect(requests.some(p=>p.includes('energy-book-earlier.js'))).toBe(false);
 await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();const root=page.locator('.textbook-pages');await root.getByRole('button',{name:'에너지설비 교재',exact:true}).click();
 await root.locator('.page-picker input').first().fill('321');
 const card=root.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 1번',exact:true})}).locator('.question-card');
 await expect(card.locator('.image-answer-hotspot')).toHaveCount(4);
 const img=card.locator('.source-question-image');await img.evaluate((el:HTMLImageElement)=>el.decode());
 await card.locator('.image-answer-hotspot').nth(1).click();await expect(card.locator('.image-answer-hotspot').nth(1)).toHaveClass(/selected/);
 await expect(card.locator('.explanation-box')).toBeVisible();
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');expect(await img.evaluate(el=>getComputedStyle(el).filter)).toContain('invert');
 await page.evaluate(()=>document.documentElement.dataset.theme='light');expect(await img.evaluate(el=>getComputedStyle(el).filter)).toBe('none');
 await page.screenshot({path:`/private/tmp/energy-book-earlier-${info.project.name}.png`,fullPage:true});
 await root.getByRole('button',{name:'다음 쪽 →',exact:true}).first().click();await root.getByRole('button',{name:'← 이전 쪽',exact:true}).first().click();await expect(card.locator('.image-answer-hotspot').nth(1)).toHaveClass(/selected/);
 await root.locator('.page-picker input').first().fill('394');await expect(root.locator('.book-page-result')).toContainText('정답표만 있는 쪽');await expect(root).not.toContainText('아직 대조하지 않은 쪽');await root.locator('.page-picker input').first().fill('321');
 await root.locator('.page-picker input').nth(1).fill('321');await root.getByRole('button',{name:'범위를 모아 CBT 시험',exact:true}).click();
 const exam=page.locator('.question-card').first();await expect(exam.locator('.image-answer-hotspot.selected')).toHaveCount(0);await exam.locator('.image-answer-hotspot').nth(1).click();await expect(exam.locator('.explanation-box')).toHaveCount(0);
 await open();await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();await page.locator('.resume-learning-card').getByRole('button',{name:'이어서 풀기',exact:true}).click();await expect(page.locator('.question-card').first().locator('.image-answer-hotspot').nth(1)).toHaveClass(/selected/);
 expect(errors).toEqual([]);
});
