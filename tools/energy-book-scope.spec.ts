import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

test('book comparison covers every source ID without modifying the bank', () => {
  const report = JSON.parse(fs.readFileSync('docs/energy-midterm-book-scope-2026-10-12.json', 'utf8'));
  const source = fs.readFileSync('data/energy-midterm.js');
  expect(crypto.createHash('sha256').update(source).digest('hex')).toBe(report.bankSha256);
  const context: any = { window: {} };
  vm.runInNewContext(source.toString(), context);
  const originals = context.window.CBT_DATA_ENERGY_MIDTERM.rounds.flatMap((r: any) => r.questions);
  expect(report.counts).toMatchObject({ raw: 179, active: 154, previous: 91, newConfirmed: 28, confirmedRaw: 119, confirmedActive: 100, unconfirmedRaw: 60, unconfirmedActive: 54 });
  expect(new Set(report.rows.map((r: any) => r.id)).size).toBe(179);
  for (const [index, row] of report.rows.entries()) {
    const q = originals[index];
    expect(row.id).toBe(`${q._originRoundId}:${q._originalNumber}`);
    expect(row.fingerprint).toBe(crypto.createHash('sha256').update(JSON.stringify(q)).digest('hex'));
    expect(row.active).toBe(!q.midtermDuplicateOf);
    expect(row.evidence.length).toBeGreaterThan(0);
    expect(row.evidence.every((e: any) => e.pdfPage >= 1 && e.pdfPage <= 634)).toBe(true);
    expect(row.storedAnswer).toBe(q.answer);
    expect(row.confirmed).toBe(['same', 'previous'].includes(row.status));
    expect(row.directReview).toMatchObject({ date: '2026-10-12', questionAndChoices: true, sourceCandidateVisual: true });
  }
  expect(report.topics.reduce((sum: number, t: any) => sum + t.confirmed, 0)).toBe(100);
  const stabilizer = report.rows.find((r: any) => r.id.endsWith('20150919:54'));
  expect(stabilizer.status).toBe('variant');
  expect(stabilizer.reason).toContain('대류형');
  expect(stabilizer.reason).toContain('평행류형');
});

test('standalone review filters, displays source evidence and leaves learning storage untouched', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('cbt-book-review-sentinel', 'preserved'));
  await page.goto('/docs/energy-midterm-book-scope-2026-10-12.html');
  await expect(page.locator('article')).toHaveCount(154);
  await expect(page.locator('.notice')).toContainText('확인100개·미확인54개');
  await expect(page.locator('.notice')).toContainText('원문179개');
  await expect(page.locator('.notice')).toContainText('중복25개는 이미 새 출제에서 제외');
  await expect(page.locator('.notice')).toContainText('설정 적용 시139개');
  await page.locator('#active').selectOption('all');
  await page.locator('#status').selectOption('same');
  await expect(page.locator('article')).toHaveCount(28);
  await page.screenshot({ path: testInfo.outputPath('energy-book-scope-confirmed.png'), fullPage: false });
  await page.locator('#status').selectOption('unconfirmed');
  await expect(page.locator('article')).toHaveCount(60);
  await page.locator('#search').fill('20150919:54');
  await expect(page.locator('article')).toHaveCount(1);
  await expect(page.locator('article')).toContainText('대류형과 교재 평행류형');
  await page.screenshot({ path: testInfo.outputPath('energy-book-scope-variant.png'), fullPage: false });
  await page.locator('#search').fill('');
  await page.locator('#status').selectOption('previous');
  const article = page.locator('article').filter({ has: page.locator('img') }).first();
  await article.locator('summary').click();
  await expect.poll(() => article.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('cbt-book-review-sentinel'))).toBe('preserved');
  expect(errors).toEqual([]);
});
