import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
execFileSync('node_modules/.bin/esbuild', ['src/cbt/hvacPracticalRestored.ts', '--bundle', '--platform=node', '--format=cjs', '--outfile=/private/tmp/cbt-practical-book-adapter.cjs']);
const {hvacPracticalRestored} = createRequire(import.meta.url)('/private/tmp/cbt-practical-book-adapter.cjs') as {hvacPracticalRestored: any[]};
const bookReviewedIds = ['2024-1-01', '2024-3-01', '2024-3-02', '2025-1-02', '2025-2-01', '2025-2-02', '2025-3-01'].map(id => `hvac-practical-restored-${id}`);

test('책95개 대응·ID/원문 보존·추가 변형·사진 원본과 결과 해시', () => {
  const rows = JSON.parse(fs.readFileSync('data/hvac-practical-restored.json', 'utf8'));
  const baseline = JSON.parse(execFileSync('git', ['show', '4eeb5150:data/hvac-practical-restored.json'], { encoding: 'utf8' }));
  const remaining = JSON.parse(fs.readFileSync('data/hvac-practical-remaining-review-history.json', 'utf8')).changes;
  const updatedIds = new Set(remaining.map((r: any) => r.id));
  expect(rows.filter((r: any) => !bookReviewedIds.includes(r.id) && !updatedIds.has(r.id)).map(({bookNumber, ...row}: any) => row))
    .toEqual(baseline.filter((r: any) => !bookReviewedIds.includes(r.id) && !updatedIds.has(r.id)));
  for (const change of remaining) expect(rows.find((r: any) => r.id === change.id)).toEqual(change.updated);
  for (const id of bookReviewedIds) {
    const {bookNumber, question, answer, explanation, sourceNote, ...preserved} = rows.find((r: any) => r.id === id);
    const {question: oldQuestion, answer: oldAnswer, explanation: oldExplanation, sourceNote: oldSource, ...previous} = baseline.find((r: any) => r.id === id);
    expect(preserved).toEqual(previous);
    expect(sourceNote).toMatch(/^책 기준:/);
  }
  const mappings = new Map<string, number>();
  for (const file of ['data/hvac-practical-2023-2024-book-scans.json', 'data/hvac-practical-october-scans.json']) {
    for (const m of JSON.parse(fs.readFileSync(file, 'utf8')).sourceMapping) if (m.targetId) mappings.set(m.targetId, m.sourceQuestion);
  }
  expect(mappings.size).toBe(95);
  for (const [id, number] of mappings) {
    expect(hvacPracticalRestored.find(p => p.id === id)?.number).toBe(number);
  }
  for (const round of new Set([...mappings.keys()].map(id => id.split('-').slice(3, 5).join('-')))) {
    const prompts = hvacPracticalRestored.filter(p => `${p.year}-${p.session}` === round && p.number);
    const numbers = prompts.map(p => p.number!);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers).toEqual([...numbers].sort((a,b) => a-b));
  }
  const variant = hvacPracticalRestored.find(p => p.id === 'hvac-practical-restored-2023-2-12')!;
  expect(variant.number).toBeUndefined();
  expect(variant.numberLabel).toContain('책 미대응');
  const m = JSON.parse(fs.readFileSync('data/hvac-practical-scan-enhancement-20261007.json', 'utf8'));
  for (const [file, hash] of [[m.source, m.sourceSha256], [m.output, m.outputSha256]]) {
    expect(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')).toBe(hash);
  }
  expect(m.outputSize).toEqual(m.sourceSize.map((n: number) => n * 2));
  expect(m.architecture).toBe('arm64');
  expect(hvacPracticalRestored.find(p => p.id === 'hvac-practical-restored-2024-3-12')?.images).toEqual([m.output]);
});

test('책 질문 순서·두 인쇄 표기 안내·다른 회로 답 혼합 방지', () => {
  const get = (id: string) => hvacPracticalRestored.find(p => p.id === `hvac-practical-restored-${id}`)!;
  expect(get('2024-1-01').question).toContain('① PBS2를 누를 때 ② PBS1을 누를 때');
  expect(get('2024-1-01').answer).toMatch(/^① MC 소자, RL 소등·GL 점등\. ② MC 여자/);
  expect(get('2024-3-01').question).toContain('접점 도시기호');
  expect(get('2024-3-01').explanation).toContain('X2가 꺼지면 ③ X2-a도 열려 GL이 꺼진다');
  expect(get('2024-3-02').question).not.toContain('LI과');
  expect(get('2025-1-02').explanation).toContain('[책 표기 안내]');
  expect(get('2025-1-02').answer).not.toContain('MC');
  expect(get('2025-2-01').answer).toBe('① MC1 ② MC2 ③ MC3');
  expect(get('2025-2-02').answer).toContain('RY 소자 유지');
  expect(get('2025-3-01').explanation).toContain('인쇄 답안의 X1-b는 책 도면의 X2-b와 다르다');
  for (const id of bookReviewedIds) {
    const p = hvacPracticalRestored.find(p => p.id === id)!;
    expect(p.images[0]).toMatch(/question-scan-v550\.png$/);
  }
});

