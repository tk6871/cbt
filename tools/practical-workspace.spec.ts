import { test, expect, type Page } from '@playwright/test';
import { practicalContainsNumber, practicalContainsUnit, practicalExpectedNumbers, practicalExpectedUnits } from '../src/cbt/hvacPracticalTraining';
import type { PracticalPrompt } from '../src/cbt/hvacPracticalTypes';

test('숫자·단위 감지는 부분 문자열을 정답으로 오인하지 않는다', () => {
  expect(practicalContainsNumber('101.325 kPa', '1')).toBe(false);
  expect(practicalContainsNumber('-10 ℃', '10')).toBe(false);
  expect(practicalContainsNumber('1,000 W', '1000')).toBe(true);
  expect(practicalContainsNumber('1e3 W', '1000')).toBe(true);
  expect(practicalContainsUnit('100 kPa', 'Pa')).toBe(false);
  expect(practicalContainsUnit('10 mm', 'm')).toBe(false);
  expect(practicalContainsUnit('10 °C', '℃')).toBe(true);
  expect(practicalContainsUnit('10 m³/h', 'm³/h')).toBe(true);
  const sample = { answer: 'compressor 출구 -10℃, 100 kPa' } as PracticalPrompt;
  expect(practicalExpectedNumbers(sample)).toEqual(['-10','100']);
  expect(practicalExpectedUnits(sample)).toEqual(['℃','kPa']);
});

async function openPractice(page: Page) {
  await page.goto('./?safe=1#/study/guide');
  const question = page.locator('.practical-question-grid > article').first();
  const round = page.locator('.practical-round-library button').filter({hasText:/시작하기|이어풀기/}).first();
  await expect(question.or(round).first()).toBeVisible({timeout:15000});
  if (!await question.isVisible()) await round.click();
  await expect(question).toBeVisible();
}

test('CBT 흐름과 한/두/네/연속 보기, 작성 답안 보존', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openPractice(page);
  await expect(page.locator('.practical-extra-tools')).not.toHaveAttribute('open');
  const answer = page.locator('.practical-answer-input textarea').first();
  await answer.fill('압축기에서 냉매를 압축한다.');
  await page.getByRole('button', { name: /다음 문제/ }).click();
  await expect(answer).toHaveValue('');
  await page.getByRole('button', { name: /이전 문제/ }).click();
  await expect(answer).toHaveValue('압축기에서 냉매를 압축한다.');
  const layout = page.getByLabel('필답형 화면 배치');
  await layout.selectOption('2');
  await expect(page.locator('.practical-question-grid > article')).toHaveCount(2);
  await layout.selectOption('4');
  await expect(page.locator('.practical-question-grid > article')).toHaveCount(4);
  await expect(answer).toHaveValue('압축기에서 냉매를 압축한다.');
  await layout.selectOption('0');
  expect(await page.locator('.practical-question-grid > article').count()).toBeGreaterThan(4);
  await expect(page.locator('.practical-pagination')).toHaveCount(0);
  await layout.selectOption('single');
  await page.getByRole('button', { name: '정답·풀이 보기', exact: true }).click();
  await expect(page.locator('.practical-solution')).toBeVisible();
  await expect(page.locator('.practical-explanation')).toHaveAttribute('open');
  await expect(page.locator('.practical-solution')).toContainText('정답');
  await page.locator('.practical-extra-tools > summary').click();
  await page.getByRole('button', { name: '부분점수 채점', exact: true }).click();
  const criterion = page.locator('.practical-rubric-list button').first();
  await criterion.click();
  await expect(criterion).toHaveClass(/matched/);
  await criterion.click();
  await expect(criterion).not.toHaveClass(/matched/);
  expect(errors).toEqual([]);
});

test('이전 손글씨 환경에서도 현재 필답 입력과 기존 필기 저장값을 유지한다', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('unified-cbt-hvac-practical-study-mode-v1','handwrite');
    localStorage.setItem('unified-cbt-hvac-practical-pad-v1:test',JSON.stringify([{points:[[10,20],[14,22]]}]));
  });
  await openPractice(page);
  await expect(page.locator('.practical-answer-input textarea').first()).toBeVisible();
  await expect(page.getByRole('button',{name:/실전 답안지/})).toHaveCount(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-hvac-practical-pad-v1:test')!))).toEqual([{points:[[10,20],[14,22]]}]);
});

test('다시 접속해도 필답형 위치와 입력 답안을 복원한다', async ({ page }) => {
  await openPractice(page);
  await page.getByRole('button', { name: /다음 문제/ }).click();
  await page.locator('.practical-answer-input textarea').fill('2번 답안 이어쓰기');
  await openPractice(page);
  await expect(page.locator('.practical-answer-input textarea')).toHaveValue('2번 답안 이어쓰기');
  await expect(page.locator('.practical-page-center')).toContainText(/2\s*\/\s*12/);
});

test('계산 단계 연습은 기존 답안과 별도로 보존된다', async ({ page }) => {
  await openPractice(page);
  await page.getByRole('button',{name:'검색·범위',exact:true}).click();
  await page.locator('.practical-category-tabs').getByRole('button', { name: '계산', exact: true }).click();
  await page.locator('.practical-answer-input textarea').fill('기존 답안 유지');
  await page.getByRole('button', { name: '정답·풀이 보기', exact: true }).click();
  await page.locator('.practical-extra-tools > summary').click();
  await page.getByRole('button', { name: '부분점수 채점', exact: true }).click();
  await page.locator('.practical-calculation-retry > summary').click();
  await page.getByLabel('공식 다시 쓰기').fill('연습 공식');
  await page.locator('.practical-calculation-retry').getByRole('button', { name: '대입', exact: true }).click();
  await page.getByLabel('대입 다시 쓰기').fill('연습 대입');
  await expect(page.getByRole('textbox',{name:'내 답안',exact:true})).toHaveValue('기존 답안 유지');
  await page.locator('.practical-calculation-retry').getByRole('button', { name: '공식', exact: true }).click();
  await expect(page.getByLabel('공식 다시 쓰기')).toHaveValue('연습 공식');
});

test('캐시 준비 후 오프라인에서도 처음 여는 도우미와 학교 준비가 동작한다', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop');
  await openPractice(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await openPractice(page);
  await context.setOffline(true);
  await page.locator('.practical-extra-tools > summary').click();
  await expect(page.getByRole('button', { name: '답안 골격 넣기' })).toBeVisible();
  await expect(page.locator('.practical-answer-input textarea').first()).toBeVisible();
  await page.goto('./?safe=1#/study/school');
  await page.reload();
  await expect(page.getByRole('heading', { name: '학교 중간·기말고사 준비', exact: true })).toBeVisible();
  await context.setOffline(false);
});

test('반쪽 FHD·태블릿·4K에서 넘침 없이 배치된다', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await openPractice(page);
  for (const [width,height] of [[393,852],[960,1080],[1180,820],[1920,1080],[3840,2160]]) {
    await page.setViewportSize({ width, height });
    await page.locator('.practical-study-room').scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    const card = page.locator('.practical-question-grid > article').first();
    const container = page.locator('.practical-question-grid');
    const bounds = await card.boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual((await container.boundingBox())!.width + 1);
    await expect(card.locator('.practical-answer-input textarea')).toBeVisible();
    await page.screenshot({ path: `/private/tmp/cbt-practical-${width}.png`, fullPage: false });
  }
});
