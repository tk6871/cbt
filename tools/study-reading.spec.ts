import {expect,test} from '@playwright/test';
import {enterBookReader,closeBookNavigator} from './textbook-reader-test-helpers';

test('네 문제 중 선택한 문항으로 집중하고 답과 위치를 보존한다',async({page})=>{
  await page.goto('./#/study/rounds');
  await page.locator('#round-card-hvac-20160306').getByRole('button',{name:'학습모드',exact:true}).click();
  const cards=page.locator('.question-columns .question-card');
  const second=page.locator('#session-question-2');
  await expect(cards).toHaveCount(4);
  await second.getByRole('button',{name:'2번 한 문제로 크게 보기'}).click();
  await expect(cards).toHaveCount(1);
  await second.locator('button.choice-button:visible').nth(2).click();
  await second.getByRole('button',{name:'네 문제로 돌아가기'}).click();
  await expect(cards).toHaveCount(4);
  await expect(second.locator('button.choice-button:visible').nth(2)).toHaveAttribute('aria-pressed','true');
  await expect(second.locator('.reading-focus')).toBeFocused();
  await page.locator('.pager-next').click();
  await page.locator('#session-question-7 .reading-focus').click();
  await expect(cards).toHaveCount(1);
  await page.locator('#session-question-7 .reading-focus').click();
  await expect(cards.first()).toHaveAttribute('id','session-question-5');
  await page.locator('.pager-prev').click();
  await expect(second.locator('button.choice-button:visible').nth(2)).toHaveAttribute('aria-pressed','true');
});

test('실제 기출의 단위와 보기 차이를 해설에서 읽는다',async({page})=>{
  await page.goto('./#/study/rounds');
  await page.locator('#round-card-hvac-20160306').getByRole('button',{name:'학습모드',exact:true}).click();
  for(let i=0;i<5;i++)await page.locator('.pager-next').click();
  const q=page.locator('#session-question-23');
  await q.locator('button.choice-button:visible').nth(2).click();
  const unit=q.locator('.reading-unit');
  await expect(unit.locator('output')).toHaveText('6.9kW');
  await unit.getByRole('button',{name:'W로 보기',exact:true}).click();
  await expect(unit.locator('output')).toHaveText('6,900 W');
  await unit.getByRole('button',{name:'kW로 보기',exact:true}).click();
  await expect(unit.locator('output')).toHaveText('6.9kW');
  const compare=q.locator('.reading-comparison');
  await compare.locator('summary').click();
  await compare.locator('select').first().selectOption('0');
  await compare.locator('select').nth(1).selectOption('2');
  await expect(compare.locator('p').nth(1)).toHaveText('6.9kW');
  const original=await compare.locator('p').allTextContents();
  await expect(compare.locator('mark')).toHaveCount(2);
  await compare.getByRole('button').click();
  await expect(compare.locator('mark')).toHaveCount(0);
  expect(await compare.locator('p').allTextContents()).toEqual(original);
});

test('일반 CBT 시험에서 이미 응답한 문항을 미응답 필터로 제외한다',async({page})=>{
  await page.goto('./#/study/rounds');
  await page.locator('#round-card-hvac-20160306').getByRole('button',{name:'CBT 시험모드',exact:true}).click();
  await page.locator('#session-question-1 button.choice-button:visible').first().click();
  const sheet=page.locator('.omr-sheet');
  if(!await sheet.locator('.omr-filter-bar').isVisible())await page.getByRole('button',{name:'OMR 열기',exact:true}).click();
  const rows=sheet.locator('[data-omr-index]');
  const total=await rows.count();
  await sheet.getByRole('button',{name:/^미응답 \d/}).click();
  await expect(rows).toHaveCount(total-1);
  await expect(sheet.locator('[data-omr-index="0"]')).toHaveCount(0);
  await sheet.getByRole('button',{name:'전체',exact:true}).click();
  await expect(rows).toHaveCount(total);
});

test('교재 단원 색인으로 실제 수록 쪽을 연다',async({page})=>{
  await page.goto('./#/study/rounds');
  await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
  await enterBookReader(page);await closeBookNavigator(page);
  const index=page.locator('.book-edge-index');
  await index.locator('summary').click();
  const tab=index.getByRole('button',{name:/냉동장치의 구조/});
  const printed=await tab.locator('small').innerText();
  await tab.click();
  await expect(page.locator('.reader-navigator-trigger')).toContainText(printed);
  await expect(page.locator('.book-sheet')).toBeVisible();
});

test('시안의 기본 서체와 회차 배치가 적용되고 이전 글꼴 선택은 유지된다',async({page})=>{
  await page.goto('./#/study/rounds');
  const heading=page.locator('.rounds-heading h1');
  await expect(heading).toHaveCSS('font-family',/CBT UI Sans/);
  await heading.evaluate(async el=>{await document.fonts.load('700 20px "CBT UI Sans"',el.textContent||'기출');});
  expect(await page.evaluate(()=>[...document.fonts].some(f=>f.family.includes('CBT UI Sans') && f.status==='loaded'))).toBe(true);
  const grid=page.locator('.round-grid');
  await expect(grid).toHaveAttribute('data-layout','cards');
  await expect(grid.locator('.photo-stage,.window-lights,.glass-lens')).toHaveCount(0);
  const years=page.getByRole('combobox',{name:'연도'});
  await years.selectOption('2025');
  await expect(grid.locator('.round-year-heading h2')).toHaveText(['2025년']);
  await expect(grid.locator('article')).toHaveCount(3);
  await years.selectOption('0');
  expect(await grid.locator('.round-year-heading').count()).toBeGreaterThan(1);
  expect(await page.locator('body').evaluate(el=>getComputedStyle(el,'::before').backgroundImage)).not.toContain('url(');
  await page.getByRole('button',{name:'목록',exact:true}).click();
  await page.reload();await expect(grid).toHaveAttribute('data-layout','list');
  await page.goto('./#/study/settings');
  await page.locator('.wall-picker').getByRole('button',{name:'빙하',exact:true}).click();
  await page.locator('[data-setting=fontFamily]').getByRole('button',{name:/D2Coding Regular/}).click();
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-font-family','d2coding');
  await page.goto('./#/study/rounds');await expect(heading).toHaveCSS('font-family',/D2Coding/);
  expect(await page.locator('body').evaluate(el=>getComputedStyle(el,'::before').backgroundImage)).toContain('IceCold');
});

