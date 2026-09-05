import { expect, test, type Page } from '@playwright/test';
test.setTimeout(30_000);

test.beforeEach(async ({ page }) => {
  // UI checks do not create analytics visits or alter the browser's SW cache.
  await page.route('**/cloud-config.js*', route => route.fulfill({ contentType: 'text/javascript', body: 'window.CBT_CLOUD_CONFIG = { enabled: false };' }));
  await page.addInitScript(() => {
    Reflect.deleteProperty(Navigator.prototype, 'serviceWorker');
    sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351', 'true');
  });
});

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

async function openWorkspace(page: Page, theme = 'default', path = './') {
  await page.addInitScript(theme => {
    localStorage.setItem('unified-cbt-screen-design', 'workspace');
    localStorage.setItem('unified-industrial-cbt-visual-style', theme);
    localStorage.setItem('unified-jewelry-cbt-visual-style', theme);
  }, theme);
  await page.goto(path);
  await expect(page.locator('.ws-home')).toBeVisible();
}

test('기존 화면이 기본이며 새 화면 전환과 안전모드가 동작한다', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', request => scripts.push(request.url()));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '준비할 종목을 선택하세요' })).toBeVisible();
  expect(scripts.some(url => /Workspace(Home|Navigation)-/.test(url))).toBe(false);
  await page.getByRole('button', { name: '설정 열기', exact: true }).click();
  await page.getByRole('button', { name: /새 디자인 빠른 시작/ }).click();
  await page.getByRole('button', { name: '설정 닫기', exact: true }).click();
  await expect(page.locator('.ws-home')).toBeVisible();
  await page.reload();
  await expect(page.locator('.ws-home')).toBeVisible();
  await noOverflow(page);
  await page.goto('./?safe=1');
  await expect(page.getByRole('heading', { name: '준비할 종목을 선택하세요' })).toBeVisible();
  await expect(page.locator('.ws-home')).toHaveCount(0);
});

for (const theme of ['simpsons', 'sunjae']) {
  test(`${theme} 사진 선택·확대·닫기와 메뉴가 다크·라이트에서 동작한다`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await openWorkspace(page, theme, theme === 'sunjae' ? './jewelry.html' : './');
    await page.getByRole('button', { name: '사진 2 선택', exact: true }).click();
    await expect(page.getByRole('button', { name: '사진 2 선택', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '테마 사진 크게 보기' }).click();
    await expect(page.getByRole('dialog', { name: '테마 사진', exact: true })).toBeVisible();
    const image = page.locator('.ws-photo-dialog > img');
    await expect(image).toHaveCSS('object-fit', 'contain');
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('.ws-photo-dialog')).toHaveCount(0);
    await noOverflow(page);
    await page.getByRole('button', { name: '라이트 모드로 전환', exact: true }).click();
    await noOverflow(page);
    const menu = page.getByRole('button', { name: '전체 메뉴 열기', exact: true });
    if (await menu.isVisible()) {
      await menu.click();
      await expect(page.getByRole('dialog', { name: '전체 메뉴', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(menu).toBeFocused();
    }
    expect(errors).toEqual([]);
  });
}

test('풀이 중 화면 변경에도 선택 답안과 페이지가 유지되고 OMR은 닫혀 시작한다', async ({ page }) => {
  await openWorkspace(page);
  await page.locator('.ws-study-actions').getByRole('button', { name: /회차별 문제/ }).click();
  await page.locator('.round-card').first().getByRole('button', { name: '학습모드', exact: true }).click();
  const firstChoice = page.locator('.question-card').first().locator('.choice-button[aria-pressed]').first();
  await firstChoice.click();
  await expect(firstChoice).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '풀이 설정 열기' }).click();
  await page.getByRole('button', { name: /기존 화면 익숙한 CBT/ }).click();
  await page.getByRole('button', { name: '설정 닫기', exact: true }).click();
  await expect(firstChoice).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.ws-session-bar')).toHaveCount(0);
  await page.locator('.session-menu-button').click();
  await page.locator('.session-drawer').getByRole('button', { name: '⚙ 화면·문제풀이 설정', exact: true }).click();
  await page.getByRole('button', { name: /새 디자인 빠른 시작/ }).click();
  await page.getByRole('button', { name: '설정 닫기', exact: true }).click();
  await expect(firstChoice).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '다음 페이지', exact: true }).click();
  await expect(page.locator('.ws-page-actions > span > b')).toHaveText(/^2 \/ /);
  await noOverflow(page);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('.back-button').click();
  await page.locator('.round-card').first().getByRole('button', { name: /CBT/ }).click();
  await expect(page.locator('.session-shell')).toHaveClass(/sheet-closed/);
  await expect(page.locator('.ws-submit')).toHaveText('시험 제출');
  await page.locator('.ws-session-bar').getByRole('button', { name: 'OMR', exact: true }).click();
  await expect(page.locator('.session-shell')).not.toHaveClass(/sheet-closed/);
  await noOverflow(page);
});
