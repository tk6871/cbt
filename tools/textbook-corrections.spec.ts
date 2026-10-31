import {test,expect} from '@playwright/test';
import fs from 'node:fs';import crypto from 'node:crypto';
import vm from 'node:vm';
import corrections from '../data/textbook-corrections.json' with {type:'json'};
import {textbookEntries,textbookStudyItems,textbookSelectionKey} from '../src/cbt/textbookPages';
import {rasterDimensions} from './raster-dimensions.mjs';
test.use({serviceWorkers:'block'});
test('교재 정정 사본125개와 원본 해시·겹치지 않는 보기 영역',()=>{
 expect(Object.keys(corrections.entries)).toHaveLength(125);
 const sha=(p:string)=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 for(const row of Object.values(corrections.entries)){
  expect(sha(row.asset)).toBe(row.sha256);if(row.sourceImage)expect(sha(row.sourceImage)).toBe(row.sourceImageSha256);
  expect(row.size).toEqual(rasterDimensions(row.asset));
  const entry=textbookEntries.find(e=>e.book==='hansol'&&e.correction?.asset===row.asset)!;expect(entry.imageSize).toEqual(row.size);
  expect(row.choices).toHaveLength(4);expect(row.hotspots.map(b=>b.choice)).toEqual([1,2,3,4]);
  for(const b of row.hotspots){expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(100);expect(b.y+b.height).toBeLessThanOrEqual(100);}
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const a=row.hotspots[i],b=row.hotspots[j];expect(Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y))).toBe(0);}
 }
});
test('교재 인쇄정답 차이는 교재용 사본에만 적용하고 기존 원본·해설 보존',()=>{
 const context={window:{}};vm.runInNewContext(fs.readFileSync('data/hvac.js','utf8'),context);
 const bank=Object.values(context.window)[0] as any;const round=bank.rounds.find((r:any)=>r.id==='hvac-20140302');const question=round.questions.find((q:any)=>q.number===15);
 const before=JSON.stringify(question);const entry=textbookEntries.find(e=>e.book==='hansol'&&e.page==='1-29'&&e.number===4)!;
 expect(question.answer).toBe(4);expect(entry.correction?.answer).toBe(1);
 const [copy]=textbookStudyItems([{id:'hvac-20140302:15',round,question,subject:'공기조화설비'}],[entry]);
 expect(copy.question.answer).toBe(1);expect(copy.question.bookCorrection?.note).toContain('기존 CBT');
 expect(copy.question.explanation).toContain('정답표는1번');expect(copy.question.additionalExplanations?.some(e=>e.text===question.explanation)).toBe(true);
 expect(JSON.stringify(question)).toBe(before);expect(copy.id).not.toBe('hvac-20140302:15');
 const ambiguity=textbookEntries.find(e=>e.book==='hansol'&&e.page==='4-186'&&e.number===13)!.correction!;
 expect(ambiguity.note).toContain('0.0165');expect(ambiguity.explanation).toContain('9.66kW');
 expect(1.2*12/60*2501*(.0321-.016)).toBeCloseTo(9.663864,6);expect(1.2*12/60*2501*(.0321-.0165)).toBeCloseTo(9.363744,6);
 const cop=textbookEntries.find(e=>e.book==='hansol'&&e.page==='4-175'&&e.number===22)!.correction!;
 expect(cop.answer).toBe(2);expect(cop.explanation).toContain('6.7÷5.8');expect(6.7/5.8).toBeCloseTo(1.16,2);
 const impedance=textbookEntries.find(e=>e.book==='hansol'&&e.page==='5-107'&&e.number===55)!.correction!;
 expect(impedance.answer).toBe(2);expect(impedance.text).toContain('5%');expect(100/5).toBe(20);
 const variant=textbookEntries.find(e=>e.book==='hansol'&&e.page==='5-107'&&e.number===55)!;
 expect(textbookSelectionKey(variant)).not.toBe(textbookSelectionKey({...variant,correction:undefined}));
 expect(textbookSelectionKey(variant)).not.toBe(textbookSelectionKey({...variant,correction:{...impedance,text:impedance.text.replace('5%','4%')}}));
 for(const [page,number,reason] of [['1-165',8,'정답표·풀이 불일치'],['3-92',22,'②·③ 복수정답'],['3-348',27,'정답표·풀이가 달라']] as const){
  const held=textbookEntries.find(e=>e.book==='hansol'&&e.page===page&&e.number===number)!;
  expect(held.sourceId).toBeNull();expect(held.reviewHold).toBe(true);expect(held.pendingReason).toContain(reason);expect(textbookStudyItems([{id:'hvac-20140302:15',round,question,subject:'공기조화설비'}],[held])).toHaveLength(0);
  expect(textbookStudyItems([{id:'hvac-20140302:15',round,question,subject:'공기조화설비'}],[{...held,sourceId:entry.sourceId,fingerprint:entry.fingerprint}])).toHaveLength(0);
 }
 const ledger=JSON.parse(fs.readFileSync('tools/hansol-answer-conflict-review.json','utf8')).rows;
 expect(ledger).toHaveLength(12);
 for(const row of ledger){const e=textbookEntries.find(e=>e.book==='hansol'&&e.page===row.page&&e.number===row.number)!;
  if(row.decision==='held'){expect(e.reviewHold).toBe(true);expect(e.sourceId).toBeNull();}
  else{expect(e.sourceId).toBe(row.sourceId);expect(e.correction?.answer).toBe(row.bookAnswer);}
 }
 const formula=textbookEntries.find(e=>e.book==='hansol'&&e.page==='1-108'&&e.number===43)!;
 expect(formula.reviewHold).toBe(true);expect(formula.sourceId).toBeNull();expect(formula.pendingReason).toContain('면적A');expect(formula.pendingReason).toContain('kJ/h');expect(formula.pendingReason).toContain('kcal/h');
 const keys=JSON.parse(fs.readFileSync('tools/hansol-printed-key-review.json','utf8')).answers;
 expect(keys['1-116']['90']).toBe(3);expect(keys['1-117']['97']).toBe(3);
 expect(textbookEntries.some(e=>e.book==='hansol'&&e.page==='1-116'&&e.number===1)).toBe(false);
 expect(textbookEntries.find(e=>e.book==='hansol'&&e.page==='1-116'&&e.number===91)?.sourceId).toBe('hvac-hansol-2024-1:8');
 expect(corrections.entries['1-59:6'].choices[0]).toContain('2중덕트');expect(corrections.entries['1-141:39'].text).toContain('kg/kg′');
 expect(corrections.entries['1-112:66'].explanation).toContain('잠열1000W는');
 expect(corrections.entries['1-155:17'].text).toContain('압축기를');expect(corrections.entries['1-155:17'].choices[2]).toContain('빙축열');
 expect(corrections.entries['1-165:7'].choices[1]).toContain('덕트경로 결정');expect(keys['1-165']['7']).toBe(2);
 expect(corrections.entries['1-177:51'].choices[2]).toContain('420kJ');expect(corrections.entries['1-177:51'].explanation).toContain('2520kJ');
 for(const [page,number,reason] of [['1-177',49,'가습/감습'],['1-182',83,'효율이 낮다']] as const){const held=textbookEntries.find(e=>e.book==='hansol'&&e.page===page&&e.number===number)!;expect(held.sourceId).toBeNull();expect(held.reviewHold).toBe(true);expect(held.pendingReason).toContain(reason);}
 for(const [page,number,sourceId] of [['4-130',44,'hvac-hansol-2025-3:46'],['5-72',46,'hvac-hansol-2024-3:46'],['5-106',46,'hvac-hansol-2025-3:46']] as const)expect(textbookEntries.find(e=>e.book==='hansol'&&e.page===page&&e.number===number)?.sourceId).toBe(sourceId);
});
test('책 우선 오타 정정 이미지·직접 선택·원본 비교·해설',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('modern-cbt-qualification-industrial','hvac');localStorage.setItem('unified-cbt-dynamic-ui','false');localStorage.setItem('unified-cbt-answer-layout','hotspot');sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');});
 await page.addLocatorHandler(page.locator('.pwa-error-notice'),async()=>{await page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click();});
 await page.goto('/?safe=1');if((page.viewportSize()?.width||1440)<=900)await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
 const root=page.locator('.textbook-pages');await root.locator('.page-picker input').first().fill('1-15');
 const card=root.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 6번',exact:true})}).locator('.question-card');
 await expect(card.locator('.source-image-stage>img')).toHaveAttribute('src',/textbook-corrections/);await expect(card.locator('.image-answer-hotspot')).toHaveCount(4);
 await card.locator('.image-answer-hotspot').first().click();await expect(card.locator('.explanation-box')).toBeVisible();
 const image=card.locator('.source-image-stage>img');await page.evaluate(()=>document.documentElement.dataset.theme='dark');expect(await image.evaluate(el=>getComputedStyle(el).filter)).toContain('invert');await page.evaluate(()=>document.documentElement.dataset.theme='light');expect(await image.evaluate(el=>getComputedStyle(el).filter)).toBe('none');
 await card.getByText('수정 전 CBT 원본 비교',{exact:true}).click();await expect(card.locator('.book-correction-note img')).toHaveAttribute('src','assets/hvac-hansol/questions/2022_2/08.webp');
 await root.locator('.page-picker input').first().fill('1-25');const si=root.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 6번',exact:true})}).locator('.question-card');
 await si.locator('.image-answer-hotspot').nth(1).click();await expect(si.locator('.explanation-box')).toContainText('kJ/kg');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await root.locator('.page-picker input').first().fill('3-92');
 const held=root.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 22번',exact:true})});
 await expect(held.locator('.book-pending')).toContainText('②·③ 복수정답');await expect(held.locator('.question-card')).toHaveCount(0);
 await root.locator('.page-picker input').first().fill('1-29');
 const bookAnswerCard=root.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 4번',exact:true})}).locator('.question-card');
 await expect(bookAnswerCard.locator('.book-correction-note')).toContainText('정답표는1번');
 await bookAnswerCard.locator('.image-answer-hotspot').first().click();await expect(bookAnswerCard.locator('.explanation-box')).toContainText('정답표는1번');
 await root.getByRole('button',{name:'범위를 모아 CBT 시험',exact:true}).click();
 const note=page.locator('.book-correction-note').filter({hasText:'자세한 대조 내용은 학습모드'});
 await expect(note).not.toHaveCount(0);
 for(const text of await note.allTextContents()){expect(text).not.toContain('정답표는1번');expect(text).not.toContain('기존 CBT는4번');expect(text).not.toContain('9.36kW');}
 await expect(page.locator('.book-correction-note details')).toHaveCount(0);
 await expect(page.locator('.explanation-box')).toHaveCount(0);
});
