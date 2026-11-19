import {expect,test,type Page} from '@playwright/test';
test.use({serviceWorkers:'block'});
const key='unified-cbt-learning-session-industrial';
const saved=(page:Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{}'),key);

test('이전 학교 종목을 저장한 사용자도 기출로 진입하고 기말고사는 메뉴에서만 연다',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('modern-cbt-qualification-industrial','school-exams');
    localStorage.setItem('modern-cbt-qualification-industrial-last-regular','hvac');
  });
  await page.goto('./?safe=1');
  await page.getByRole('button',{name:'회차별 기출 고르기',exact:true}).click();
  await expect(page.locator('.round-card').first()).toBeVisible();
  await expect(page.locator('.material-switch button')).toHaveCount(2);
  await page.getByRole('button',{name:/종목 변경/}).click();
  await expect(page.locator('.subject-dialog button').filter({hasText:/중간고사|기말고사|학교 시험/})).toHaveCount(0);
  await page.keyboard.press('Escape');
  if (!await page.locator('.sidebar').getByRole('button',{name:'기말고사'}).isVisible())
    await page.getByRole('button',{name:'메뉴 열기'}).click();
  await page.locator('.sidebar').getByRole('button',{name:'기말고사'}).click();
  await expect(page.getByRole('heading',{name:'기말고사',exact:true})).toBeVisible();
  await page.locator('.finals-hub article').filter({hasText:'냉동공학'}).getByRole('button',{name:'학습모드'}).click();
  await expect(page.locator('#session-question-1')).toBeVisible();
  await expect.poll(async()=>(await saved(page)).title).toBe('기말고사 · 냉동공학');
  const ids:string[]=(await saved(page)).itemIds;
  expect(ids.length).toBeGreaterThan(10);
  expect(ids.some(id=>id.includes('2024-1'))).toBe(true);
  expect(ids.some(id=>/2024-[23]|2025|2026/.test(id))).toBe(false);
});

test('페이지 선택 초기화가 다른 쪽 답과 누적 기록을 보존한다',async({page})=>{
  await page.goto('./?safe=1#/study/school');
  await page.locator('.finals-hub article').filter({hasText:'에너지설비'}).getByRole('button',{name:'학습모드'}).click();
  const card=page.locator('.question-card').first();
  const pick=async(n:number)=>{
    const candidates=card.locator('.choice-button:visible,.image-choice-hotspot:visible,button[aria-label^="이미지에서"]:visible');
    await candidates.nth(n-1).click();
  };
  await expect(card).toBeVisible();
  await pick(2);
  await expect.poll(async()=>Object.values((await saved(page)).answers||{})).toEqual([2]);
  const initial=await saved(page);
  expect(initial.itemIds.length).toBeGreaterThan(1600);
  await page.keyboard.press('ArrowRight');await expect(page.locator('#session-question-1')).toHaveCount(0);
  await pick(3);
  await expect.poll(async()=>Object.keys((await saved(page)).answers||{}).length).toBe(2);
  const before=await saved(page);
  const records=()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('unified-industrial-cbt-v1')||'{}');return {attempts:s.attempts,bookmarks:s.bookmarks,history:s.history,wrong:s.wrong};});
  await expect.poll(async()=>Object.keys((await records()).attempts||{}).length).toBeGreaterThanOrEqual(2);
  const history=await records();
  await expect(card.getByRole('button',{name:/이 문제 초기화|초기화 되돌리기/})).toHaveCount(0);
  let reset=page.locator('.session-tools .reset-button');
  if (!await reset.isVisible()) {
    await page.locator('.session-menu-button:visible,.native-app-tabbar button:visible,.session-bottom-bar button:visible').filter({hasText:'메뉴'}).first().click();
    reset=page.locator('.session-drawer.open').getByRole('button',{name:'이 페이지 선택 초기화'});
  }
  page.once('dialog',d=>d.accept());
  await reset.click();
  expect((await saved(page)).answers).toEqual(initial.answers);
  expect((await saved(page)).page).toBe(before.page);
  await page.goto('./?safe=1');
  await expect(page.locator('.hybrid-actions button').first()).toHaveText('이어서 풀기');
  await page.locator('.hybrid-actions button').first().click();
  await expect(card).toBeVisible();
  expect((await saved(page)).answers).toEqual(initial.answers);
  expect((await saved(page)).itemIds).toEqual(initial.itemIds);
  expect(await records()).toEqual(history);
});

for (const [book,pageNumber,number,choice] of [['한솔 공조 교재','1-168',25,2],['에너지설비 교재','414',16,3]] as const) {
  test(book+' 이미지에서 선택한 답을 버튼 추가 없이 새로고침 후 복원한다',async({page})=>{
    await page.goto('./?safe=1');
    await page.getByRole('button',{name:'교재에서 풀기',exact:true}).click();
    const library=page.locator('.textbook-library');
    await library.locator('.library-books button').filter({hasText:book}).click();
    await library.getByRole('button',{name:'쪽번호로 바로 열기'}).click();
    const dialog=page.locator('dialog.library-page-dialog[open]');
    await dialog.locator('input').fill(pageNumber);
    await dialog.getByRole('button',{name:'문제 풀기'}).click();
    const row=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 '+number+'번',exact:true})});
    const printed=row.getByRole('button',{name:'이미지에서 '+choice+'번 선택',exact:true});
    await printed.click();
    await expect(printed).toHaveAttribute('aria-pressed','true');
    await expect(row.getByRole('button',{name:/이 문제 초기화|초기화 되돌리기/})).toHaveCount(0);
    await page.reload();
    await expect(printed).toHaveAttribute('aria-pressed','true');
    const other=row.getByRole('button',{name:'이미지에서 4번 선택',exact:true});
    await other.click();
    await page.reload();
    await expect(other).toHaveAttribute('aria-pressed','true');
    await expect(printed).toHaveAttribute('aria-pressed','false');
  });
}
