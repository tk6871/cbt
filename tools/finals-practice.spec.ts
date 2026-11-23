import {expect,test} from '@playwright/test';
import {finalAuthoredItems} from '../src/cbt/finalCourseBank';
import {selectFinalItems,metalBlock} from '../src/cbt/finalSelection';
import {bookSubject} from '../src/cbt/printedSubject';
import {energyPool,energyFamily,energyKey} from '../src/cbt/energyFinal';
import entries from '../data/textbook-pages.json' with {type:'json'};
import type {QuestionItem} from '../src/cbt/types';
test('에너지 전체·예상은 교재 안에서만 고르고 최신 반복 회차를 남긴다',()=>{
 const items=entries.entries.filter(e=>e.book==='energy').map(e=>({id:e.page+':'+e.number,sourceQuestionId:e.sourceId}) as QuestionItem);
 const all=energyPool(items,false,false), unique=energyPool(items,true,false), picks=energyPool(items,false,true);
 expect(all).toHaveLength(1680);expect(picks).toHaveLength(43);expect(unique.length).toBeLessThan(all.length);
 const ids=new Set(unique.map(i=>energyKey(i.sourceQuestionId)));
 expect(ids.has('2025-3:2')).toBe(true);expect(ids.has('2023-1:2')).toBe(false);
 expect(energyFamily('energy-industrial-restored-2025-3:2')).toContain('2023-1:2');
 expect(selectFinalItems(items,'energy',{expected:true,exclude:true})).toHaveLength(10);
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
      if(subject==='metal')for(const [block,n] of [['phase',5],['ttt',3],['thermal',2]])expect(s.filter(i=>metalBlock(i)===block)).toHaveLength(Number(n));
    }
    expect(draws.size).toBeGreaterThan(1);
  }
  expect(bookSubject('hansol','4-10',21)).toEqual({ordinal:2,name:'냉동냉장설비'});
  expect(bookSubject('hansol','5-108',59).ordinal).toBe(3);
});
test('주관식 두 문제와 체육·제관 예상 연습이 열린다',async({page})=>{
  await page.goto('./?safe=1#/study/school');
  const hub=page.locator('.finals-hub');
  await hub.getByText('주관식 연습 · 5점짜리 2문제',{exact:true}).click();
  await expect(hub.locator('textarea')).toHaveCount(2);
  await hub.locator('textarea').first().fill('내 답');
  await page.reload();
  await hub.getByText('주관식 연습 · 5점짜리 2문제',{exact:true}).click();
  await expect(hub.locator('textarea').first()).toHaveValue('내 답');
  for(const name of ['제관공학','스포츠리더십','에너지설비']){
    const card=hub.locator('article').filter({has:page.getByRole('heading',{name,exact:true})});
    if(name!=='에너지설비'){const url=await card.locator('a').getAttribute('href');expect((await (await page.request.get(url!)).body()).subarray(0,5).toString()).toBe('%PDF-');}
    await card.locator('select').selectOption('pick');
    await expect(card.getByRole('checkbox')).toBeChecked();
    await card.getByRole('button',{name:'학습모드',exact:true}).click();
    await expect(page.locator('#session-question-1')).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').itemIds?.length)).toBe(10);
    await page.goto('about:blank');await page.goto('./?safe=1#/study/school');
  }
});
test('제관 전체 첫 문제에는 해설이 붙지 않은 상태도 원도가 표시된다',async({page})=>{
 await page.goto('./?safe=1#/study/school');
 await page.locator('.finals-hub article').filter({has:page.getByRole('heading',{name:'제관공학',exact:true})}).getByRole('button',{name:'학습모드'}).click();
 const image=page.locator('#session-question-1 img[src$="/metal-fe-c.webp"]');
 await expect(image).toBeVisible();await expect.poll(()=>image.evaluate(e=>(e as HTMLImageElement).naturalWidth)).toBeGreaterThan(800);
 const files=[...new Set(finalAuthoredItems.flatMap(i=>i.question.images??[]))];
 expect(files).toHaveLength(3);
 for(const src of files)expect((await page.request.get(src)).ok()).toBe(true);
});
