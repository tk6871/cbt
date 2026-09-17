import { test, expect, type Locator } from '@playwright/test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import type { PracticalPrompt } from '../src/cbt/hvacPracticalTypes';

// Bundle the browser-oriented JSON import for the Node test runner as well.
const supplementModule = execFileSync('node_modules/.bin/esbuild', ['src/cbt/hvacPracticalSupplement.ts', '--bundle', '--platform=node', '--format=esm'], { encoding: 'utf8' });
const { hvacPracticalSupplement }: { hvacPracticalSupplement: PracticalPrompt[] } = await import(`data:text/javascript;base64,${Buffer.from(supplementModule).toString('base64')}`);
const photosModule = execFileSync('node_modules/.bin/esbuild', ['src/cbt/hvacPracticalPhotos.ts', '--bundle', '--platform=node', '--format=esm'], { encoding: 'utf8' });
const { hvacPracticalPhotos }: { hvacPracticalPhotos: PracticalPrompt[] } = await import(`data:text/javascript;base64,${Buffer.from(photosModule).toString('base64')}`);

type Row = { id: string; year?: number; session?: string | number; number: number; question: string; image?: string; images?: string[]; sourceImages?: string[]; answerImages?: string[] };
const restored: Row[] = JSON.parse(fs.readFileSync('data/hvac-practical-restored.json', 'utf8'));
const publicRows: Row[] = JSON.parse(fs.readFileSync('data/hvac-practical-moducbt.json', 'utf8'));
const questionImages = (row: Row) => [...(row.image ? [row.image] : []), ...(row.images || row.sourceImages || [])];

