import {test,expect} from '@playwright/test';
import fs from 'node:fs';import vm from 'node:vm';
import {textbookEntries,textbookStudyItems} from '../src/cbt/textbookPages';
import {calculationGuideFor,comcbtCalculationExplanation} from '../src/cbt/calculationGuide';
import {enterBookReader,chooseBookPage} from './textbook-reader-test-helpers';
test.use({serviceWorkers:'block'});
test('교재 텍스트 정정9개·원본 불변·교재 전용 기록·그림 보존',()=>{
 const c:any={window:{}};for(const name of ['hvac','hvac-hansol'])vm.runInNewContext(fs.readFileSync(`data/${name}.js`,'utf8'),c);
 const originals:any[]=Object.values(c.window).flatMap((b:any)=>b.rounds.flatMap((round:any)=>round.questions.map((question:any)=>({id:`${round.id}:${question.number}`,question,round,subject:'냉동냉장설비'}))));
 const es=textbookEntries.filter(e=>e.correction?.presentation==='text');expect(es).toHaveLength(9);
 const before=JSON.stringify(originals),copies=textbookStudyItems(originals,es);expect(copies).toHaveLength(9);
 for(const q of copies){expect(q.question.sourceImage).toBeNull();expect(q.question.imageOnly).toBe(false);expect(q.question.answerHotspots).toBeUndefined();expect(q.question.sourceImageSize).toBeUndefined();expect(q.id).toMatch(/^book-study::hansol::/);expect(q.question.explanationProvenance).toBe('book-verified-correction');}
 for(const q of copies){expect(comcbtCalculationExplanation(q)).toBe('');expect(calculationGuideFor(q).formula).not.toContain('COMCBT 풀이식');}
 expect(calculationGuideFor(copies.find(q=>q.question.sourcePage?.includes('2-18쪽'))!).formula).toContain('1.23+0.1');
 expect(JSON.stringify(originals)).toBe(before);
 expect(copies.find(q=>q.question.sourcePage?.includes('2-20쪽'))!.question.images).toHaveLength(1);
 const changed=copies.find(q=>q.question.sourcePage?.includes('2-19쪽'))!;expect(changed.question.choices[0].images).toHaveLength(0);expect(changed.question.additionalExplanations?.some(e=>e.text?.includes('열당량'))).toBe(true);
 expect(textbookEntries.find(e=>e.book==='hansol'&&e.page==='2-272'&&e.number===1)?.correction).toBeUndefined();
 expect(textbookEntries.find(e=>e.book==='hansol'&&e.page==='2-63'&&e.number===17)?.correction).toBeUndefined();
});
test('텍스트 답안 직접 선택·취소·조건 맞는 해설·다크/라이트·그림',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('modern-cbt-qualification-industrial','hvac');localStorage.setItem('unified-cbt-dynamic-ui','false');sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');});
 await page.addLocatorHandler(page.locator('.pwa-error-notice'),async()=>{await page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click();});
 await page.goto('/?safe=1');await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();await enterBookReader(page);
 await chooseBookPage(page,'2-18');
 const card=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 1번',exact:true})}).locator('.question-card');
 await expect(card.locator('.source-image-stage')).toHaveCount(0);await expect(card).toContainText('1.23MPa');
 const correct=card.locator('.choice-button').nth(3);await expect(correct).toContainText('1.33');await correct.click();await expect(card.locator('.explanation-box')).toContainText('1.23+0.1');await card.screenshot({path:'/private/tmp/hansol-text-correction-v571-desktop.png'});await correct.click();await expect(correct).not.toHaveClass(/selected/);
 for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await expect(card).toContainText('1.23MPa');expect(await card.locator('.question-text').evaluate(el=>getComputedStyle(el).color)).not.toBe('rgba(0, 0, 0, 0)');}
 await chooseBookPage(page,'2-20');const figure=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 11번',exact:true})}).locator('.question-card');
 await expect(figure.locator('img[src*="nq20140817m21.png"]')).toHaveCount(1);
 await chooseBookPage(page,'2-19');const replaced=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 9번',exact:true})}).locator('.question-card');
 await expect(replaced).toContainText('1W는 3.6kJ/h');await expect(replaced.locator('img[src*="nq20160508m25b1"]')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
