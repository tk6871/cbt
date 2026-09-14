import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const rows: Array<{id:string;question:string;images?:string[];answerImages?:string[]}> = JSON.parse(fs.readFileSync(new URL('../data/hvac-practical-restored.json', import.meta.url), 'utf8'));
const manifest: Array<{id:string;crops:number[][];preserveAsAnswer?:boolean}> = JSON.parse(fs.readFileSync(new URL('../data/hvac-practical-image-cleanup.json', import.meta.url), 'utf8'));

test('검수된 이미지 연결과 원본 보존 회귀', () => {
  for (const entry of manifest) {
    const id = `hvac-practical-restored-${entry.id}`;
    const row = rows.find(row => row.id === id)!;
    const original = `assets/hvac-practical/restored/${entry.id.slice(0,6)}/${id}-question-1.png`;
    expect(fs.existsSync(original)).toBe(true);
    expect(row.images).toEqual(entry.crops.map((_, index) => `assets/hvac-practical/restored/${entry.id.slice(0,6)}/${id}-clean-${index+1}.png`));
    for (const path of row.images!) expect(fs.existsSync(path)).toBe(true);
    if (entry.preserveAsAnswer !== false) expect(row.answerImages).toContain(original);
    else expect(row.answerImages || []).not.toContain(original);
  }
});

test('교정 문항: 문제·확대는 clean 이미지, 정답 확인 후에만 원본 표시', async ({ page }, info) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./?safe=1');
  await expect(page.getByRole('heading', {name:'준비할 종목을 선택하세요'})).toBeVisible();
  const later = page.getByRole('button', {name:'나중에',exact:true});
  if (await later.isVisible()) await later.click();
  await page.getByRole('button', {name:'패치노트 보기'}).click();
  await page.getByRole('button', {name:/신기술 학습관/}).click();
  await page.getByRole('button', {name:/필답형 훈련관 열기/}).click();
  await page.locator('.practical-scope > summary').click();
  await page.getByRole('button', {name:'회차별 복원 312',exact:true}).click();
  for (const entry of manifest) {
    console.log(`이미지 화면 검수: ${info.project.name} ${entry.id}`);
    await page.getByRole('combobox', {name:'복원 회차',exact:true}).selectOption(entry.id.slice(0,6));
    const navigation = page.getByRole('button', {name:'문제 번호',exact:true});
    if (await navigation.getAttribute('aria-expanded') !== 'true') await navigation.click();
    await page.locator('.practical-number-grid button').nth(Number(entry.id.slice(-2))-1).click();
    const article = page.locator('.practical-question-grid > article');
    const row = rows.find(row => row.id.endsWith(entry.id))!;
    await expect(article.locator('h3')).toHaveText(row.question);
    await expect(article.locator('.practical-solution')).toHaveCount(0);
    const images = article.locator('.practical-prompt-image');
    await expect(images).toHaveCount(entry.crops.length);
    for (let i=0; i<entry.crops.length; i++) {
      await images.nth(i).scrollIntoViewIfNeeded();
      await expect(images.nth(i)).toHaveAttribute('src', row.images![i]);
      await expect.poll(() => images.nth(i).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
      const size = await images.nth(i).evaluate((el: HTMLImageElement) => ({width:el.clientWidth,height:el.clientHeight,nw:el.naturalWidth,nh:el.naturalHeight}));
      expect(Math.abs(size.width / size.height - size.nw / size.nh)).toBeLessThan(.04);
    }
    await article.locator('.practical-image-button').first().click();
    const dialog = page.locator('dialog[open].practical-image-dialog');
    await expect(dialog.locator('img')).toHaveAttribute('src', row.images![0]);
    await dialog.getByRole('button', {name:'닫기',exact:true}).click();
    await article.locator('textarea').fill(`검수 답안 ${entry.id}`);
    await page.locator('.practical-pagination').getByRole('button', {name:'답안 확인',exact:true}).click();
    await expect(article.locator('.practical-solution')).toBeVisible();
    await expect(article.locator('textarea')).toHaveValue(`검수 답안 ${entry.id}`);
    if (entry.preserveAsAnswer !== false) {
      await expect(article.locator('.practical-answer-images img').last()).toHaveAttribute('src', `assets/hvac-practical/restored/${entry.id.slice(0,6)}/hvac-practical-restored-${entry.id}-question-1.png`);
    }
    await page.locator('.practical-pagination').getByRole('button', {name:'답안 닫기',exact:true}).click();
    await expect(article.locator('.practical-solution')).toHaveCount(0);
    const menu = page.locator('.mobile-tabbar');
    if (await menu.isVisible()) {
      const menuBox = (await menu.boundingBox())!;
      const pagerBox = (await page.locator('.practical-pagination').boundingBox())!;
      expect(pagerBox.y + pagerBox.height).toBeLessThanOrEqual(menuBox.y);
    }
    await expect(page.locator('.ios-pwa-floating-trigger')).not.toBeVisible();
    await expect(page.locator('.android-apk-floating-trigger')).not.toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    if (entry.id === '2026-2-04' || entry.id === '2024-3-11' || entry.id.startsWith('2023-')) {
      await article.scrollIntoViewIfNeeded();
      await page.screenshot({path:`/private/tmp/cbt-${entry.id}-${info.project.name}.png`});
    }
  }
  expect(errors).toEqual([]);
});
