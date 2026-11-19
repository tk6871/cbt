import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('문항·OMR 선택, 채점, 오답 복습과 기록에서 다시 풀기', async ({ page, hasTouch }) => {
  page.on('dialog', dialog => dialog.accept());
  await page.goto('./');
  await page.getByRole('button', { name: '회차별 기출 고르기' }).click();
  const round = page.locator('#round-card-hvac-20160306');
  await round.getByRole('button', { name: 'CBT 시험모드' }).click();
  const card = page.locator('[data-react-view="question-card"]').first();
  await expect(card).toBeVisible();
  const wrongChoice = card.locator('.choice-button').first();
  await wrongChoice.focus();
  await wrongChoice.press('Enter');
  await expect(wrongChoice).toHaveAttribute('aria-pressed', 'true');
  await card.getByRole('button', { name: '북마크 추가' }).click();

  const secondRow = page.locator('[data-omr-index="1"]');
  if (!await secondRow.isVisible()) await page.getByRole('button', { name: 'OMR 열기', exact: true }).click();
  const thirdChoice = secondRow.locator('span').nth(2);
  if (hasTouch) await thirdChoice.tap();
  else await thirdChoice.click();
  await page.locator('.omr-sheet').getByRole('button', { name: '채점하기', exact: true }).click();
  await expect(page.locator('[data-react-view="grade"] .result-actions')).toBeVisible();
  await page.getByRole('button', { name: '시작 화면으로' }).click();
  await page.goto('./#/study/history');
  await page.reload();
  const history = page.locator('[data-react-view="history"] .history-grid article');
  await expect(history).toHaveCount(1);
  await expect(history).toContainText('1점');
  await expect(history).toContainText('2/80');
  await expect(history).toContainText('오답 1개');

  await page.goto('./#/study/wrong');
  await page.reload();
  await page.locator('[data-react-view="wrong"]').getByRole('button', { name: '이 회차 오답 다시 풀기' }).click();
  await expect(page.locator('[data-react-view="question-card"]')).toHaveCount(1);
  await expect(card.getByRole('button', { name: '북마크 제거' })).toBeVisible();
  await page.goto('./#/study/history');
  await page.reload();
  await history.getByRole('button', { name: '같은 문제 다시 풀기' }).click();
  await expect(card).toBeVisible();
  await expect(card.locator('.choice-button[aria-pressed="true"]')).toHaveCount(0);
  await expect(card.getByRole('button', { name: '북마크 제거' })).toBeVisible();
});
