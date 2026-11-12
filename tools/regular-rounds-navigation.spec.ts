import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('교재에서 종목을 바꾸고 중간고사에서도 자격증 기출로 복귀', async ({ page }) => {
  await page.addLocatorHandler(page.locator('.pwa-error-notice'), async notice => {
    await notice.getByRole('button', { name: '나중에', exact: true }).click();
  });
  await page.goto('/?safe=1');
  await page.locator('.sidebar').getByRole('button', { name: /회차별 문제/ }).click();
  await page.getByRole('button', { name: '교재 페이지별', exact: true }).click();
  await page.getByLabel('현재 화면의 자격증 종목').selectOption('safety');
  await expect(page.getByRole('heading', { name: '산업안전산업기사 기출문제' })).toBeVisible();
  await expect(page.locator('.round-card').first()).toBeVisible();
  await page.getByRole('button', { name: '에너지설비 중간고사', exact: true }).click();
  await page.getByRole('button', { name: '자격증 기출', exact: true }).click();
  await expect(page.getByRole('heading', { name: '산업안전산업기사 기출문제' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '산업안전산업기사 기출문제' })).toBeVisible();
});
