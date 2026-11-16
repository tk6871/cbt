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

test('room names stay readable, unboxed and keyboard accessible at responsive widths', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: '학습 라운지 둘러보기 ↗' }).click();
  const lounge = page.getByRole('region', { name: '학습 라운지' });
  await expect.poll(() => lounge.locator('img').evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const widths = testInfo.project.name === 'desktop' ? [3840, 1920, 1440, 1024] : testInfo.project.name === 'tablet' ? [820, 768] : [393, 320];
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 3840 ? 2160 : 1000 });
    const rooms = lounge.getByRole('navigation', { name: '라운지 공간 선택' }).getByRole('button');
    await expect(rooms).toHaveText(['시험장', '복습 데스크', '자료실']);
    const image = await lounge.locator('img').boundingBox();
    expect(image).not.toBeNull();
    const bounds = [];
    for (const button of await rooms.all()) {
      const box = (await button.boundingBox())!;
      bounds.push(box);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(image!.x);
      expect(box.x + box.width).toBeLessThanOrEqual(image!.x + image!.width + 1);
      if (width <= 640) expect(box.y).toBeGreaterThanOrEqual(image!.y + image!.height);
      else {
        expect(box.y).toBeGreaterThan(image!.y);
        expect(box.y + box.height).toBeLessThan(image!.y + image!.height);
      }
      await button.hover();
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(lounge.locator('.lounge-room-intro h2')).toHaveText((await button.innerText()).trim());
      const decoration = await button.evaluate(el => {
        const css = getComputedStyle(el);
        return { background: css.backgroundColor, border: css.borderTopWidth, shadow: css.boxShadow, underline: getComputedStyle(el.querySelector('strong')!).textDecorationLine };
      });
      expect(decoration).toEqual({ background: 'rgba(0, 0, 0, 0)', border: '0px', shadow: 'none', underline: 'underline' });
    }
    for (let i = 1; i < bounds.length; i++) {
      const a = bounds[i - 1], b = bounds[i];
      expect(a.x + a.width <= b.x || a.y + a.height <= b.y).toBe(true);
    }
    // Enter through real keyboard navigation and activate the next space.
    await rooms.nth(0).focus();
    await page.keyboard.press('Tab');
    await expect(rooms.nth(1)).toBeFocused();
    expect(await rooms.nth(1).evaluate(el => { const s = getComputedStyle(el); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; })).toBe(true);
    await page.keyboard.press('Enter');
    await expect(rooms.nth(1)).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`lounge-keyboard-${width}.png`), fullPage: true });
    await rooms.nth(1).evaluate(el => (el as HTMLElement).blur());
    await page.mouse.move(0, 0);
    await page.screenshot({ path: testInfo.outputPath(`lounge-text-${width}.png`), fullPage: true });
    if (width === widths[0]) {
      await page.locator('.topbar').getByRole('button', { name: /라이트 모드/ }).click();
      await expect(rooms.nth(1)).toHaveAttribute('aria-pressed', 'true');
      await expect(lounge.locator('.lounge-heading h1')).toHaveCSS('color', 'rgb(16, 36, 63)');
      await page.screenshot({ path: testInfo.outputPath(`lounge-light-${width}.png`), fullPage: true, animations: 'disabled' });
      await page.locator('.topbar').getByRole('button', { name: /다크 모드/ }).click();
    }
  }
});
