import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function waitForHome(page: import('@playwright/test').Page) {
  await expect(page.getByRole('heading', { name: '준비할 종목을 선택하세요' })).toBeVisible({ timeout: 90_000 });
  const later = page.getByRole('button', { name: '나중에' }).filter({ visible: true });
  if (await later.count()) await later.first().click();
}

test('홈과 설정의 심각한 접근성 오류가 없다', async ({ page }) => {
  await page.goto('./?safe=1');
  await waitForHome(page);
  const home = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
  expect(home.violations.filter((item) => item.impact === 'critical')).toEqual([]);

  await page.getByRole('button', { name: '설정 열기', exact: true }).click();
  await expect(page.getByText('UI·테마 실험실')).toBeVisible();
  const settings = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
  expect(settings.violations.filter((item) => item.impact === 'critical')).toEqual([]);
});

test('패치노트와 플러그인 안내가 작은 화면을 넘지 않는다', async ({ page }) => {
  await page.goto('./?safe=1');
  await waitForHome(page);
  await page.getByRole('button', { name: '패치노트 보기' }).click();
  await page.getByRole('button', { name: /신기술 학습관/ }).click();
  await expect(page.getByRole('heading', { name: '이번 플러그인이 바꾼 기능' })).toBeVisible();
  await page.getByText('VueUse', { exact: true }).click();
  await expect(page.getByText(/새 설정이 새로고침 뒤에도 유지/)).toBeVisible();

  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
    guide: Math.ceil(document.querySelector('.feature-plugin-guide')?.getBoundingClientRect().right || 0),
  }));
  expect(overflow.page).toBeLessThanOrEqual(overflow.viewport + 1);
  expect(overflow.guide).toBeLessThanOrEqual(overflow.viewport + 1);
});
