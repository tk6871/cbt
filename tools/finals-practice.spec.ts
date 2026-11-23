import {expect,test} from '@playwright/test';
import {finalAuthoredItems} from '../src/cbt/finalCourseBank';
import {selectFinalItems} from '../src/cbt/finalSelection';
import {bookSubject} from '../src/cbt/printedSubject';
test('수업 예상 후보 선택과 같은 유형 제외는 원본을 바꾸지 않는다',()=>{
  for(const subject of ['sports','metal'] as const){
    const all=finalAuthoredItems.filter(i=>i.round.id.endsWith(subject));
    expect(selectFinalItems(all,subject,{expected:false,exclude:false})).toEqual(all);
    expect(selectFinalItems(all,subject,{expected:false,exclude:true}).length).toBeLessThan(all.length);
    const draws=new Set<string>();
    for(let i=0;i<12;i++){
      const s=selectFinalItems(all,subject,{expected:true,exclude:true});
      expect(s).toHaveLength(10);draws.add(s.map(i=>i.id).sort().join());
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
  for(const name of ['제관공학','스포츠리더십']){
    const card=hub.locator('article').filter({has:page.getByRole('heading',{name,exact:true})});
    const url=await card.locator('a').getAttribute('href');expect((await (await page.request.get(url!)).body()).subarray(0,5).toString()).toBe('%PDF-');
    await card.locator('select').selectOption('pick');
    await expect(card.getByRole('checkbox')).toBeChecked();
    await card.getByRole('button',{name:'학습모드',exact:true}).click();
    await expect(page.locator('#session-question-1')).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').itemIds?.length)).toBe(10);
    await page.goto('about:blank');await page.goto('./?safe=1#/study/school');
  }
});