test('집중 읽기에서 보기와 읽기 자를 조절하고 원래 네 문제로 복귀한다',async({page})=>{
  await page.goto('./#/study/rounds');
  await page.locator('#round-card-hvac-20160306').getByRole('button',{name:'학습모드',exact:true}).click();
  const card=page.locator('#session-question-2');
  await card.locator('.reading-focus').click();
  await card.getByText('집중 읽기 도구').click();
  await card.getByRole('button',{name:'보기 가리기'}).click();
  await expect(card.locator('.choice-grid-shell')).toHaveCount(0);
  await card.getByRole('button',{name:'읽기 자'}).click();
  await card.getByRole('slider').fill('75');
  await expect(card.locator('.focus-reading-rule')).toHaveAttribute('style',/75%/);
  await card.getByRole('button',{name:'보기 다시 표시'}).click();
  await expect(card.locator('button.choice-button:visible')).toHaveCount(4);
  await card.locator('.reading-focus').click();
  await expect(page.locator('.question-columns .question-card')).toHaveCount(4);
  await expect(page.locator('.focus-reading-rule')).toHaveCount(0);
});

test('원문 보기를 길게 눌러 옮긴 뒤 놓은 번호만 저장하고 정답 위치를 읽는다',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('unified-cbt-answer-layout','hotspot'));
  await page.goto('./#/study/rounds');
  await page.locator('#round-card-hvac-20261').getByRole('button',{name:'학습모드',exact:true}).click();
  const q=page.locator('#session-question-1');
  if(await q.getByRole('button',{name:'이미지로 보기',exact:true}).isVisible())await q.getByRole('button',{name:'이미지로 보기',exact:true}).click();
  const first=q.getByRole('button',{name:'이미지에서 1번 선택'}),third=q.getByRole('button',{name:'이미지에서 3번 선택'});
  await first.scrollIntoViewIfNeeded();await q.locator('.source-question-image').evaluate((el:HTMLImageElement)=>el.decode());
  const [a,b]=await Promise.all([first.boundingBox(),third.boundingBox()]);
  await page.mouse.move(a!.x+a!.width/2,a!.y+a!.height/2);await page.mouse.down();
  await expect(q.locator('.source-choice-lens')).toBeVisible();
  await page.mouse.move(b!.x+b!.width/2,b!.y+b!.height/2);
  await expect(q.locator('.source-choice-lens b')).toHaveText('3번');
  await page.mouse.up();
  await expect(third).toHaveAttribute('aria-pressed','true');await expect(first).toHaveAttribute('aria-pressed','false');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-industrial-cbt-v1')||'{}').attempts?.['hvac-20261:1']?.lastChoice)).toBe(3);
  await first.click();
  const overlay=page.locator('.reading-overlay:visible').first();
  await overlay.locator('summary').click();
  await expect(overlay.locator('figure img')).toBeVisible();
  expect(await overlay.locator('figure i').count()).toBeGreaterThan(0);
});

test('보석관 홈에서 세 조명을 바꾼다',async({page})=>{
  await page.goto('./jewelry.html#/study/home');
  const panel=page.locator('.gem-lighting');
  await panel.locator('summary').click();
  for(const [i,name] of ['주광','측면광','역광'].entries()){
    await panel.getByRole('button',{name}).click();
    await expect(panel.locator('.gem-study')).toHaveAttribute('data-light',String(i));
  }
});


test('계산기와 복구 화면도 기본은 클리어이고 선택한 재질을 공유한다',async({page})=>{
  for(const route of ['calculator.html','recovery.html']){
    await page.goto('./'+route);
    await expect(page.locator('html')).toHaveAttribute('data-glass','clear');
  }
  await page.goto('./#/study/settings');
  await page.locator('[data-setting=glass]').getByRole('button',{name:/프리즘 글라스/}).click();
  await page.goto('./calculator.html');
  await expect(page.locator('html')).toHaveAttribute('data-glass','prism');
});

test('두 번 제출한 같은 회차에서 이전 답과 이번 답을 문항별로 대조한다',async({page})=>{
  page.on('dialog',dialog=>dialog.accept());
  for(const selected of [1,3]){
    await page.goto('./#/study/rounds');
    await page.locator('#round-card-hvac-20160306').getByRole('button',{name:'CBT 시험모드',exact:true}).click();
    await page.locator('#session-question-1 button.choice-button:visible').nth(selected-1).click();
    const submit=page.locator('.omr-sheet').getByRole('button',{name:'채점하기',exact:true});
    if(!await submit.isVisible())await page.getByRole('button',{name:'OMR 열기',exact:true}).click();
    await submit.click();
    await expect(page.locator('[data-react-view="grade"] .result-actions')).toBeVisible();
    await page.getByRole('button',{name:'시작 화면으로'}).click();
  }
  await page.goto('./#/study/history');await page.reload();
  const comparison=page.locator('.record-comparison').first();
  await comparison.locator('summary').click();
  await expect(comparison.locator('tbody tr').first().locator('td')).toHaveText(['1번','3번']);
});
