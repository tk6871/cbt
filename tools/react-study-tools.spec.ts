import {expect,test,type Page} from '@playwright/test';

async function open(page:Page,view:string){
  await page.goto('about:blank');
  await page.goto('./?safe=1#/study/'+view);
}

test('검색·복수 출처·계산 실험과 보조 화면의 정상 진입',async({page})=>{
  await open(page,'search');
  const query=page.getByPlaceholder(/냉동사이클/);
  await query.fill('압축기');
  await expect(page.locator('.search-library article').first()).toBeVisible({timeout:40000});
  await page.getByLabel('검색 출처').selectOption('selected');
  await expect(page.locator('.search-scope-controls fieldset')).toBeVisible();
  await page.getByRole('button',{name:/즐겨찾기 문제만 보기/}).click();
  await expect(page.locator('.bookmark-search-toggle')).toHaveAttribute('aria-pressed','true');
  await open(page,'calculation');
  await page.getByRole('button',{name:'수식 계산 실험',exact:true}).click();
  const lab=page.locator('.formula-workbench');await expect(lab).toBeVisible();
  await lab.getByRole('textbox').fill('2+3');
  await expect(lab.locator('.answer .katex-html')).toContainText('5');
  await lab.getByRole('textbox').fill('');
  await expect(lab.getByRole('status')).toContainText('수식 기호나 괄호');
  await lab.getByRole('button',{name:'예시로 초기화'}).click();
  await expect(lab.locator('.answer .katex-html')).toBeVisible();
  await lab.getByRole('button',{name:'닫기'}).click();await expect(lab).toHaveCount(0);
  for(const [view,marker] of [['coach','coach-view'],['beta','beta-view'],['showcase','showcase-view'],['stats','stats-view'],['updates','patch-view']]){
    await open(page,view!);await expect(page.locator('[data-react-view="'+marker+'"] h1').first()).toBeVisible();
  }
});

test('학교 시험지와 직접 입력한 보기·정답을 저장하고 다시 푼다',async({page})=>{
  await open(page,'school');
  await page.getByText('내 학교 시험 자료 · 이전 시험',{exact:true}).click();
  const school=page.locator('[data-react-view=school-exams]');
  await school.getByPlaceholder('예: 냉동공학').fill('설비 복습');
  await school.locator('.scope-form').getByLabel('학기').selectOption('2');
  await school.getByRole('button',{name:'시험지 만들기'}).click();
  await school.getByPlaceholder('객관식 문제를 입력하세요').fill('저장 확인용 문항');
  for(let n=1;n<=4;n++)await school.getByPlaceholder(n+'번 보기',{exact:true}).fill('검증 보기 '+n);
  await school.locator('.question-form').getByRole('combobox').selectOption('3');
  await school.getByRole('button',{name:'객관식 문제 추가'}).click();
  await page.reload();
  await page.getByText('내 학교 시험 자료 · 이전 시험',{exact:true}).click();
  await school.locator('.school-round-grid article').filter({hasText:'설비 복습'}).getByRole('button',{name:'학습모드',exact:true}).click();
  const card=page.locator('.question-card').first();await expect(card).toContainText('저장 확인용 문항');
  const third=card.locator('.choice-button').nth(2);await third.click();await expect(third).toHaveAttribute('aria-pressed','true');
  await expect(card.locator('.choice-button.correct')).toContainText('검증 보기 3');
});

test('필답 회차·답안·쪽 이동과 모바일 3D 설정 보존',async({page})=>{
  await open(page,'guide');
  await page.getByRole('button',{name:'필답형 문제풀이',exact:true}).click();
  await page.locator('.practical-round-library button').filter({hasText:'시작하기'}).first().click();
  await page.getByLabel('필답형 화면 배치').selectOption('single');
  const field=page.locator('.practical-answer-input textarea').first();
  await field.fill('흡입과 압축');
  await page.getByRole('button',{name:/다음 문제/}).last().click();await expect(field).toHaveValue('');
  await page.getByRole('button',{name:/이전 문제/}).last().click();await expect(field).toHaveValue('흡입과 압축');
  await page.getByLabel('필답형 화면 배치').selectOption('2');await expect(page.locator('.practical-question-grid > article')).toHaveCount(2);
  await page.getByRole('button',{name:'정답·풀이 보기',exact:true}).first().click();await expect(page.locator('.practical-solution').first()).toBeVisible();
  await open(page,'settings');await page.getByLabel('설정 찾기',{exact:true}).fill('모바일 3D');
  const panel=page.locator('[data-setting=mobileModel]');await expect(panel.getByRole('button',{name:'꺼짐'})).toHaveAttribute('aria-pressed','true');
  await panel.getByRole('button',{name:'눌러서 3D 보기 허용'}).click();await page.reload();
  await page.getByRole('button',{name:'해설·이미지',exact:true}).click();
  await expect(panel.getByRole('button',{name:'눌러서 3D 보기 허용'})).toHaveAttribute('aria-pressed','true');
});


for (const theme of [
  { space: 'industrial', name: 'simpsons', path: './', title: '공부 한 컷' },
  { space: 'jewelry', name: 'sunjae', path: './jewelry.html', title: '같이 달릴래?' },
]) {
  test(theme.name + ' 홈 표지에서 이미지와 회차 이동', async ({ page }) => {
    await page.addInitScript(({ space, name }) => {
      localStorage.setItem('unified-' + space + '-cbt-visual-style', name);
    }, theme);
    await page.goto(theme.path + '?safe=1#/study/home');
    const cover = page.locator('.fan-cover');
    await expect(cover.getByRole('heading')).toContainText(theme.title);
    await expect.poll(() => cover.locator('.fan-art img').evaluateAll(images =>
      images.length === 2 && images.every(image => (image as HTMLImageElement).naturalWidth > 0)
    )).toBe(true);
    await cover.getByRole('button', { name: /회차별 기출 고르기/ }).click();
    await expect(page).toHaveURL(/#\/study\/rounds/);
  });
}
