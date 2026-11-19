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

test('회차 카드의 초기화는 확인한 회차의 학습 답과 이어풀기 위치에만 적용된다',async({page})=>{
  const route='./?safe=1#/study/rounds';
  const card=(id:string)=>page.locator('#round-card-'+id);
  const target='hvac-20160306', other='hvac-20150816';
  async function pick(id:string,choice:number) {
    await card(id).getByRole('button',{name:/^(이어 학습|학습모드)$/}).click();
    const first=page.locator('#session-question-1');
    await first.locator('.choice-button:visible,button[aria-label^="이미지에서"]:visible').nth(choice-1).click();
    await expect.poll(async()=>(await saved(page)).answers[id+':1']).toBe(choice);
    await page.goto('about:blank');await page.goto(route);
  }
  const history=()=>page.evaluate(()=>{
    const {attempts,wrong,history,bookmarks}=JSON.parse(localStorage.getItem('unified-industrial-cbt-v1')||'{}');
    return {attempts,wrong,history,bookmarks};
  });
  await page.goto(route);
  const reset=card(target).getByRole('button',{name:/학습 초기화$/});
  await expect(reset).toBeDisabled();
  await pick(target,1);await pick(other,2);
  const before=await history(), unrelated=await saved(page);
  const title=await card(target).locator('h2').innerText();
  for (const accept of [false,true]) {
    const dialog=page.waitForEvent('dialog');const click=reset.click();
    const confirmation=await dialog;
    expect(confirmation.message()).toContain(title);
    if(accept) await confirmation.accept();else await confirmation.dismiss();
    await click;
    await expect(reset).toBeEnabled({enabled:!accept});
  }
  await page.reload();
  await expect(card(target).getByRole('button',{name:'학습모드',exact:true})).toBeVisible();
  await expect(card(other).getByRole('button',{name:'이어 학습',exact:true})).toBeVisible();
  expect((await saved(page)).answers).toEqual(unrelated.answers);
  expect(await history()).toEqual(before);
  await pick(target,3);
  page.once('dialog',d=>d.accept());
  await reset.click();await page.reload();
  await card(target).getByRole('button',{name:'학습모드',exact:true}).click();
  await expect.poll(async()=>(await saved(page)).page).toBe(0);
  expect((await saved(page)).answers).toEqual({});
});

test('풀이 도구와 해설 버튼을 좁은 화면에서도 읽고 사용할 수 있다',async({page},info)=>{
  if(info.project.name==='iphone-14-pro') await page.setViewportSize({width:320,height:740});
  await page.goto('./?safe=1#/study/rounds');
  await page.locator('#round-card-hvac-20160306').getByRole('button',{name:'학습모드',exact:true}).click();
  const card=page.locator('#session-question-1');
  const choice=card.locator('.choice-button').nth(3);
  await choice.click();
  const explanation=card.locator('.explanation-title:visible');
  await explanation.getByRole('button',{name:/자동 닫힘 멈추기/}).click();
  const close=explanation.getByRole('button',{name:'해설 닫기'});
  const buttons=[explanation.getByRole('button',{name:'해설 고정'}),close];
  if(info.project.name==='iphone-14-pro') buttons.push(choice,page.getByRole('button',{name:'북마크 추가'}).first(),page.getByRole('button',{name:'문자 크게'}));
  for(const b of buttons){
    const box=await b.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await close.click();await expect(explanation).toHaveCount(0);
  await page.getByRole('button',{name:'풀이 메뉴 열기'}).click();
  await expect(page.locator('.session-drawer.open')).toBeVisible();
  await page.locator('.session-drawer.open').getByRole('button',{name:'닫기',exact:true}).click();
  const jump=page.locator('.session-jump-form');
  await jump.getByRole('spinbutton').fill('17');await jump.getByRole('button',{name:'이동',exact:true}).click();
  await expect(page.locator('#session-question-17')).toBeVisible();
  await jump.getByRole('spinbutton').fill('1');await jump.getByRole('button',{name:'이동',exact:true}).click();
  await expect(choice).toHaveAttribute('aria-pressed','true');
});
