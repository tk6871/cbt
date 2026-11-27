import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('교재에서 종목을 바꾸고 학교 시험 자료에서 자격증 기출로 복귀', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('legacy-home-test')) return;
    sessionStorage.setItem('legacy-home-test', '1');
    localStorage.setItem('cbt-campus-story-v1', '{}');
    localStorage.setItem('cbt-campus-view', 'map');
    localStorage.setItem('cbt-test-unrelated', 'keep');
  });
  await page.addLocatorHandler(page.locator('.pwa-error-notice'), async notice => {
    await notice.getByRole('button', { name: '나중에', exact: true }).click();
  });
  await page.goto('./?safe=1');
  await expect(page.locator('.app-frame')).toBeVisible();
  await expect(page.getByRole('button', { name: /3D 캠퍼스 체험/ })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => [
    localStorage.getItem('cbt-campus-story-v1'),
    localStorage.getItem('cbt-campus-view'),
    localStorage.getItem('cbt-test-unrelated'),
  ])).toEqual([null, null, 'keep']);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let releaseSafety!: () => void;
  const safetyGate = new Promise<void>(resolve => { releaseSafety = resolve; });
  await page.route(/\/(?:data\/safety\.js|api\/catalogs\/safety)(?:\?|$)/, async route => {
    await safetyGate;
    await route.continue();
  }, { times: 1 });
  const documentNavigations: string[] = [];
  page.on('request', request => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentNavigations.push(request.url());
  });
  await page.getByRole('button', { name: '회차별 기출 고르기' }).click();
  await page.getByRole('button', { name: '교재 페이지별', exact: true }).click();
  await page.getByRole('button', {name:/^종목 변경 ·/}).click();
  await page.getByRole('dialog',{name:'종목 변경'}).getByRole('button',{name:'산업안전산업기사',exact:true}).click();
  const progress = page.getByRole('progressbar', { name: '회차 준비 진행률' });
  await expect(progress).toBeVisible();
  await expect(progress).toHaveAttribute('value', '0');
  releaseSafety();
  await expect(page.getByRole('heading', { name: '산업안전산업기사 기출문제' })).toBeVisible();
  await expect(page.locator('.round-card').first()).toBeVisible();
  await expect(progress).toHaveCount(0);
  if (!await page.locator('.sidebar').getByRole('button',{name:'기말고사'}).isVisible())
    await page.getByRole('button',{name:'메뉴 열기'}).click();
  await page.locator('.sidebar').getByRole('button',{name:'기말고사'}).click();
  await page.getByText('내 학교 시험 자료',{exact:true}).click();
  await expect(page.getByRole('button',{name:'에너지설비 중간고사 자료'})).toHaveCount(0);
  if (!await page.locator('.sidebar').getByRole('button',{name:'회차별 문제'}).isVisible())
    await page.getByRole('button',{name:'메뉴 열기'}).click();
  await page.locator('.sidebar').getByRole('button',{name:'회차별 문제'}).click();
  await expect(page.getByRole('heading', { name: '산업안전산업기사 기출문제' })).toBeVisible();
  expect(documentNavigations).toEqual([]);
  await page.reload();
  documentNavigations.length = 0;
  await expect(page.getByRole('heading', { name: '산업안전산업기사 기출문제' })).toBeVisible();
  await page.getByRole('button', {name:/^종목 변경 ·/}).click();
  await page.getByRole('dialog',{name:'종목 변경'}).getByRole('button',{name:'산업안전기사',exact:true}).click();
  await expect(page.getByRole('heading', { name: '산업안전기사 기출문제' })).toBeVisible();
  await expect(page.locator('.round-card')).toHaveCount(14);
  expect(documentNavigations).toEqual([]);
  const latest = page.locator('.round-card').first();
  await expect(latest).toContainText('120문제');
  await latest.getByRole('button', { name: '학습모드', exact: true }).click();
  await expect(page.getByText(/매슬로우.*욕구단계/).first()).toBeVisible();
});
