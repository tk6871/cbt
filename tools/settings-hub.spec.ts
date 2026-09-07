import { expect, test, type Page } from '@playwright/test';

async function home(page: Page) {
  await page.goto('./?safe=1');
  await expect(page.getByRole('heading', { name: '준비할 종목을 선택하세요' })).toBeVisible({ timeout: 90000 });
  const later = page.getByRole('button', { name: '나중에', exact: true });
  if (await later.isVisible()) await later.click();
}
async function quick(page: Page) {
  await page.getByRole('button', { name: '설정 열기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '화면과 학습 데이터', exact: true })).toBeVisible();
}

test('기존 설명형 설정을 복원하고 전체 설정에도 동일한 항목을 표시한다', async ({ page }) => {
  await home(page);
  await quick(page);
  const popupKeys = await page.locator('[data-setting]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-setting')));
  expect(popupKeys).toEqual(expect.arrayContaining(['display', 'dynamic', 'experimental', 'judgment', 'solveLayout', 'visualStyle', 'theme', 'fontScale', 'fontFamily', 'imageTheme', 'answerLayout', 'indicator', 'data', 'backup']));
  await expect(page.locator('.settings-category-nav')).toHaveCount(0);
  await expect(page.locator('.display-mode-options button').first()).toContainText('기기 자동 인식');
  await page.getByRole('button', { name: '크게', exact: true }).click();
  await expect(page.getByRole('button', { name: '크게', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /전체 설정 열기/ }).click();
  await expect(page.locator('.settings-page')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.patch-timeline')).toHaveCount(0);
  expect(await page.locator('[data-setting]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-setting')))).toEqual(popupKeys);
  await page.getByRole('button', { name: '답안 선택', exact: true }).click();
  await expect(page.locator('[data-setting="answerLayout"]')).toBeInViewport();
  await expect(page.locator('[data-setting="display"]')).toBeVisible();
  await page.getByLabel('설정 찾기', { exact: true }).fill('D2Coding');
  await expect(page.locator('[data-setting="fontFamily"]')).toBeVisible();
  await page.getByRole('button', { name: /D2Coding Bold/ }).click();
  await expect(page.getByRole('button', { name: /D2Coding Bold/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('설정 찾기', { exact: true }).fill('선재');
  await expect(page.locator('[data-setting="visualStyle"]')).toBeHidden();
  await page.getByRole('button', { name: '기록·동기화', exact: true }).click();
  await expect(page.getByRole('button', { name: '기록 내보내기', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '전체 초기화', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.reload();
  await expect(page.locator('.settings-page')).toBeVisible({ timeout: 90000 });
  await page.getByLabel('설정 찾기', { exact: true }).fill('D2Coding');
  await expect(page.getByRole('button', { name: /D2Coding Bold/ })).toHaveAttribute('aria-pressed', 'true');
});

test('풀이 중 전체 설정은 답안을 유지하고 원래 풀이로 닫힌다', async ({ page }) => {
  await home(page);
  await page.locator('.learning-start').click();
  const answer = page.locator('.question-card .choice-button:not(.choice-layout-probe .choice-button)').first();
  await expect(answer).toBeVisible({ timeout: 90000 });
  await answer.click();
  await expect(answer).toHaveAttribute('aria-pressed', 'true');
  const answerText = await answer.textContent();
  const settings = page.locator('.session-tools').getByRole('button', { name: /설정/, exact: false });
  if (await settings.isVisible()) await settings.click();
  else {
    await page.locator('.session-menu-button').click();
    await page.getByRole('button', { name: /화면·문제풀이 설정/ }).click();
  }
  await page.getByRole('button', { name: /전체 설정 열기/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('설정 찾기', { exact: true }).fill('밝기');
  await page.getByRole('button', { name: /라이트.*밝은 화면/ }).click();
  await page.getByRole('button', { name: '풀이로 돌아가기', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(answer).toHaveText(answerText || '');
  await expect(answer).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.session-shell')).toBeVisible();
});

test('960px와 4K 크기에서 전체 설정의 읽기 폭을 제한한다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await home(page);
  await quick(page);
  await page.getByRole('button', { name: /전체 설정 열기/ }).click();
  for (const width of [960, 3840]) {
    await page.setViewportSize({ width, height: width === 3840 ? 2160 : 1080 });
    const panel = page.locator('.settings-page');
    await expect(panel).toBeVisible();
    await expect.poll(async () => { const box = await panel.boundingBox(); return box!.x + box!.width; }).toBeLessThanOrEqual(width + 1);
    const bounds = await panel.boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(1241);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
});
