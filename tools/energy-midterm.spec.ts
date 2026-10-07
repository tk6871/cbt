import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import vm from 'node:vm';
import type { Catalog } from '../src/cbt/types';
import { energyMidtermPractice } from '../src/cbt/energyMidtermPractice';

test('20주제136문항 원문 정답·보기 보존과 전용 ID', () => {
  const context = { window: {} as Record<string, Catalog> };
  for (const key of ['energy', 'energy-midterm']) vm.runInNewContext(fs.readFileSync(`data/${key}.js`, 'utf8'), context);
  const bank = context.window.CBT_DATA_ENERGY_MIDTERM;
  const source = context.window.CBT_DATA_ENERGY;
  expect(bank.rounds).toHaveLength(20);
  const questions = bank.rounds.flatMap(r => r.questions);
  expect(questions).toHaveLength(136);
  expect(new Set(questions.map(q => `${q._originRoundId}:${q._originalNumber}`)).size).toBe(136);
  for (const q of questions) {
    const sourceRound = source.rounds.find(r => `school-energy-${r.id}` === q._originRoundId)!;
    const original = sourceRound.questions.find(row => row.number === q._originalNumber)!;
    expect(q.answer).toBe(original.answer);
    const clean = (text?: string) => text?.replace(/[\uE000-\uF8FF]/g, '');
    expect(q.text).toBe(clean(original.text));
    expect(q.html).toBe(clean(original.html));
    expect(q.choices.map(c => c.text)).toEqual(original.choices.map(c => clean(c.text)));
    expect(q.images).toEqual(original.images);
    expect(q.explanation!.length).toBeGreaterThan(35);
    expect(q._originRoundId).not.toBe(sourceRound.id);
    expect(q.choices.length).toBe(4);
  }
  expect(bank.rounds[16].questions[0].teacherHint).toContain('확정하지 않았습니다');
  expect(questions.filter(q => q.bookVerified)).toHaveLength(27);
  expect(bank.rounds.every(r => r.questions.some(q => q.bookVerified))).toBe(true);
  expect(bank.rounds[16].questions[0].teacherHint).toContain('교재260쪽');
  expect(bank.rounds[14].questions[0].explanation).toContain('6%');
  expect(questions.filter(q => q.midtermMatch === 'direct')).toHaveLength(83);
  expect(questions.filter(q => q.midtermMatch === 'related')).toHaveLength(53);
  expect(bank.rounds[16].questions[0].midtermMatch).toBe('related');
  for (const q of questions) {
    if (q.bookVerified) expect(q.sourcePage).toContain('대응 확인');
    expect(q.sourcePage).toContain(q.midtermMatch === 'direct' ? '출제 메모 직접 대응' : '추가 예상');
  }
});

test('시험 연습은 전체 주제를 포함하고 첫 문항 고정 없이 문항·순서를 바꾼다', () => {
  const pools = Array.from({ length: 20 }, (_, topic) => Array.from({ length: 5 }, (_, question) => ({ topic, question })));
  const first = energyMidtermPractice(pools, () => 0.1);
  const second = energyMidtermPractice(pools, () => 0.9);
  expect(first).toHaveLength(20);
  expect(new Set(first.map(q => q.topic)).size).toBe(20);
  expect(first.every(q => q.question === 0)).toBe(true);
  expect(second.every(q => q.question === 4)).toBe(true);
  expect(first.map(q => q.topic)).not.toEqual(second.map(q => q.topic));
  expect(pools[0][0]).toEqual({ topic: 0, question: 0 });
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('modern-cbt-qualification-industrial', 'energy-midterm');
    localStorage.setItem('unified-cbt-dynamic-ui', 'false');
    if (!localStorage.getItem('unified-industrial-cbt-v1')) localStorage.setItem('unified-industrial-cbt-v1', JSON.stringify({ attempts: {}, wrong: { 'energy-industrial-20180428:1': { count: 3, at: 1 } }, bookmarks: [], progress: {}, notes: {} }));
    sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351', 'true');
    sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351', 'true');
  });
});

