import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import vm from 'node:vm';
import {adjacentBookPage,normalizeBookPage,textbookStudyItems,textbookEntries} from '../src/cbt/textbookPages';
test.use({serviceWorkers:'block'});
test('쪽번호·독립 기록·수정 원문 차단',()=>{
 expect(normalizeBookPage('４－１０쪽')).toBe('4-10');
 expect(adjacentBookPage('hansol','4-10',1)).toBe('4-11');
 expect(adjacentBookPage('hansol','4-1',-1)).toBeUndefined();
 expect(adjacentBookPage('energy','645',1)).toBeUndefined();
 for(const book of ['hansol','energy']){
  const rows=textbookEntries.filter(e=>e.book===book);for(let i=1;i<rows.length;i++){
   const prior=rows[i-1],next=rows[i],order=prior.page.localeCompare(next.page,'ko',{numeric:true});
   expect(order).toBeLessThanOrEqual(0);if(!order)expect(prior.number).toBeLessThan(next.number);
  }
 }
 const context={window:{}};
 for(const k of ['hvac','hvac-hansol','energy-textbook','energy-restored','energy-book-earlier'])vm.runInNewContext(fs.readFileSync(`data/${k}.js`,'utf8'),context);
 const items=Object.values(context.window).flatMap((b:any)=>b.rounds.flatMap((r:any)=>r.questions.map((q:any)=>({round:r,question:q,subject:q.sourceSubject||q._subject||r.subjects[0],id:`${q._originRoundId||r.id}:${q._originalNumber||q.number}`}))));
 const snapshot=JSON.stringify(context.window),result=textbookStudyItems(items);
 const page=result.filter(i=>i.id.startsWith('book-study::hansol::4-10::'));
 expect(page.map(i=>i.question.number)).toEqual([17,18,19,20,21]);
 expect(page.map(i=>i.question.answer)).toEqual([3,3,3,2,4]);
 expect(new Set(result.map(i=>i.id)).size).toBe(result.length);
 expect(JSON.stringify(context.window)).toBe(snapshot);
 const changed=page[0];const original=items.find(i=>i.id===textbookEntries.find(e=>e.page==='4-10'&&e.number===17)!.sourceId)!;
 expect(textbookStudyItems([{...original,question:{...original.question,answer:1}}])).toHaveLength(0);
 expect(changed.id).not.toBe(original.id);
 const corrected=result.find(i=>i.id.startsWith('book-study::hansol::1-15::6::'))!;
 expect(corrected.question.choices[2].text).toBe('예상온열감(PMV)');
 expect(corrected.question.bookCorrection?.originalImage).toBe('assets/hvac-hansol/questions/2022_2/08.webp');
 expect(corrected.question.answerHotspots).toHaveLength(4);expect(corrected.question.sourceImage).toContain('textbook-corrections');
 const si=result.find(i=>i.id.startsWith('book-study::hansol::1-25::6::'))!;
 expect(si.question.choices.map(c=>c.text)).toEqual(['kJ/kgK','kJ/kg','W/m²K','W/mK']);expect(si.question.answer).toBe(2);expect(si.question.explanationProvenance).toBe('book-verified-correction');
 expect(si.question.explanation).toContain('kJ/kg');expect(items.find(i=>i.id==='hvac-20150531:5')!.question.choices[1].text).toBe('kcal/kg');
 expect(JSON.stringify(context.window)).toBe(snapshot);
});
test('책 형태 배치·쪽 넘김·선택과 복원·두 교재 전환',async({page},info)=>{
 await page.addInitScript(()=>{
  localStorage.setItem('modern-cbt-qualification-industrial','hvac');
  localStorage.setItem('unified-cbt-dynamic-ui','false');
  localStorage.setItem('unified-cbt-answer-layout','hotspot');
  sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');
  sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');
 });
 await page.addLocatorHandler(page.locator('.pwa-error-notice'),async()=>{await page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click();});
 async function open(){await page.goto('/?safe=1');if((page.viewportSize()?.width||1440)<=900)await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();}
 await open();const root=page.locator('.textbook-pages');
 await expect(root.locator('.book-sheet-question')).toHaveCount(5);
 await expect(root.locator('.book-sheet-column').nth(0).locator('h3')).toHaveText(['교재 17번','교재 18번','교재 19번']);
 await expect(root.locator('.book-sheet-column').nth(1).locator('h3')).toHaveText(['교재 20번','교재 21번']);
 const card=root.locator('.question-card').first();await expect(card.locator('.image-answer-hotspot')).toHaveCount(4);
 await card.locator('.image-answer-hotspot').nth(2).click();await expect(card.locator('.image-answer-hotspot').nth(2)).toHaveClass(/selected/);
 await expect(card.locator('.explanation-box')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`/private/tmp/textbook-${info.project.name}-book.png`,fullPage:true});
 await root.getByRole('button',{name:'다음 쪽 →',exact:true}).first().click();await expect(root.locator('.book-sheet>footer>strong')).toHaveText('4-11');
 await root.getByRole('button',{name:'← 이전 쪽',exact:true}).first().click();await expect(card.locator('.image-answer-hotspot').nth(2)).toHaveClass(/selected/);
 await open();await expect(root.locator('.question-card').first().locator('.image-answer-hotspot').nth(2)).toHaveClass(/selected/);
 await root.getByRole('button',{name:'에너지설비 교재',exact:true}).click();await expect(root.locator('.book-sheet-question')).not.toHaveCount(0);
 await expect(root.locator('.book-sheet>footer>strong')).toHaveText('442');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`/private/tmp/textbook-${info.project.name}-energy.png`,fullPage:true});
 await root.locator('.page-picker input').first().fill('450');
 const matchedCard=root.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 46번',exact:true})}).locator('.question-card');
 await expect(matchedCard.locator('.image-answer-hotspot')).toHaveCount(4);
 await matchedCard.locator('.image-answer-hotspot').first().click();
 await expect(matchedCard.locator('.beginner-primary-explanation strong')).toHaveText('COMCBT 해설');
 const original=matchedCard.locator('.original-textbook-explanation');
 await expect(original).not.toHaveAttribute('open');
 await original.locator('summary').click();
 const originalImage=original.locator('img').first();await expect(originalImage).toBeVisible();
 await originalImage.evaluate((img:HTMLImageElement)=>img.decode());
 expect(await originalImage.evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');
 expect(await originalImage.evaluate(img=>getComputedStyle(img).filter)).not.toBe('none');
 await page.evaluate(()=>document.documentElement.dataset.theme='light');
 expect(await originalImage.evaluate(img=>getComputedStyle(img).filter)).toBe('none');
 await original.locator('summary').click();await expect(originalImage).not.toBeVisible();
 await root.locator('.page-picker input').first().fill('336');
 const textbookCard=root.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 1번',exact:true})}).locator('.question-card');
 await textbookCard.locator('.image-answer-hotspot').nth(3).click();
 await expect(textbookCard.locator('.beginner-primary-explanation strong')).toHaveText('COMCBT 해설');
 await expect(textbookCard.locator('.beginner-primary-explanation')).not.toContainText('&gt;');
 if(info.project.name==='desktop'){
  await page.setViewportSize({width:3840,height:2160});await root.scrollIntoViewIfNeeded();
  expect((await root.boundingBox())!.width).toBeLessThanOrEqual(1500);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const columns=await root.locator('.book-sheet-column').all();
  expect((await columns[1].boundingBox())!.x).toBeGreaterThan((await columns[0].boundingBox())!.x);
  await page.screenshot({path:'/private/tmp/textbook-4k.png'});
 }
 await root.getByRole('button',{name:'범위를 모아 CBT 시험',exact:true}).click();
 const examCard=page.locator('.question-card').first();
 await expect(examCard.locator('.image-answer-hotspot.selected')).toHaveCount(0);
 await examCard.locator('.image-answer-hotspot').nth(3).click();
 await expect(examCard.locator('.explanation-box')).toHaveCount(0);
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}'));
 await expect.poll(async()=>Object.keys((await saved()).answers||{}).length).toBe(1);
 expect((await saved()).itemIds.every((id:string)=>id.startsWith('book-study::energy::336::'))).toBe(true);
 await open();
 await page.locator('.resume-learning-card').getByRole('button',{name:'이어서 풀기',exact:true}).click();
 await expect(page.locator('.question-card').first().locator('.image-answer-hotspot').nth(3)).toHaveClass(/selected/);
});