test('책 기준7문항 실제 화면·그림·표기 안내', async ({page}, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('./?safe=1');
  const later = page.getByRole('button', {name: '나중에', exact: true}); if (await later.isVisible()) await later.click();
  await page.getByRole('button', {name: '패치노트 보기'}).click();
  await page.getByRole('button', {name: /신기술 학습관/}).click();
  await page.getByRole('button', {name: /필답형 훈련관 열기/}).click();
  for (const [yearNumber, session, suffixes] of [[2024,'1',['01']], [2024,'3',['01','02']], [2025,'1',['02']], [2025,'2',['01','02']], [2025,'3',['01']]] as const) {
    const year = page.locator('.practical-year-group').filter({has: page.getByRole('heading', {name: `${yearNumber}년`, exact: true})});
    await year.getByRole('button', {name: new RegExp(`${session}회`)}).click();
    await page.getByLabel('필답형 화면 배치').selectOption('0');
    for (const suffix of suffixes) {
      const id = `hvac-practical-restored-${yearNumber}-${session}-${suffix}`;
      const prompt = hvacPracticalRestored.find(p => p.id === id)!;
      const article = page.locator(`[data-practical-id="${id}"]`);
      await expect(article.locator('.practical-question-body > header')).toContainText(`${prompt.number}번`);
      const image = article.locator('.practical-prompt-images img').first();
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
      await article.getByRole('button', {name:'정답·채점 기준 보기'}).click();
      await expect(article.locator('.practical-solution')).toContainText(prompt.answer);
      await expect(article.locator('.practical-solution')).toContainText(prompt.explanation);
      if (id.endsWith('2025-3-01')) await article.screenshot({path:`/private/tmp/cbt-book-policy-${info.project.name}.png`});
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.getByRole('button', {name:'← 회차·자료 목록', exact:true}).click();
  }
  expect(errors).toEqual([]);
});

test('책 번호 정렬·번호 이동·기존 ID 답안 보존·책4번 새 사진', async ({page}, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('./?safe=1');
  const later = page.getByRole('button', {name: '나중에', exact: true}); if (await later.isVisible()) await later.click();
  await page.getByRole('button', {name: '패치노트 보기'}).click();
  await page.getByRole('button', {name: /신기술 학습관/}).click();
  await page.getByRole('button', {name: /필답형 훈련관 열기/}).click();
  const year = page.locator('.practical-year-group').filter({has: page.getByRole('heading', {name: '2024년', exact: true})});
  await year.getByRole('button', {name: /3회/}).click();
  await page.getByLabel('필답형 화면 배치').selectOption('0');
  const articles = page.locator('.practical-question-grid > article');
  await expect(articles).toHaveCount(12);
  expect(await articles.locator('.practical-question-body > header > span').allTextContents()).toEqual(Array.from({length:12}, (_,i) => String(i+1).padStart(2,'0')));
  const photo = page.locator('[data-practical-id="hvac-practical-restored-2024-3-12"]');
  await expect(photo.locator('.practical-question-body > header')).toContainText('4번');
  const image = photo.locator('.practical-prompt-images img');
  await image.scrollIntoViewIfNeeded();
  await expect(image).toHaveAttribute('src', /question-upscaled-v551\.png/);
  await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth === 232)).toBe(true);
  expect(await image.evaluate(el => el.getBoundingClientRect().height)).toBeLessThanOrEqual(480);
  await photo.locator('textarea').fill('기존 ID 유지 확인: 액분리기');
  await photo.locator('.practical-question-body > header').scrollIntoViewIfNeeded();
  await page.screenshot({path:`/private/tmp/cbt-book-numbers-${info.project.name}.png`});
  await page.reload();
  await year.getByRole('button', {name: /3회/}).click();
  await expect(photo.locator('textarea')).toHaveValue('기존 ID 유지 확인: 액분리기');
  const contact = page.locator('[data-practical-id="hvac-practical-restored-2024-3-02"]');
  await expect(contact.locator('.practical-question-body > header')).toContainText('12번');
  await page.getByRole('button', {name:'문제 번호', exact:true}).click();
  expect(await page.locator('.practical-number-grid button').allTextContents()).toEqual(Array.from({length:12}, (_,i) => String(i+1).padStart(2,'0')));
  await page.locator('.practical-number-grid button').last().click();
  await expect(contact).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