async function openRounds(page: import('@playwright/test').Page) {
  if ((page.viewportSize()?.width || 1440) <= 900) await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
  await page.locator('.sidebar').getByRole('button', { name: /회차별 문제/ }).click();
  await expect(page.locator('.energy-midterm-intro')).toBeVisible();
  if ((page.viewportSize()?.width || 1440) <= 900) await expect.poll(() => page.locator('.sidebar').evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  await page.locator('.energy-midterm-other-actions > summary').click();
}

test('직접 대응과 추가 예상은 별도 모음으로 학습한다', async ({ page }) => {
  await page.goto('./?safe=1');
  await openRounds(page);
  await page.getByRole('button', { name: '직접 대응83문제 학습', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial') || '{}').itemIds?.length)).toBe(83);
  await expect(page.locator('.question-card').first().locator('.source-chip')).toContainText('출제 메모 직접 대응');
  await page.locator('.session-topbar .back-button').click();
  await page.getByRole('button', { name: '추가 예상53문제 학습', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial') || '{}').itemIds?.length)).toBe(53);
  await expect(page.locator('.question-card').first().locator('.source-chip')).toContainText('추가 예상');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('주제 목록·학습·오답 ID·재시작·라이트/다크 가로넘침', async ({ page }, info) => {
  await page.goto('./?safe=1');
  await openRounds(page);
  await expect(page.locator('.round-grid > article')).toHaveCount(20);
  await expect(page.locator('.round-card h2').first()).toHaveText('01. 집진장치');
  await page.getByRole('button', { name: '전체136문제 학습', exact: true }).click();
  const first = page.locator('.question-card').first();
  await expect(first).toBeVisible();
  await first.locator('.choice-button').nth(0).click();
  await expect.poll(() => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('unified-industrial-cbt-v1') || '{}').wrong || {}).filter(id => id.startsWith('school-energy-')))).toEqual(['school-energy-energy-industrial-20180428:1']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('unified-industrial-cbt-v1') || '{}').wrong['energy-industrial-20180428:1'].count)).toBe(3);
  await expect.poll(() => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial') || '{}').answers || {}).length)).toBe(1);
  await page.reload();
  await expect(page.locator('.energy-midterm-intro')).toBeVisible();
  await page.locator('.resume-learning-card').getByRole('button', { name: '이어서 풀기', exact: true }).click();
  await expect(first.locator('.choice-button').first()).toHaveClass(/selected/);
  await expect(first.locator('.source-chip').filter({ hasText: '2018년 2회 · 원문 1번' })).toBeVisible();
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `work/energy-midterm-${info.project.name}-light.png`, fullPage: false });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `work/energy-midterm-${info.project.name}-dark.png`, fullPage: false });
  await first.locator('.choice-button').nth(3).click();
  await expect(first).toContainText('압력손실은 작습니다');
  await expect(first).toContainText('자료 기반 학습 해설');
});

test('랜덤20문제 CBT 30분·제출과 학교 연습 점수', async ({ page }) => {
  await page.goto('./?safe=1');
  await openRounds(page);
  await page.getByRole('button', { name: '랜덤20문제 CBT', exact: true }).click();
  await expect(page.locator('.question-card').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial') || '{}').itemIds?.length)).toBe(20);
  const remaining = await page.evaluate(() => JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial') || '{}').remainingSeconds);
  expect(remaining).toBeGreaterThan(1760);
  expect(remaining).toBeLessThanOrEqual(1800);
  await page.locator('.question-card').first().locator('.choice-button').nth(3).click();
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '시험 제출·채점', exact: true }).filter({ visible: true }).first().click();
  await expect(page.locator('.result-backdrop')).toBeVisible();
  await expect(page.locator('.result-backdrop')).toContainText('20문제');
  await expect(page.locator('.result-backdrop')).toContainText('중간고사 연습 점수');
});

test('교재 대응27문제만 따로 학습하며 출처를 표시한다', async ({ page }) => {
  await page.goto('./?safe=1');
  await openRounds(page);
  await expect(page.locator('.energy-midterm-intro')).toContainText('27문제');
  await page.getByRole('button', { name: '교재 대응27문제 학습', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial') || '{}').itemIds?.length)).toBe(27);
  const first = page.locator('.question-card').first();
  await expect(first.locator('.source-chip')).toContainText('교재336쪽 대응 확인');
  await first.locator('.choice-button').nth(3).click();
  await expect(first).toContainText('압력손실은 작습니다');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('전체136문제·주제 안내·학교 모음 전환', async ({ page }, info) => {
  if (info.project.name === 'desktop') await page.setViewportSize({ width: 960, height: 900 });
  await page.goto('./?safe=1');
  await openRounds(page);
  await page.screenshot({ path: `work/energy-midterm-${info.project.name}-intro.png`, fullPage: false });
  await page.locator('#round-card-school-energy-topic-17').getByText('자료 대조 안내', { exact: true }).click();
  await expect(page.locator('#round-card-school-energy-topic-17')).toContainText('pH6.92');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `work/energy-midterm-${info.project.name}-topics.png`, fullPage: false });
  await expect(page.locator('.energy-midterm-intro')).toContainText('20문제는 실제 시험 문항 수');
  await page.getByRole('button', { name: '전체136문제 학습', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial') || '{}').itemIds?.length)).toBe(136);
  await page.locator('.session-topbar .back-button').click();
  await page.locator('.rounds-collection').getByRole('button', { name: '냉동공학 중간고사', exact: true }).click();
  await expect(page.locator('.cooling-midterm')).toBeVisible({ timeout: 30000 });
  await page.locator('.rounds-collection').getByRole('button', { name: '에너지설비 중간고사', exact: true }).click();
  await expect(page.locator('.energy-midterm-intro')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.round-grid > article')).toHaveCount(20);
});
