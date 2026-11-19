import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});

test('이전 배포본에서 작성한 회차 답·북마크·오답을 새 버전에서 이어 푼다',async({page})=>{
  test.skip(!process.env.CBT_PREVIOUS_BUILD_URL,'같은 출처에 이전 빌드를 제공할 때 검사합니다.');
  await page.goto(process.env.CBT_PREVIOUS_BUILD_URL!);
  await page.getByRole('button',{name:'회차별 기출 고르기',exact:true}).click();
  await page.locator('#round-card-hvac-20160306').getByRole('button',{name:'학습모드',exact:true}).click();
  const card=page.locator('#session-question-1');
  await card.getByRole('button',{name:'북마크 추가'}).click();
  await card.locator('.choice-button').first().click();
  const snapshot=()=>page.evaluate(()=>{
    const record=JSON.parse(localStorage.getItem('unified-industrial-cbt-v1')||'{}');
    const session=JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}');
    return {bookmarks:record.bookmarks,attempts:record.attempts,wrong:record.wrong,history:record.history,
      id:session.id,items:session.itemIds,answers:session.answers};
  });
  await expect.poll(async()=>Object.values((await snapshot()).answers||{})).toEqual([1]);
  const previous=await snapshot();
  await page.goto('/?safe=1');
  await page.locator('.hybrid-actions button').first().click();
  await expect(card.getByRole('button',{name:'북마크 제거'})).toBeVisible();
  await expect(card.locator('.choice-button').first()).toHaveAttribute('aria-pressed','true');
  expect(await snapshot()).toEqual(previous);
  await page.goto('/?safe=1#/study/rounds');
  const round=page.locator('#round-card-hvac-20160306');
  const footer=round.locator('footer');
  await expect(footer.getByRole('button',{name:'이어 학습'})).toBeVisible();
  for(const name of ['이어 학습','CBT 시험모드',/오답 \d+개/]){
    const button=footer.getByRole('button',{name,exact:true});
    await expect(button).toBeVisible();
    const style=await button.evaluate(el=>{const s=getComputedStyle(el);return [s.background,s.border,s.boxShadow,s.height,s.borderRadius];});
    const reference=await footer.getByRole('button',{name:'CBT 시험모드'}).evaluate(el=>{const s=getComputedStyle(el);return [s.background,s.border,s.boxShadow,s.height,s.borderRadius];});
    expect(style).toEqual(reference);
  }
});
