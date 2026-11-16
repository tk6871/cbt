import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // PWA registration is tested separately. Keep the recovery toast from obscuring the UI in these tests.
    Reflect.deleteProperty(Navigator.prototype, 'serviceWorker');
  });
});

test('optional lounge preserves default home, navigation and saved preference', async ({ page }, testInfo) => {
  const errors: string[] = [];
  const backgrounds: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('assets/lounge/')) backgrounds.push(request.url()); });
  await page.goto('/');
  const entry = page.getByRole('button', { name: '학습 라운지 둘러보기 ↗' });
  await expect(entry).toBeVisible({ timeout: 15000 });
  expect(backgrounds).toHaveLength(0);
  await entry.click();
  const lounge = page.getByRole('region', { name: '학습 라운지' });
  await expect(lounge).toBeVisible();
  await expect(lounge.locator('img')).toBeVisible();
  await expect.poll(() => lounge.locator('img').evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await page.reload();
  await expect(lounge).toBeVisible();
  await lounge.getByRole('button', { name: /복습 데스크/ }).click();
  await expect(lounge.getByRole('button', { name: /이어서 공부하기/ })).toBeVisible();
  await lounge.getByRole('button', { name: /오답노트/ }).click();
  await expect(lounge).toHaveCount(0);
  await page.goBack();
  await expect(lounge).toBeVisible();
  await lounge.getByRole('button', { name: /자료실/ }).click();
  await expect(lounge.getByRole('button', { name: /교재 페이지별/ })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('lounge.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await lounge.getByRole('button', { name: '기존 홈으로 돌아가기 ↗' }).click();
  await expect(entry).toBeVisible();
  await page.reload();
  await expect(entry).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('unified-cbt-home-layout'))).toBe('classic');
  expect(errors).toEqual([]);
});

test('settings can switch home and image failure leaves navigation usable', async ({ page }, testInfo) => {
  await page.route('**/assets/lounge/*', route => route.abort());
  await page.goto('/');
  await page.locator('.topbar').getByRole('button', { name: /설정/ }).click();
  const group = page.locator('[data-setting="homeLayout"]');
  await expect(group).toBeVisible();
  await group.getByRole('button', { name: /학습 라운지/ }).click();
  await page.getByRole('button', { name: '설정 닫기', exact: true }).click();
  const lounge = page.getByRole('region', { name: '학습 라운지' });
  await expect(lounge).toBeVisible();
  await expect(lounge.locator('img')).toHaveCount(0);
  await lounge.getByRole('button', { name: /회차별 문제/ }).click();
  await expect(page.locator('.round-card').first()).toBeVisible();
  await page.goBack();
  await expect(lounge).toBeVisible();
  await page.locator('.topbar').getByRole('button', { name: /라이트 모드/ }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (testInfo.project.name === 'desktop') await page.setViewportSize({ width: 3840, height: 2160 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('lounge-light-fallback.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
