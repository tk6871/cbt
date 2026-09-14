import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { matchesPracticalMaterialPeriod } from '../src/cbt/practicalMaterialPeriod';

const rows = JSON.parse(fs.readFileSync(new URL('../data/hvac-practical-restored.json', import.meta.url), 'utf8'));

test('자료 경계: 2023-1 이전 192 / 2023-2 이후 120, 중복·누락 없음', () => {
  const prompts = rows.map((row: any) => ({...row, group: 'restored'}));
  expect(prompts.filter((row: any) => matchesPracticalMaterialPeriod(row, 'since-2023-2'))).toHaveLength(120);
  expect(prompts.filter((row: any) => matchesPracticalMaterialPeriod(row, 'before-2023-2'))).toHaveLength(192);
  for (const row of prompts) {
    expect(matchesPracticalMaterialPeriod(row, 'since-2023-2')).not.toBe(matchesPracticalMaterialPeriod(row, 'before-2023-2'));
  }
  expect(matchesPracticalMaterialPeriod({group: 'public', year: 2026, session: '2'}, 'since-2023-2')).toBe(false);
});

test('기간·회차 연동, 이전 저장 호환, 답안 유지와 랜덤 범위', async ({page}, info) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('period-test-seeded')) {
      localStorage.setItem('cbt-practical-cursor', JSON.stringify({filter:'restored', round:'2023-1', page:2}));
      localStorage.setItem('period-test-seeded', '1');
    }
  });
  await page.goto('./?safe=1');
  const later = page.getByRole('button', {name:'나중에',exact:true});
  if (await later.isVisible()) await later.click();
  await page.getByRole('button', {name:'패치노트 보기'}).click();
  await page.getByRole('button', {name:/신기술 학습관/}).click();
  await page.getByRole('button', {name:/필답형 훈련관 열기/}).click();
  const period = page.getByRole('combobox', {name:'복원 자료 구분',exact:true});
  await expect(period).toHaveValue('all');
  await page.locator('.practical-scope > summary').click();
  const round = page.getByRole('combobox', {name:'복원 회차',exact:true});
  await expect(round).toHaveValue('2023-1');
  await period.selectOption('since-2023-2');
  await expect(round).toHaveValue('all');
  await expect(round.locator('option')).toHaveCount(11);
  await expect(round.locator('option[value="2023-1"]')).toHaveCount(0);
  await round.selectOption('2023-2');
  await page.getByRole('combobox', {name:'필답형 화면 배치'}).selectOption('single');
  await page.locator('.practical-question-grid textarea').first().fill('기간 전환 보존 답안');
  await period.selectOption('before-2023-2');
  await expect(round).toHaveValue('all');
  await expect(round.locator('option')).toHaveCount(17);
  await expect(round.locator('option[value="2020-2B"]')).toHaveCount(1);
  await period.selectOption('since-2023-2');
  await round.selectOption('2023-2');
  await expect(page.locator('.practical-question-grid textarea').first()).toHaveValue('기간 전환 보존 답안');
  await page.reload();
  await expect(period).toHaveValue('since-2023-2');
  if (!await round.isVisible()) await page.locator('.practical-scope > summary').click();
  await expect(round).toHaveValue('2023-2');
  await expect(page.locator('.practical-question-grid textarea').first()).toHaveValue('기간 전환 보존 답안');
  await page.getByRole('button', {name:/^공개 자료 47$/}).click();
  await expect(period).not.toBeVisible();
  await page.getByRole('button', {name:'회차별 복원 312',exact:true}).click();
  await expect(period).toHaveValue('all');
  await period.selectOption('since-2023-2');
  await page.locator('.practical-material-period').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:`/private/tmp/cbt-period-${info.project.name}.png`});
  await page.getByRole('button', {name:/랜덤 12문제 실전/}).click();
  await expect(page.locator('.practical-mock-status')).toBeVisible();
  await expect(period).not.toBeVisible();
  const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('unified-cbt-hvac-practical-session-v1')!).ids);
  expect(ids).toHaveLength(12);
  for (const id of ids) expect(matchesPracticalMaterialPeriod({...rows.find((row: any) => row.id === id), group:'restored'}, 'since-2023-2')).toBe(true);
});
