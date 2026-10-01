import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import vm from 'node:vm';
import { coolingMidtermItems, uniqueSchoolItems } from '../src/cbt/schoolQuestionBank';
import { normalizeSchoolExamData, mergeSchoolExamData } from '../src/cbt/schoolExam';
import { subjectFor, questionId } from '../src/cbt/catalog';
import type { Catalog, QuestionItem } from '../src/cbt/types';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351', 'true');
    sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351', 'true');
  });
});

test('전체 범위: 구 냉동공학+냉동냉장설비1920개, 원문·ID 보존 및 백업 호환', () => {
  const context = { window: {} as Record<string, Catalog> };
  for (const key of ['hvac', 'hvac-hansol']) vm.runInNewContext(fs.readFileSync(`data/${key}.js`, 'utf8'), context);
  const items: QuestionItem[] = Object.values(context.window).flatMap(c => c.rounds.flatMap(r => r.questions.map(q => ({
    round: { ...r, qualificationKey: c.key }, question: q, id: questionId(r, q), subject: subjectFor(r, q),
  }))));
  const pool = coolingMidtermItems(items);
  expect(pool).toHaveLength(1920);
  expect(pool.filter(i => i.round.qualificationKey === 'hvac')).toHaveLength(1380);
  expect(pool.filter(i => i.round.qualificationKey === 'hvac-hansol')).toHaveLength(540);
  expect(uniqueSchoolItems(pool)).toHaveLength(1875);
  expect(pool.every(i => i.subject === '냉동냉장설비')).toBe(true);
  for (const item of pool) expect(items.find(i => i.id === item.id)?.question).toBe(item.question);
  const one = pool.find(i => (i.question.text || '').length > 8)!;
  const altered = { ...one, id: 'different-numbers', question: { ...one.question, text: `${one.question.text} 123.5` } };
  expect(uniqueSchoolItems([one, one, altered])).toHaveLength(2);
  const old = normalizeSchoolExamData({ version: 1, rounds: [], scopes: [], memoryCards: [] });
  const merged = mergeSchoolExamData(old, { questionSets: [{ id: 'a', title: '중간고사', subject: '냉동공학', itemIds: [one.id, one.id] }] });
  expect(merged.questionSets?.[0].itemIds).toEqual([one.id]);
  expect(normalizeSchoolExamData(JSON.parse(JSON.stringify(merged)))).toEqual(merged);
});

