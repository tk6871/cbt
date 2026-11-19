import {expect, test} from '@playwright/test';

test.use({serviceWorkers: 'block'});

test('쪽번호로 연 교재에서 같은 원문의 3D 해설을 펼치고 선택을 복원한다', async ({page}, info) => {
  await page.goto('./?safe=1');
  await page.getByRole('button', {name: '교재에서 풀기', exact:true}).click();
  const library = page.locator('.textbook-library');
  await library.locator('.library-books button').filter({hasText:'한솔 공조 교재'}).click();
  await library.getByRole('button', {name:'쪽번호로 바로 열기'}).click();
  const picker = page.locator('dialog.library-page-dialog[open]');
  await picker.locator('input').fill('1-182');
  await picker.getByRole('button', {name:'문제 풀기'}).click();
  const row = page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 81번',exact:true})});
  const choice = row.locator('.choice-button:visible,button[aria-label^="이미지에서"]:visible').nth(1);
  await choice.click();
  const button = row.getByRole('button', {name:'3D로 판형 열교환기 보기'});
  await expect(button).toBeVisible();
  await expect(row.locator('canvas')).toHaveCount(0);
  if (info.project.name === 'desktop') {
    await button.click();
    await expect(row.locator('canvas')).toBeVisible({timeout:25000});
    await row.getByRole('button',{name:'3D 접기'}).click();
  } else {
    await expect(button).toBeDisabled();
  }
  await page.reload();
  await expect(choice).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:/목차·쪽 선택/}).click();
  await expect(page.getByRole('navigation',{name:'교재 탐색 방식'}).getByRole('button')).toHaveText(['교재 목차','쪽번호 이동']);
});

test('패치노트에는 짧은 공개 버전과 이전 회차별 수정 내용이 있다', async ({page}) => {
  await page.goto('./?safe=1#/study/updates');
  const notes = page.locator('.patch-timeline article');
  await expect(notes.first().locator('.patch-version span')).toHaveText('v6.5.1');
  const versions = await notes.locator('.patch-version span').allTextContents();
  expect(versions).toContain('v6.4');
  expect(versions).toContain('v6.4.1');
  expect(versions.every(v => /^v\d+\.\d+(?:\.[1-9])?$/.test(v))).toBe(true);
  const archived = notes.filter({has:page.getByRole('heading',{name:'설비보전 기출과 공조 교재 해설',exact:true})});
  await archived.locator('summary').click();
  await expect(archived.getByText(/설비보전산업기사 2008년 3월·2007년 8월 ·/)).toBeVisible();
});

test('관리자 디렉터리 주소가 검색 매개변수와 화면 경로를 보존한다', async ({page}) => {
  await page.goto('./admin/?audit=1#/admin/members');
  await expect(page).toHaveURL(/\/admin\.html\?audit=1#\/admin\/members$/);
  await expect(page.locator('input[type=password]')).toBeVisible();
});

test('기말고사에서도 원문과 같은 압축기 모형을 열고 기말고사 ID에 답을 저장한다', async ({page}) => {
  await page.goto('./?safe=1#/study/school');
  await page.locator('.finals-hub article').filter({hasText:'냉동공학'}).getByRole('button',{name:'학습모드',exact:true}).click();
  const key = 'unified-cbt-learning-session-industrial';
  const id = 'school-cooling::hvac-hansol-2019-1:39';
  await expect(page.locator('#session-question-1')).toBeVisible();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}').itemIds?.length || 0,key)).toBeGreaterThan(0);
  const number = await page.evaluate(({id,key}) => JSON.parse(localStorage.getItem(key)!).itemIds.indexOf(id) + 1,{id,key});
  expect(number).toBeGreaterThan(0);
  await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill(String(number));
  await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
  const card = page.locator('#session-question-'+number);
  await card.locator('.choice-button:visible,button[aria-label^="이미지에서"]:visible').first().click();
  await expect(card.getByRole('button',{name:'3D로 왕복동 압축기 행정 보기'})).toBeVisible();
  await expect.poll(() => page.evaluate(({key,id}) => JSON.parse(localStorage.getItem(key)!).answers[id],{key,id})).toBe(1);
});
