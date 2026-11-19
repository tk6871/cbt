import { expect, test, type Page } from '@playwright/test';

async function home(page: Page) {
  await page.goto('./?safe=1');
  await expect(page.getByRole('heading', { name: '나의 학습 홈' })).toBeVisible({ timeout: 90000 });
  const later = page.getByRole('button', { name: '나중에', exact: true });
  if (await later.isVisible()) await later.click();
}
async function quick(page: Page) {
  await page.getByRole('button', { name: '설정 열기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '화면과 학습 데이터', exact: true })).toBeVisible();
}

test('설정 목차가 관련 항목만 열고 전체 검색은 모든 분류에서 찾는다', async ({ page }) => {
  await home(page);
  await quick(page);
  const popupKeys = await page.locator('[data-setting]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-setting')));
  expect(popupKeys).toEqual(expect.arrayContaining(['display', 'dynamic', 'experimental', 'judgment', 'solveLayout', 'visualStyle', 'theme', 'fontScale', 'fontFamily', 'imageTheme', 'answerLayout', 'indicator', 'data', 'backup']));
  await expect(page.locator('.settings-category-nav button')).toHaveCount(6);
  await page.getByRole('button', {name:'기기·모션',exact:true}).click();
  await expect(page.locator('.display-mode-options button').first()).toContainText('기기 자동 인식');
  await expect(page.locator('[data-setting=fontScale]')).toBeHidden();
  await page.getByRole('button', {name:'테마·글씨',exact:true}).click();
  await page.getByRole('button', { name: '크게', exact: true }).click();
  await expect(page.getByRole('button', { name: '크게', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /전체 설정 열기/ }).click();
  await expect(page.locator('.settings-page')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.patch-timeline')).toHaveCount(0);
  expect(await page.locator('[data-setting]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-setting')))).toEqual(popupKeys);
  await page.getByRole('button', { name: '풀이·답안', exact: true }).click();
  await expect(page.locator('[data-setting="answerLayout"]')).toBeVisible();
  await expect(page.locator('[data-setting="display"]')).toBeHidden();
  await page.getByLabel('설정 찾기', { exact: true }).fill('D2Coding');
  await expect(page.locator('[data-setting="fontFamily"]')).toBeVisible();
  await page.getByRole('button', { name: /D2Coding Bold/ }).click();
  await expect(page.getByRole('button', { name: /D2Coding Bold/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('설정 찾기', { exact: true }).fill('선재');
  await expect(page.locator('[data-setting="visualStyle"]')).toBeHidden();
  await page.getByLabel('설정 찾기', {exact:true}).fill('없는설정q794');
  await expect(page.getByText('일치하는 설정이 없습니다.')).toBeVisible();
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
  await page.getByRole('button', {name: '회차별 기출 고르기'}).click();
  await page.locator('#round-card-hvac-20160306').getByRole('button',{name:'CBT 시험모드'}).click();
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

test('4K 전체·절반과 모바일 두 폭에서 두 모드 버튼과 설정 목차를 검증한다', async ({page}, info) => {
  test.skip(info.project.name !== 'desktop');
  for (const width of [3840, 1920, 390, 320]) {
    await page.setViewportSize({width, height:width >= 1920 ? 2160 : 844});
    await page.goto('./?safe=1#/study/rounds');
    const buttons = page.locator('#round-card-hvac-20160306 .round-mode-button');
    await expect(buttons).toHaveCount(2);
    for (const theme of ['dark','light']) {
      await page.emulateMedia({colorScheme:theme as 'dark'|'light'});
      await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
      const styles = await buttons.evaluateAll(nodes => nodes.map(el => {
        const style = getComputedStyle(el);
        return [style.backgroundImage, style.backgroundColor, style.color, style.borderColor,
          style.borderRadius, style.height, style.fontSize, style.fontWeight];
      }));
      expect(styles[0]).toEqual(styles[1]);
      expect(parseFloat(styles[0]![5]!)).toBeGreaterThanOrEqual(44);
    }
    await page.goto('./?safe=1#/study/settings');
    const nav = page.getByRole('navigation',{name:'설정 목차'});
    await expect(nav.getByRole('button')).toHaveCount(6);
    for (const button of await nav.getByRole('button').all()) {
      await button.focus();
      await button.press('Enter');
      await expect(button).toHaveAttribute('aria-pressed','true');
      await expect.poll(async () => (await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expect(page.locator('.settings-section-title')).toHaveText((await button.innerText()).trim());
      expect(await page.locator('.settings-hub-body').evaluate(el => el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
    }
  }
});

test('테마 실험실 선택값이 저장되고 Escape로 닫으면 설정 버튼에 포커스가 돌아온다',async({page})=>{
  await page.goto('./');
  const opener=page.getByRole('button',{name:'설정 열기',exact:true});
  await opener.click();
  await page.getByRole('button',{name:'기기·모션',exact:true}).click();
  const panel=page.locator('.theme-studio');
  await panel.getByRole('switch').click();
  await panel.getByRole('button',{name:'세부 설정 열기'}).click();
  await panel.getByRole('button',{name:'바이올렛'}).click();
  await panel.getByRole('button',{name:'고밀도'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-ui-density','compact');
  await expect(page.locator('html')).toHaveAttribute('data-ui-accent','violet');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.reload();
  await opener.click();
  await page.getByRole('button',{name:'기기·모션',exact:true}).click();
  await expect(panel.getByRole('switch')).toBeChecked();
  await panel.getByRole('button',{name:'세부 설정 열기'}).click();
  await expect(panel.getByRole('button',{name:'바이올렛'})).toHaveAttribute('aria-pressed','true');
});
