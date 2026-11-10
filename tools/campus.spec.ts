import { test, expect } from '@playwright/test';
test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await page.addLocatorHandler(page.locator('.pwa-error-notice'), async () => {
    // The notice can disappear when campusOpen becomes true; click synchronously
    // if it still exists instead of waiting for a detached transition element.
    await page.locator('.pwa-error-notice').evaluateAll(nodes => nodes.forEach(node => {
      Array.from(node.querySelectorAll('button')).find(button => button.textContent?.trim() === '나중에')?.click();
    }));
  });
  await page.addInitScript(() => {
    localStorage.setItem('modern-cbt-qualification-industrial', 'hvac');
    localStorage.setItem('unified-cbt-dynamic-ui', 'false');
    sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351', 'true');
    sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351', 'true');
  });
});
test('캠퍼스 지연 로딩 · 공간 이동 · 기존 화면 복귀', async ({ page }, info) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', r => requests.push(r.url()));
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?safe=1');
  const launch = page.getByRole('button', { name: /3D 캠퍼스 체험/ });
  await expect(launch).toBeVisible();
  expect(requests.some(url => url.includes('CampusExperience'))).toBe(false);
  expect(requests.some(url => url.endsWith('.vrm'))).toBe(false);
  await launch.click();
  const campus = page.getByRole('dialog', { name: '3D 캠퍼스 체험', exact: true });
  await expect(campus.locator('canvas')).toBeVisible();
  await expect(campus.locator('.campus-error')).toHaveCount(0);
  await expect(campus.locator('.character-status')).toHaveCount(0, { timeout: 30000 });
  await page.screenshot({ path: `/private/tmp/campus-${info.project.name}-entrance.png` });
  await campus.getByRole('button', { name: '캠퍼스 들어가기 →' }).click();
  await expect(campus.locator('.campus-status')).toHaveText('현재 위치: 복도', { timeout: 20000 });
  await page.screenshot({ path: `/private/tmp/campus-${info.project.name}-hall.png` });
  await campus.getByLabel('이동 애니메이션 줄이기').check();
  await campus.getByRole('button', { name: '101 강의실 입장 →' }).click();
  await expect(campus.locator('.campus-status')).toHaveText('현재 위치: 강의실');
  await page.screenshot({ path: `/private/tmp/campus-${info.project.name}-room.png` });
  await campus.getByRole('button', { name: '회차 선택하고 공부하기 ↗' }).click();
  await expect(campus).toHaveCount(0);
  expect(await page.locator('body').evaluate(el => el.style.overflow)).not.toBe('hidden');
  await page.goBack();
  await expect(launch).toBeVisible();
  await launch.click();
  await expect(campus.locator('canvas')).toBeVisible();
  await page.goBack();
  await expect(campus).toHaveCount(0);
  await expect(launch).toBeFocused();
  expect(errors).toEqual([]);
});
test('WebGL 불가 시 기본 CBT로 안전 복귀', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: any, ...args: any[]) {
      if (kind === 'webgl2' || kind === 'webgl') return null;
      return (original as any).call(this, kind, ...args);
    } as any;
  });
  await page.goto('/?safe=1');
  await page.getByRole('button', { name: /3D 캠퍼스 체험/ }).click();
  await expect(page.getByRole('alert')).toContainText('이 기기에서는 3D 화면을 열 수 없어요');
  await page.getByRole('button', { name: '기존 CBT로 돌아가기', exact: true }).click();
  await expect(page.locator('.campus')).toHaveCount(0);
});

test('4K · 키보드 이동 · 드래그 · 컨텍스트 손실 복귀', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'PC 4K 조작 검사');
  await page.setViewportSize({ width: 3840, height: 2160 });
  await page.goto('/?safe=1');
  await page.getByRole('button', { name: /3D 캠퍼스 체험/ }).click();
  const campus = page.locator('.campus');
  const host = campus.locator('.campus-scene');
  await expect(host.locator('canvas')).toBeVisible();
  await host.focus();
  const before = await host.screenshot();
  await page.keyboard.down('w');
  await page.waitForTimeout(500);
  await page.keyboard.up('w');
  expect((await host.screenshot()).equals(before)).toBe(false);
  await page.mouse.move(2000, 1000); await page.mouse.down();
  await page.mouse.move(2150, 1020, { steps: 8 }); await page.mouse.up();
  await page.screenshot({ path: '/private/tmp/campus-4k.png' });
  const overflow = await campus.evaluate(el => el.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await host.locator('canvas').evaluate(el => el.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await expect(campus.getByRole('alert')).toContainText('3D 화면 연결이 중단');
  await page.keyboard.press('Escape');
  await expect(campus).toHaveCount(0);
});
