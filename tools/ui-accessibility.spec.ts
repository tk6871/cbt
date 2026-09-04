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

test('필답형 답안 도우미와 부분점수표를 사용할 수 있다', async ({ page }) => {
  await page.goto('./?safe=1');
  await waitForHome(page);
  await page.getByRole('button', { name: '패치노트 보기' }).click();
  await page.getByRole('button', { name: /신기술 학습관/ }).click();
  await expect(page.getByRole('heading', { name: '필답형 실전 채점 훈련' })).toBeVisible();
  await page.getByRole('button', { name: /필답형 훈련관 열기/ }).click();
  await expect(page.getByRole('heading', { name: '공조냉동 실기 필답형 훈련관' })).toBeVisible();
  await page.getByRole('button', { name: '답안 골격 넣기' }).first().click();
  await expect(page.locator('.practical-answer-input textarea').first()).not.toHaveValue('');
  await page.getByRole('button', { name: '단계별 힌트' }).first().click();
  await page.getByRole('button', { name: '힌트 한 단계 열기' }).first().click();
  await expect(page.getByText('1단계 힌트').first()).toBeVisible();
  await page.getByRole('button', { name: '정답·채점 기준 보기' }).first().click();
  await page.getByRole('button', { name: '부분점수 채점' }).first().click();
  await expect(page.getByText(/예상 부분점수/).first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('UI 프레임워크 선택이 전체 화면에 적용되고 기본 화면으로 복귀한다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '전체 UI 프레임워크 비교는 PC 전용입니다.');
  await page.goto('./');
  await waitForHome(page);
  await page.getByRole('button', { name: '패치노트 보기' }).click();
  await page.getByRole('button', { name: /신기술 학습관/ }).click();
  await expect(page.getByRole('heading', { name: 'UI 프레임워크 감성을 전체 화면에서 비교' })).toBeVisible();

  for (const [name, value] of [
    ['Material', 'material'],
    ['Prime Aura', 'prime'],
    ['Naive UI', 'naive'],
    ['Quasar', 'quasar'],
    ['Bootstrap', 'bootstrap'],
  ] as const) {
    await page.getByRole('radio', { name: new RegExp(name) }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.uiFramework)).toBe(value);
  }

  await page.getByRole('radio', { name: /기본 CBT/ }).click();
  await expect.poll(() => page.evaluate(() => ({
    framework: document.documentElement.dataset.uiFramework,
    enabled: document.documentElement.dataset.uiLab,
  }))).toEqual({ framework: 'classic', enabled: 'off' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('PC 전용 실제 UI 프레임워크 체험실이 격리 화면을 바꿔 불러온다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '실제 대형 프레임워크 체험실은 PC 전용입니다.');
  for (const framework of [
    'classic', 'reka', 'vuetify', 'primevue', 'naive', 'quasar', 'element', 'ant', 'bootstrap', 'vuestic',
    'arco', 'tdesign', 'viewui', 'vant', 'varlet', 'oruga', 'wave', 'ionic', 'framework7', 'kendo', 'devextreme',
  ]) {
    await page.goto(`./ui-framework-sandbox.html?framework=${framework}`);
    await expect(page.locator('.adapter-proof')).toBeVisible({ timeout: 90_000 });
    await expect(page.locator('.adapter-proof')).not.toContainText('대체 표시');
    await expect(page.locator('.sandbox')).toHaveAttribute('data-framework', framework);
  }
  await page.goto('./ui-framework-lab.html?framework=vuetify');
  await expect(page.getByRole('heading', { name: 'Vuetify' })).toBeVisible({ timeout: 90_000 });
  await page.getByRole('button', { name: /Kendo UI for Vue/ }).click();
  await expect(page.getByRole('heading', { name: 'Kendo UI for Vue' })).toBeVisible();
  await expect(page.frameLocator('iframe').getByText(/Kendo UI Button 평가판을 실제로 불러옴/)).toBeVisible({ timeout: 90_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
