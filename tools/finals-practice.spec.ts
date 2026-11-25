import {expect,test} from '@playwright/test';
import {finalAuthoredItems} from '../src/cbt/finalCourseBank';
import {selectFinalItems,metalBlock} from '../src/cbt/finalSelection';
import {energyFinalInScope,filterBookPractice,isTextbookCalculation} from '../src/cbt/textbookPracticeFilters';
import {bookSubject} from '../src/cbt/printedSubject';
import {energyPool,energyFamily,energyKey} from '../src/cbt/energyFinal';
import entries from '../data/textbook-pages.json' with {type:'json'};
import type {QuestionItem} from '../src/cbt/types';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import type {Round} from '../src/cbt/types';
test('지게차 선별 30문제는 원래 회차·번호의 지문, 보기 순서, 정답과 일치한다',()=>{
 const ctx={window:{} as {CBT_DATA_FORKLIFT_CRAFTSMAN?:{rounds:Round[]}}};
 runInNewContext(readFileSync('data/forklift-craftsman.js','utf8'),ctx);
 const items=finalAuthoredItems.filter(i=>i.id.startsWith('school-final-forklift:past:'));
 expect(new Set(items.map(i=>i.id)).size).toBe(30);
 for(const i of items){
   const [r,n]=i.id.slice('school-final-forklift:past:'.length).split(':');
   const original=ctx.window.CBT_DATA_FORKLIFT_CRAFTSMAN!.rounds.find(x=>x.id==='forklift-craftsman-'+r)!.questions.find(x=>x.number===+n)!;
   expect(i.question.text).toBe(original.text);expect(i.question.answer).toBe(original.answer);
   expect(i.question.choices.map(c=>c.text)).toEqual(original.choices.map(c=>c.text));
   expect([...(original.images||[]),...original.choices.flatMap(c=>c.images||[])]).toHaveLength(0);
 }
});
test('지게차 예상 네 세트는 각각 5·5·2·3이며 이전 문항을 빼도 구성된다',()=>{
 const all=finalAuthoredItems.filter(i=>i.round.id==='school-final-forklift');
 expect(all).toHaveLength(60);
 for(let j=0;j<12;j++){
   let left=all;
   for(let run=0;run<4;run++){
     const set=selectFinalItems(left,'forklift',{expected:true,exclude:true});
     expect(new Set(set.map(i=>i.id)).size).toBe(15);
     expect(['지게차','엔진','법규','일반안전'].map(k=>set.filter(i=>i.subject===k).length)).toEqual([5,5,2,3]);
     left=left.filter(i=>!set.includes(i));
   }
   expect(selectFinalItems(left,'forklift',{expected:true,exclude:false})).toEqual([]);
 }
});
test('지게차 3회에는 기능사 원 회차와 문제 번호를 표시한다',async({page})=>{
 await page.goto('./?safe=1#/study/school-forklift');
 const card=page.getByRole('article',{name:'3회 연습',exact:true});
 await expect(card).toContainText('기능사 기출 선별');
 await card.getByRole('button',{name:'학습모드'}).click();
 await expect(page.locator('#session-question-1')).toContainText('2009년 5회 25번');
});
test('지게차 기말 메뉴에서 주관식 복원 및 객관식 15문제 시작',async({page})=>{
 await page.goto('./?safe=1#/study/school');
 await page.getByRole('button',{name:'지게차',exact:true}).click();
 await page.getByRole('button',{name:/주관식 2문제/}).click();
 await page.getByLabel('윤활유 답안').fill('마찰과 마모 감소');
 await page.reload();
 await expect(page.getByLabel('윤활유 답안')).toHaveValue('마찰과 마모 감소');
 await expect(page.getByLabel('등화장치 답안')).toBeVisible();
 await page.getByRole('button',{name:'← 지게차 기말'}).click();
 const random=page.locator('.final-tool').filter({hasText:'예상 랜덤'});
 await random.locator('summary').click();
 await random.getByRole('button',{name:'CBT 시험모드'}).click();
 await expect(page.locator('#session-question-1')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').itemIds?.length)).toBe(15);
});
test('에너지 전체·예상은 교재 안에서만 고르고 최신 반복 회차를 남긴다',()=>{
 const items=entries.entries.filter(e=>e.book==='energy').map(e=>({id:e.page+':'+e.number,sourceQuestionId:e.sourceId}) as QuestionItem);
 const all=energyPool(items,false,false), unique=energyPool(items,true,false), picks=energyPool(items,false,true);
 expect(all).toHaveLength(1680);expect(picks).toHaveLength(43);expect(unique.length).toBeLessThan(all.length);
 const ids=new Set(unique.map(i=>energyKey(i.sourceQuestionId)));
 expect(ids.has('2025-3:2')).toBe(true);expect(ids.has('2023-1:2')).toBe(false);
 expect(energyFamily('energy-industrial-restored-2025-3:2')).toContain('2023-1:2');
 expect(selectFinalItems(items,'energy',{expected:true,exclude:true})).toHaveLength(10);
});
test('에너지 기말 경계, 최신 중복 유지 및 숫자만 바뀐 계산 변형 보존',()=>{
 const book=entries.entries.filter(e=>e.book==='energy').map(e=>({id:e.page+':'+e.number,sourceQuestionId:e.sourceId}) as QuestionItem);
 expect(energyPool(book.filter(energyFinalInScope),false,false)).toHaveLength(1280);
 const item=(year:number,page:string,temperature:number)=>({
   id:String(year),round:{id:'textbook-hansol-'+page,year,session:'1회',title:'냉동냉장설비'},
   question:{number:26,text:`고기가 ${temperature}℃일 때 5℃까지 냉각하는 데 필요한 열량은 얼마인가?`,choices:['22 kW','33 kW','44 kW','55 kW'].map(text=>({text})),answer:1},
 }) as QuestionItem;
 const a=item(2023,'5-8',20),b=item(2024,'5-43',20),c=item(2025,'5-79',25);
 expect(isTextbookCalculation(a)).toBe(true);
 const kept=filterBookPractice([a,b,c],{duplicates:true,similar:true,calculations:false});
 expect(kept.map(i=>i.id)).toEqual(['2024','2025']);
 expect(kept[0].question.midtermOccurrences).toHaveLength(2);
 expect(filterBookPractice([a,b,c],{duplicates:false,similar:false,calculations:true})).toEqual([]);
});
test('수업 예상 후보 선택과 같은 유형 제외는 원본을 바꾸지 않는다',()=>{
  for(const subject of ['sports','metal'] as const){
    const all=finalAuthoredItems.filter(i=>i.round.id.endsWith(subject));
    expect(selectFinalItems(all,subject,{expected:false,exclude:false})).toEqual(all);
    expect(selectFinalItems(all,subject,{expected:false,exclude:true}).length).toBeLessThan(all.length);
    const draws=new Set<string>();
    for(let i=0;i<12;i++){
      const s=selectFinalItems(all,subject,{expected:true,exclude:true});
      expect(s).toHaveLength(10);draws.add(s.map(i=>i.id).sort().join());
      if(subject==='metal')for(const [block,n] of [['phase',2],['ttt',2],['thermal',2],['materials',4]])expect(s.filter(i=>metalBlock(i)===block)).toHaveLength(Number(n));
    }
    expect(draws.size).toBeGreaterThan(1);
  }
  expect(bookSubject('hansol','4-10',21)).toEqual({ordinal:2,name:'냉동냉장설비'});
  expect(bookSubject('hansol','5-108',59).ordinal).toBe(3);
});
test('주관식 두 문제와 체육·제관 예상 연습이 열린다',async({page})=>{
  await page.goto('./?safe=1#/study/school');
  const hub=page.locator('.finals-hub');
  await expect(hub.locator('.final-subjects button')).toHaveText(['냉동공학','제관공학','스포츠리더십','에너지설비','지게차']);
  await expect(hub.locator('input,select')).toHaveCount(0);
  await hub.getByRole('button',{name:'냉동공학',exact:true}).click();
  await hub.getByRole('button',{name:/주관식 연습 열기/}).click();
  const written=page.getByRole('region',{name:'냉동공학 주관식'});
  await expect(page).toHaveURL(/school-written$/);
  await expect(written.locator('textarea')).toHaveCount(2);
  const initial=await written.locator('article h3').allTextContents();
  await written.getByLabel('풀 문제 수').fill('4');
  await written.getByRole('button',{name:'새 문제 뽑기',exact:true}).click();
  await expect(written.locator('textarea')).toHaveCount(4);
  expect((await written.locator('article h3').allTextContents()).some(t=>initial.some(s=>s.slice(3)===t.slice(3)))).toBe(false);
  await written.locator('textarea').first().fill('내 답');
  await page.reload();
  await expect(written.locator('textarea').first()).toHaveValue('내 답');
  await written.getByRole('button',{name:/냉동공학 회차 목록/}).click();
  await hub.getByRole('button',{name:/기말고사 과목 목록/}).click();
  for(const name of ['제관공학','스포츠리더십','에너지설비','냉동공학']){
    await hub.getByRole('button',{name,exact:true}).click();
    if(name==='제관공학'||name==='스포츠리더십'){const url=await hub.locator('a').getAttribute('href');expect((await (await page.request.get(url!)).body()).subarray(0,5).toString()).toBe('%PDF-');}
    const card=hub.locator('details').filter({has:page.locator('summary').filter({hasText:'예상 랜덤'})});
    await card.locator('summary').click();
    if(name==='에너지설비'||name==='냉동공학')await hub.getByLabel('비슷한 문제도 제외').check();
    else await expect(card.getByLabel('중복·비슷한 문제 제외')).toBeChecked();
    await card.getByLabel('풀 문제 수').fill('7');
    await card.getByRole('button',{name:'학습모드',exact:true}).click();
    await expect(page.locator('#session-question-1')).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').itemIds?.length)).toBe(7);
    await page.goto('about:blank');await page.goto('./?safe=1#/study/school');
  }
});
test('냉동 교재 8개 범위에서 선택한 60문제와 쪽수·풀이 기록을 다시 연다',async({page})=>{
 await page.goto('./?safe=1#/study/school');
 await page.getByRole('button',{name:'냉동공학',exact:true}).click();
 await expect(page.locator('.final-range')).toHaveCount(8);
 const course=page.getByRole('article',{name:'2회 연습',exact:true});
 await course.getByRole('button',{name:'학습모드',exact:true}).click();
 const card=page.locator('#session-question-1');
 await expect(card.locator('.printed-subject').first()).toContainText(/쪽 · \d+번/);
 await card.locator('.choice-button:visible,.image-choice-hotspot:visible,button[aria-label^="이미지에서"]:visible').first().click();
 await expect.poll(()=>page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers||{}).length)).toBe(1);
 await page.goBack();await expect(page).toHaveURL(/school-cooling$/);
 await expect(course).toContainText('최근 선택');
 await expect(course).toContainText('풀이 1/60');
});
test('제관 전체 첫 문제에는 해설이 붙지 않은 상태도 원도가 표시된다',async({page})=>{
 await page.goto('./?safe=1#/study/school');
 await page.getByRole('button',{name:'제관공학',exact:true}).click();
 await page.getByRole('article',{name:'1회 연습',exact:true}).getByRole('button',{name:'학습모드'}).click();
 const image=page.locator('#session-question-1 img[src$="/metal-exam-51.webp"]');
 await expect(image).toBeVisible();await expect.poll(()=>image.evaluate(e=>(e as HTMLImageElement).naturalWidth)).toBeGreaterThan(800);
 const files=[...new Set(finalAuthoredItems.flatMap(i=>i.question.images??[]))];
 expect(files).toHaveLength(1);
 for(const src of files)expect((await page.request.get(src)).ok()).toBe(true);
 const keys=[...new Set(finalAuthoredItems.flatMap(i=>i.question.explanationImages??[]))];
 expect(keys).toHaveLength(9);
 for(const src of keys)expect((await page.request.get(src)).ok()).toBe(true);
});
test('제관 기말에서 1 kW 단위 환산식과 PDF를 연다',async({page})=>{
 await page.goto('./?safe=1#/study/school-metal');
 const formula=page.locator('details').filter({hasText:'시험 계산 · 1 kW ≈ 860 kcal/h'});
 await formula.locator('summary').click();
 await expect(formula).toContainText('3,600 ÷ 4.1868 ≈ 859.85 kcal/h');
 await expect(formula).not.toContainText('물 1 kg');
 const link=await page.getByRole('link',{name:/시험 표시 자료/}).getAttribute('href');
 const res=await page.request.get(link!);
 expect(res.ok()).toBe(true);
 expect((await res.body()).subarray(0,5).toString()).toBe('%PDF-');
});
test('예상 랜덤에서 이전 추첨 제외를 켜면 직전 문항이 다시 나오지 않는다',async({page})=>{
 const draw=async()=>{
   await page.goto('./?safe=1#/study/school');
   await page.getByRole('button',{name:'스포츠리더십',exact:true}).click();
   const card=page.locator('.final-room details').filter({has:page.locator('summary').filter({hasText:'예상 랜덤'})});
   await card.locator('summary').click();
   await card.getByLabel('이전 추첨 문제 제외').check();
   await card.getByLabel('풀 문제 수').fill('5');
   await card.getByRole('button',{name:'학습모드'}).click();
   await expect(page.locator('#session-question-1')).toBeVisible();
   const ids=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').itemIds as string[]|undefined);
   await expect.poll(ids).toHaveLength(5);
   return (await ids())!;
 };
 const first=await draw();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('school-final-drawn-v1:sports')||'[]').length)).toBe(5);
 await page.goto('about:blank');
 const second=await draw();
 expect(second.filter(id=>first.includes(id))).toEqual([]);
});