test('학교 시작·공조+한솔 검색·범위 담기·원문 풀이·새로고침 이어하기', async ({ page }, info) => {
  await page.addInitScript(() => {
    localStorage.setItem('modern-cbt-qualification-industrial', 'school-exams');
    localStorage.setItem('unified-cbt-dynamic-ui', 'false');
  });
  await page.goto('./?safe=1');
  const menu = page.getByRole('button', { name: '메뉴 열기', exact: true });
  if ((page.viewportSize()?.width || 1440) <= 900) await menu.click();
  await page.locator('.sidebar').getByRole('button', { name: /학교 시험 준비/ }).click();
  const bank = page.locator('.cooling-midterm');
  await expect(bank.getByRole('button', { name: '전체 문제 학습', exact: true })).toBeEnabled({ timeout: 30000 });
  await expect(bank.getByText('공조 기출 · 1380문제', { exact: true })).toHaveCount(1);
  await expect(bank.getByText('한솔 공조 · 540문제', { exact: true })).toHaveCount(1);
  await page.screenshot({ path: `/private/tmp/cbt-cooling-${info.project.name}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await bank.getByRole('button', { name: '통합 검색으로 문제 찾기' }).click();
  await expect(page.getByRole('combobox', { name: '검색 출처', exact: true })).toHaveValue('hvac');
  await expect(page.getByRole('combobox', { name: '과목', exact: true })).toHaveValue('냉동냉장설비');
  await page.locator('.search-command input[type=search]').fill('피스톤');
  const results = page.locator('.search-library article');
  await expect(results.first()).toBeVisible();
  await expect(page.locator('.search-library')).toContainText('한솔 공조');
  await page.getByLabel('새 학교 시험지 이름').fill('테스트 냉동 중간고사');
  await results.first().getByRole('button', { name: '+ 시험지에 담기', exact: true }).click();
  await expect(results.first().getByRole('button', { name: '✓ 시험지에 담음' })).toBeVisible();
  await results.first().getByRole('button', { name: '✓ 시험지에 담음' }).click();
  await page.getByRole('button', { name: '학교 시험 준비로', exact: true }).click();
  const set = page.locator('.school-rounds article').filter({ hasText: '테스트 냉동 중간고사' });
  await expect(set).toContainText('담은 1문제');
  await set.getByRole('button', { name: '학습모드', exact: true }).click();
  await expect(page.locator('.session-topbar')).toContainText('테스트 냉동 중간고사');
  await expect(page.locator('.question-card')).toHaveCount(1);
  // Saving the original IDs must permit resuming when bootstrap loads only school data.
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByRole('button', { name: '이어서 풀기', exact: true }).click();
  await expect(page.locator('.session-topbar')).toContainText('테스트 냉동 중간고사');
  await expect(page.locator('.question-card')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('다른 종목 선택 검색: 에너지 자료를 필요할 때 읽고 과목 범위에 맞춰 표시', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('modern-cbt-qualification-industrial', 'hvac');
    localStorage.setItem('unified-cbt-dynamic-ui', 'false');
  });
  await page.goto('./?safe=1');
  const menu = page.getByRole('button', { name: '메뉴 열기', exact: true });
  if ((page.viewportSize()?.width || 1440) <= 900) await menu.click();
  await page.locator('.sidebar').getByRole('button', { name: /문제 검색/ }).click();
  await page.getByRole('combobox', { name: '검색 출처', exact: true }).selectOption('selected');
  const choices = page.locator('.search-scope-controls fieldset');
  await choices.getByLabel('공조냉동').uncheck();
  await choices.getByLabel('한솔 공조').uncheck();
  await choices.getByLabel('에너지관리').check();
  await page.getByRole('combobox', { name: '과목', exact: true }).selectOption('all');
  await page.locator('.search-command input[type=search]').fill('압력');
  await expect(page.locator('.search-library article').first()).toBeVisible({ timeout: 30000 });
  const labels = await page.locator('.search-library article header span').allTextContents();
  expect(labels.length).toBeGreaterThan(0);
  expect(labels.every(label => label.includes('에너지관리'))).toBe(true);
  expect(errors).toEqual([]);
});

test('전체 범위 학습과 한솔 출처 랜덤 CBT가 원문 ID로 저장됨', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('modern-cbt-qualification-industrial', 'school-exams');
    localStorage.setItem('unified-cbt-dynamic-ui', 'false');
  });
  await page.goto('./?safe=1');
  const menu = page.getByRole('button', { name: '메뉴 열기', exact: true });
  if ((page.viewportSize()?.width || 1440) <= 900) await menu.click();
  await page.locator('.sidebar').getByRole('button', { name: /학교 시험 준비/ }).click();
  const bank = page.locator('.cooling-midterm');
  await expect(bank.getByRole('button', { name: '전체 문제 학습', exact: true })).toBeEnabled({ timeout: 30000 });
  await bank.getByRole('button', { name: '전체 문제 학습', exact: true }).click();
  await expect(page.locator('.session-topbar')).toContainText('전체 1875문제');
  await page.waitForTimeout(400);
  const whole = await page.evaluate(() => Object.keys(localStorage).map(key => {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  }).find(value => value?.itemIds?.length === 1875));
  expect(whole?.mode).toBe('learn');
  expect(new Set(whole?.itemIds).size).toBe(1875);
  await page.reload();
  await bank.getByRole('combobox', { name: '문제 출처', exact: true }).selectOption('hvac-hansol');
  await bank.getByRole('button', { name: '랜덤 20문제 CBT', exact: true }).click();
  await expect(page.locator('.session-topbar')).toContainText('랜덤 20문제');
  await page.waitForTimeout(400);
  const random = await page.evaluate(() => Object.keys(localStorage).map(key => {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  }).find(value => value?.itemIds?.length === 20));
  expect(random?.mode).toBe('exam');
  expect(random?.itemIds.every((id: string) => id.startsWith('hvac-hansol-'))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
