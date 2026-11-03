import {test,expect} from '@playwright/test';
import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';
import {textbookEntries,textbookStudyItems} from '../src/cbt/textbookPages';
import {chooseBookPage,enterBookReader} from './textbook-reader-test-helpers';
import {rasterDimensions} from './raster-dimensions.mjs';
import {validateBookImagePipeline} from './hansol-book-image-validation.mjs';
test.use({serviceWorkers:'block'});
test('직접 검토한 교재 문제·예제·원래 해상도/기존 업스케일 이미지와 분리 답안 좌표',()=>{
 const audit=JSON.parse(fs.readFileSync('data/hansol-book-native-audit.json','utf8'));
 const review=JSON.parse(fs.readFileSync('tools/hansol-book-native-review.json','utf8')).rows;
 expect(audit.locations).toHaveLength(review.length);expect(Object.keys(audit.images)).toHaveLength(review.length*2);
 for(const im of Object.values(audit.images) as any[]){validateBookImagePipeline(im);expect(rasterDimensions(im.asset)).toEqual(im.outputSize);expect(crypto.createHash('sha256').update(fs.readFileSync(im.asset)).digest('hex')).toBe(im.outputSha256);}
 const w:any={window:{}};vm.runInNewContext(fs.readFileSync('data/hvac-hansol-book.js','utf8'),w);const bank=w.window.CBT_DATA_HVAC_HANSOL_BOOK;
 const items=bank.rounds.flatMap((round:any)=>round.questions.map((question:any)=>({id:`${round.id}:${question.number}`,round,question,subject:question._subject})));
 expect(items).toHaveLength(review.filter((r:any)=>r.kind==='mcq').length);const copies=textbookStudyItems(items);expect(copies).toHaveLength(items.length);
 for(const item of copies){expect(item.question.sourceImage).toMatch(/^assets\/hvac-hansol-book\/questions\//);expect(item.question.explanationImages).toHaveLength(1);expect(item.question.choices).toHaveLength(4);expect(item.question.answerHotspots).toHaveLength(4);const hs=item.question.answerHotspots!;
  for(const h of hs){expect(h.segments).toHaveLength(1);expect(h.x).toBeGreaterThanOrEqual(0);expect(h.y).toBeGreaterThanOrEqual(0);expect(h.x+h.width).toBeLessThanOrEqual(100);expect(h.y+h.height).toBeLessThanOrEqual(100);}
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const a=hs[i],b=hs[j];expect(Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y))).toBe(0);}
 }
 for(const page of ['2-11','2-13']){const e=textbookEntries.find(e=>e.book==='hansol'&&e.page===page)!;expect(e.workedExampleId).toBeTruthy();expect(e.pendingReason).toBeUndefined();}
});
test('직접 추가한 모든 객관식의 실제 화면 선택·취소와 영역 위치',async({page})=>{
 test.setTimeout(300000);
 await page.addInitScript(()=>localStorage.setItem('unified-cbt-hotspot-indicator','area'));
 const rows=JSON.parse(fs.readFileSync('tools/hansol-book-native-review.json','utf8')).rows.filter((r:any)=>r.kind==='mcq');
 await page.addInitScript(()=>{localStorage.setItem('modern-cbt-qualification-industrial','hvac');localStorage.setItem('unified-cbt-dynamic-ui','false');localStorage.setItem('unified-cbt-answer-layout','hotspot');sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');});
 await page.addLocatorHandler(page.locator('.pwa-error-notice'),async()=>{await page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click();});
 await page.goto('/?safe=1');await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();await enterBookReader(page);
 let count=0;
 for(const printedPage of [...new Set(rows.map((r:any)=>r.page))] as string[]){
  await chooseBookPage(page,printedPage);
  for(const row of rows.filter((r:any)=>r.page===printedPage)){
   const card=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:`교재 ${row.number}번`,exact:true})}).locator('.question-card');
   await card.locator('.source-image-stage>img').evaluate((im:HTMLImageElement)=>im.decode());
   const buttons=card.locator('.image-answer-hotspot');await expect(buttons).toHaveCount(4);await buttons.first().hover();
   const result=await card.evaluate(async(el)=>{
    const image=el.querySelector('.source-image-stage>img')!.getBoundingClientRect();
    const results=[];
    for(const button of el.querySelectorAll<HTMLButtonElement>('.image-answer-hotspot')){
     const before=button.getBoundingClientRect();button.click();await Promise.resolve();const selected=button.classList.contains('selected');const after=button.getBoundingClientRect();const highlight=el.querySelector('.image-answer-area-highlight')?.getBoundingClientRect();const sameArea=!!highlight&&Math.abs(before.x-highlight.x)<.1&&Math.abs(before.y-highlight.y)<.1&&Math.abs(before.width-highlight.width)<.1&&Math.abs(before.height-highlight.height)<.1;button.click();await Promise.resolve();
     results.push({selected,sameArea,cancelled:!button.classList.contains('selected'),relative:[(before.x-image.x)/image.width*100,(before.y-image.y)/image.height*100,before.width/image.width*100,before.height/image.height*100],stable:Math.abs(before.x-after.x)<.1&&Math.abs(before.y-after.y)<.1&&Math.abs(before.width-after.width)<.1&&Math.abs(before.height-after.height)<.1});
    }return results;
   });
   const [x,y,x1,y1]=row.crop;
   for(let i=0;i<4;i++){expect(result[i].selected,`${printedPage}:${row.number}:${i+1}`).toBe(true);expect(result[i].sameArea,`${printedPage}:${row.number}:${i+1} hover=selection`).toBe(true);expect(result[i].cancelled).toBe(true);expect(result[i].stable).toBe(true);const [a,b,c,d]=row.choiceRects[i];const expected=[(a-x)/(x1-x)*100,(b-y)/(y1-y)*100,(c-a)/(x1-x)*100,(d-b)/(y1-y)*100];for(let n=0;n<4;n++)expect(result[i].relative[n]).toBeCloseTo(expected[n],1);}
   count++;
  }
 }
 expect(count).toBe(rows.length);
});
test('교재 지연 로딩·분수 그림 선택/취소·원문 풀이·다크/라이트·저장 복원',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('modern-cbt-qualification-industrial','hvac');localStorage.setItem('unified-cbt-dynamic-ui','false');localStorage.setItem('unified-cbt-answer-layout','hotspot');sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');});
 await page.addLocatorHandler(page.locator('.pwa-error-notice'),async()=>{await page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click();});
 await page.goto('/?safe=1');await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();await enterBookReader(page);
 await chooseBookPage(page,'1-24');await expect(page.locator('.book-pending')).toHaveCount(0);
 const card=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 6번',exact:true})}).locator('.question-card');
 const im=card.locator('.source-image-stage>img');await expect(im).toHaveAttribute('src',/hvac-hansol-book/);await im.evaluate((im:HTMLImageElement)=>im.decode());await expect(card.locator('.explanation-box')).toHaveCount(0);
 const buttons=card.locator('.image-answer-hotspot');await expect(buttons).toHaveCount(4);for(let i=0;i<4;i++){await buttons.nth(i).click();await expect(buttons.nth(i)).toHaveClass(/selected/);await buttons.nth(i).click();await expect(buttons.nth(i)).not.toHaveClass(/selected/);}
 await buttons.nth(1).click();await expect(card.locator('.explanation-box')).toContainText('h₃−h₁');
 const figs=card.locator('.original-textbook-explanation');await expect(figs).toHaveCount(1);await figs.locator('summary').click();await expect(figs.locator('img')).toBeVisible();
 for(const theme of ['dark','light']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);const filter=await im.evaluate(el=>getComputedStyle(el).filter);if(theme==='light')expect(filter).toBe('none');else expect(filter).toContain('invert');}
 await page.screenshot({path:'/private/tmp/hansol-book-native-v572.png',fullPage:true});
 await page.reload();await expect(page.locator('.textbook-pages')).toBeVisible();await expect(page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 6번',exact:true})}).locator('.image-answer-hotspot').nth(1)).toHaveClass(/selected/);
 await chooseBookPage(page,'2-11');await expect(page.locator('.book-worked-example')).toHaveCount(1);await expect(page.locator('.book-pending')).toHaveCount(0);await expect(page.getByRole('button',{name:'범위를 모아 CBT 시험',exact:true})).toBeDisabled();
 await page.locator('.book-worked-example summary').click();await expect(page.locator('.book-worked-example details')).toContainText('0.087MPa');
 await chooseBookPage(page,'1-28');
 const original=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 22번',exact:true})}).locator('.question-card');
 const originalImage=original.locator('.source-image-stage>img');
 await expect(originalImage).toHaveAttribute('src',/1-28-22\.webp/);await originalImage.evaluate((im:HTMLImageElement)=>im.decode());
 expect(await originalImage.evaluate((im:HTMLImageElement)=>[im.naturalWidth,im.naturalHeight])).toEqual([1112,982]);
 await original.locator('.image-answer-hotspot').nth(3).click();
 await expect(original.locator('.explanation-box')).toContainText('h꜀−h₂');
 const solution=original.locator('.original-textbook-explanation');await solution.locator('summary').click();
 await expect(solution.locator('img')).toHaveAttribute('src',/1-28-22\.webp/);
 for(const theme of ['dark','light']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);for(const im of [originalImage,solution.locator('img')]){const filter=await im.evaluate(el=>getComputedStyle(el).filter);if(theme==='light')expect(filter).toBe('none');else expect(filter).toContain('invert');}}
 await page.screenshot({path:'/private/tmp/hansol-completed-images-v574.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
