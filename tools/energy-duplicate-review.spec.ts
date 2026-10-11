import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('midterm-only audit preserves 179 questions and all candidate pairs', async () => {
  const data = JSON.parse(fs.readFileSync('docs/energy-duplicate-review-2026-10-11.json', 'utf8'));
  expect(data.scope).toBe('energy-midterm-only');
  expect(data.rows).toHaveLength(179);
  expect(data.comparisons).toBe(15931);
  expect(data.pairs).toHaveLength(76);
  expect(data.repeatGroups).toBe(7);
  expect(data.repeatQuestions).toBe(15);
  expect(data.states['확인된 반복']).toBe(9);
  expect(data.states['확인된 변형']).toBe(6);
  expect(data.states['추가 의심 후보']).toBe(61);
  expect(new Set(data.rows.map((r: { id: string }) => r.id)).size).toBe(179);
  expect(new Set(data.pairs.map((p: { id: string }) => p.id)).size).toBe(76);
  for (const p of data.pairs) {
    expect(p.a).not.toBe(p.b);
    expect(data.rows[p.a]).toBeTruthy();
    expect(data.rows[p.b]).toBeTruthy();
  }
  const reported = data.pairs.find((p: { a: number; b: number }) => [data.rows[p.a].sourceImage, data.rows[p.b].sourceImage].sort().join('|') === 'assets/energy-midterm/questions/2023-1-26.webp|assets/energy-midterm/questions/2025-3-33.webp');
  expect(reported.state).toBe('확인된 반복');
  expect(reported.reviewedSameCorrectContent).toBe(true);
  expect([data.rows[reported.a].answer, data.rows[reported.b].answer]).toEqual([3, 4]);
});

test('side-by-side review filters, zooms, saves decisions and exports them', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/docs/energy-duplicate-review-2026-10-11.html');
  await expect(page.locator('#overview')).toContainText('76쌍');
  await expect(page.locator('.pair')).toHaveCount(10);
  await page.locator('#state').selectOption('추가 의심 후보');
  await expect(page.locator('#count')).toContainText('61쌍');
  await page.locator('#next').click();
  await expect(page.locator('.pair')).toHaveCount(10);
  await page.locator('#state').selectOption('');
  await page.locator('#query').fill('건식');
  const first = page.locator('.pair').first();
  await expect(first.locator('.question')).toHaveCount(2);
  const originals = first.locator('.original');
  await expect(originals).toHaveCount(2);
  await expect.poll(() => originals.evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await originals.first().click();
  await expect(page.locator('#zoom')).toBeVisible();
  await page.locator('#zoom button').click();
  await first.locator('[data-role="note"]').fill('보기 3·4 순서 바뀜');
  await first.locator('[data-role="decision"]').selectOption('same');
  await page.reload();
  await page.locator('#query').fill('건식');
  await expect(page.locator('.pair').first().locator('[data-role="decision"]')).toHaveValue('same');
  await expect(page.locator('.pair').first().locator('[data-role="note"]')).toHaveValue('보기 3·4 순서 바뀜');
  await page.locator('#decision').selectOption('same');
  await expect(page.locator('.pair')).toHaveCount(1);
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await downloadEvent;
  const result = JSON.parse(fs.readFileSync((await download.path())!, 'utf8'));
  expect(result.scope).toBe('energy-midterm-only');
  expect(result.reviews[0].decision).toBe('same');
  expect(result.reviews[0].note).toBe('보기 3·4 순서 바뀜');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('energy-duplicates-desktop.png'), fullPage: true });
  expect(errors).toEqual([]);
});