// Layout/loading audit only. Pixel content is reviewed separately in the manual ledger.
test('전체 연결 필답 이미지: 문제·확대·답안 표시 순회', async ({ page }, info) => {
  test.setTimeout(900_000);
  page.setDefaultTimeout(15_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./?safe=1');
  // This suite audits image rendering, not smooth-scroll/pointer interaction.
  // Repeated navigation while lazy images change page height can race smooth scrolling.
  await page.addStyleTag({ content: '* { scroll-behavior: auto !important; }' });
  await expect(page.getByRole('heading', { name: '준비할 종목을 선택하세요' })).toBeVisible({ timeout: 30_000 });
  const later = page.getByRole('button', { name: '나중에', exact: true });
  if (await later.isVisible()) await later.click();
  await page.getByRole('button', { name: '패치노트 보기' }).click();
  await page.getByRole('button', { name: /신기술 학습관/ }).click();
  await page.getByRole('button', { name: /필답형 훈련관 열기/ }).click();
  await page.locator('.practical-scope > summary').click();
  let references = 0;
  let prompts = 0;
  async function loaded(image: Locator, source: string) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveAttribute('src', source);
    await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    const size = await image.evaluate((el: HTMLImageElement) => {
      const b = el.getBoundingClientRect();
      return { width: b.width, height: b.height, left: b.left, right: b.right, viewport: innerWidth, fit: getComputedStyle(el).objectFit };
    });
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
    expect(size.left).toBeGreaterThanOrEqual(-1);
    expect(size.right).toBeLessThanOrEqual(size.viewport + 1);
    expect(size.fit).toBe('contain');
  }
  for (const [group, rows] of [['restored', restored], ['public', publicRows], ['supplement', hvacPracticalSupplement as Row[]], ['photos', hvacPracticalPhotos as Row[]]] as const) {
    await page.getByRole('button', { name: group === 'restored' ? '회차별 복원 312' : group === 'public' ? '공개 자료 47' : group === 'photos' ? '사진·기기 자료 123' : '추가 자료 42', exact: true }).click();
    for (const row of rows.filter(row => questionImages(row).length || row.answerImages?.length)) {
      if (group === 'restored') await page.getByRole('combobox', { name: '복원 회차', exact: true }).selectOption(`${row.year}-${row.session}`);
      const nav = page.getByRole('button', { name: '문제 번호', exact: true });
      if (await nav.getAttribute('aria-expanded') !== 'true') await nav.click();
      await page.locator('.practical-number-grid button').nth(row.number - 1).click();
      const article = page.locator('.practical-question-grid > article');
      const displayedQuestion = group === 'public' ? row.question.replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim() : row.question.trim();
      await expect(article.locator('h3')).toHaveText(displayedQuestion);
      await expect(article.locator('.practical-solution')).toHaveCount(0);
      const sources = questionImages(row);
      const images = article.locator('.practical-prompt-image');
      await expect(images).toHaveCount(sources.length);
      for (const [index, source] of sources.entries()) {
        await loaded(images.nth(index), source);
        await article.locator('.practical-image-button').nth(index).click();
        const dialog = page.locator('dialog[open].practical-image-dialog');
        await loaded(dialog.locator('img'), source);
        await dialog.getByRole('button', { name: '닫기', exact: true }).click();
        references++;
      }
      await article.locator('textarea').fill(`전체 검수 ${row.id}`);
      await page.locator('.practical-pagination').getByRole('button', { name: '답안 확인', exact: true }).click();
      const answers = article.locator('.practical-answer-images img');
      await expect(answers).toHaveCount((row.answerImages || []).length);
      for (const [index, source] of (row.answerImages || []).entries()) {
        await loaded(answers.nth(index), source);
        references++;
      }
      await expect(article.locator('textarea')).toHaveValue(`전체 검수 ${row.id}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.locator('.practical-pagination').getByRole('button', { name: '답안 닫기', exact: true }).click();
      prompts++;
      if (prompts % 20 === 0) console.log(`${info.project.name}: ${prompts}문항 / ${references}이미지`);
    }
  }
  expect(prompts).toBe(274);
  // The two photo questions with a separated answer image count once in the
  // question view and once again after "답안 확인" (95 source photos -> 97 UI references).
  expect(references).toBe(358);
  expect(errors).toEqual([]);
  console.log(`${info.project.name}: 전체 ${prompts}문항 ${references}이미지 완료`);
});

for (const [label, material, captures] of [['추가 자료 42', hvacPracticalSupplement, [14,24]], ['사진·기기 자료 123', hvacPracticalPhotos, [36,82,88,123]]] as const) {
test(`${label}: 답안 분리·그림·작성 답안 복원`, async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.goto('./?safe=1');
  await expect(page.getByRole('heading', { name: '준비할 종목을 선택하세요' })).toBeVisible({ timeout: 30_000 });
  const later = page.getByRole('button', { name: '나중에', exact: true });
  if (await later.isVisible()) await later.click();
  await page.getByRole('button', { name: '패치노트 보기' }).click();
  await page.getByRole('button', { name: /신기술 학습관/ }).click();
  await page.getByRole('button', { name: /필답형 훈련관 열기/ }).click();
  await page.addStyleTag({ content: '* { scroll-behavior: auto !important; }' });
  await page.locator('.practical-scope > summary').click();
  await page.getByRole('button', { name: label, exact: true }).click();
  for (const row of material) {
    const nav = page.getByRole('button', { name: '문제 번호', exact: true });
    if (await nav.getAttribute('aria-expanded') !== 'true') await nav.click();
    await page.locator('.practical-number-grid button').nth(row.number! - 1).click();
    const article = page.locator('.practical-question-grid > article');
    await expect(article.locator('h3')).toHaveText(row.question);
    await expect(article.locator('.practical-solution')).toHaveCount(0);
    if ((captures as readonly number[]).includes(row.number!)) {
      for (const image of await article.locator('.practical-prompt-image').all()) {
        await image.scrollIntoViewIfNeeded();
        await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
      }
      await article.scrollIntoViewIfNeeded();
      await article.screenshot({ path: info.outputPath(`supplement-${row.number}-question.png`) });
    }
    await article.locator('textarea').fill(`내 답안 ${row.number}`);
    await page.locator('.practical-pagination').getByRole('button', { name: '답안 확인', exact: true }).click();
    await expect(article.locator('.practical-solution > p')).toContainText(row.answer);
    if ((captures as readonly number[]).includes(row.number!)) {
      for (const image of await article.locator('.practical-answer-images img').all()) {
        await image.scrollIntoViewIfNeeded();
        await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
      }
      await article.screenshot({ path: info.outputPath(`supplement-${row.number}-answer.png`) });
    }
    await expect(article.locator('textarea')).toHaveValue(`내 답안 ${row.number}`);
    await page.locator('.practical-pagination').getByRole('button', { name: '답안 닫기', exact: true }).click();
  }
  await page.reload();
  await expect(page.locator('.practical-question-grid > article h3')).toHaveText(material.at(-1)!.question, { timeout: 30_000 });
  await expect(page.locator('.practical-question-grid > article textarea')).toHaveValue(`내 답안 ${material.at(-1)!.number}`);
});
}
