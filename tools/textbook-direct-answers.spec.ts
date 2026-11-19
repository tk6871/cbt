import {test,expect} from '@playwright/test';
import answers from '../data/textbook-direct-answers.json' with {type:'json'};
import fullReview from '../data/textbook-direct-answer-review.json' with {type:'json'};
import {textbookDirectAnswer} from '../src/cbt/textbookDirectAnswer';
import {textbookDirectSources,textbookDirectPageMap,textbookEntries} from '../src/cbt/textbookPages';
import {chooseBookPage} from './textbook-reader-test-helpers';

test.use({serviceWorkers:'block'});
test('기존 15문항과 전체 정답표 검수 문항의 원문·좌표 보호',({},info)=>{
 test.skip(info.project.name!=='desktop');
 let count=0;
 for(const [page,proof] of Object.entries(answers)){
  const bookPage=textbookDirectPageMap.get(page)!;
  for(const [number,[answer]] of Object.entries(proof.answers)){
   const id=`hansol-direct-${page}-${number}`;
   const source=textbookDirectSources.find(r=>r.id===id)!;
   const entry=textbookEntries.find(r=>r.book==='hansol'&&r.page===page&&r.number===Number(number));
   expect(entry?.directSourceId ?? entry?.previousDirectId).toBe(id);
   expect(textbookDirectAnswer(source,bookPage)).toBe(answer);
   expect(textbookDirectAnswer(source,{...bookPage,sha256:'other'})).toBeUndefined();
   expect(textbookDirectAnswer({...source,split:false},bookPage)).toBeUndefined();
   expect(textbookDirectAnswer({...source,questionParts:[{...source.questionParts[0]!,rect:[0,0,1,1]}]},bookPage)).toBeUndefined();
   count++;
  }
 }
 expect(count).toBe(15);
 expect(textbookDirectSources.filter(s=>textbookDirectAnswer(s,textbookDirectPageMap.get(s.page)!))).toHaveLength(fullReview.entries.length);
 for(const source of textbookDirectSources){
  const page=textbookDirectPageMap.get(source.page)!;
  expect(textbookDirectAnswer(source,page)).toBe(fullReview.entries.find(e=>e.id===source.id)!.answer);
  expect(textbookDirectAnswer({...source,number:source.number+1000},page)).toBeUndefined();
  expect(textbookDirectAnswer({...source,solutionParts:[]},page)).toBeUndefined();
 }
});
test('교재 원문 정오답·재선택·기존 저장·선택 후 정답과 풀이 표시',async({page},info)=>{
 test.skip(info.project.name==='tablet');
 await page.addInitScript(()=>{
  localStorage.setItem('modern-cbt-qualification-industrial','hvac');
  if(!sessionStorage.getItem('seeded-legacy-answer')){
   localStorage.setItem('cbt-book-direct-choice-v1::hansol-direct-1-106-36','2');
   sessionStorage.setItem('seeded-legacy-answer','1');
  }
  localStorage.setItem('cbt-textbook-selected','hansol');
  sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');
 });
 await page.addLocatorHandler(page.locator('.pwa-error-notice'),()=>page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click());
 await page.goto('/?safe=1');
 if((page.viewportSize()?.width||1440)<=900)await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
 await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();
 await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
 await page.getByRole('button',{name:'쪽번호로 바로 열기 ↗',exact:true}).click();
 const dialog=page.locator('.library-page-dialog');
 await dialog.getByRole('textbox',{name:'쪽번호',exact:true}).fill('1-106');
 await dialog.getByRole('button',{name:'문제 풀기 →',exact:true}).click();
 const card=page.locator('[data-source-id="hansol-direct-1-106-36"]');
 await expect(card.locator('.direct-status')).toContainText('정답표 대조 완료');
 await expect(card.locator('.direct-grade')).toHaveText('틀렸어요 · 교재 정답 3번');
 await card.getByRole('button',{name:'③',exact:true}).click();
 await expect(card.locator('.direct-grade')).toHaveText('맞았어요 · 교재 정답 3번');
 await page.reload();
 await expect(card.locator('.direct-grade')).toHaveText('맞았어요 · 교재 정답 3번');
 await card.getByRole('button',{name:'③',exact:true}).click();
 await expect(card.locator('.direct-grade')).toHaveCount(0);
 await chooseBookPage(page,'1-168');
 const unverified=page.locator('[data-source-id="hansol-direct-1-168-25"]');
 await expect(unverified.locator('.direct-status')).toContainText('정답표 대조 완료');
 await unverified.getByRole('button',{name:'②',exact:true}).click();
 await expect(unverified.locator('.direct-grade')).toContainText('맞았어요');
 await expect(unverified.locator('.direct-solution')).toHaveAttribute('open','');
 await expect(unverified.locator('.direct-answer-label')).toHaveText('정답 ② · 2번');
 await chooseBookPage(page,'5-35');
 const pump=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 46번',exact:true})});
 const pumpChoice=pump.getByRole('button',{name:'이미지에서 3번 선택',exact:true});
 await pumpChoice.click();
 await expect(pumpChoice).toHaveAttribute('aria-pressed','true');
 await expect(pump.locator('.explanation-title')).toContainText('정답 3번');
 await expect(pump).toContainText('11.4');
 await chooseBookPage(page,'5-33');
 const q36=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 36번',exact:true})});
 await q36.locator('button.choice-button:visible,button.image-answer-hotspot:visible').first().click();
 await expect(q36.locator('.explanation-title')).toContainText('정답 1번');
});
