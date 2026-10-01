import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import vm from 'node:vm';
import { coolingMidtermItems, uniqueSchoolItems, coolingRecordItem, coolingUnusedItems, coolingOriginalId, coolingTopic, coolingTopics, coolingTopicGroups, schoolItemKey, coolingBookChapters, coolingSectionGroups, coolingBookSection } from '../src/cbt/schoolQuestionBank';
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
  const groups = coolingTopicGroups(pool);
  expect(groups.map(group => group.label)).toEqual([...coolingTopics, '분류 미확인']);
  expect(groups.flatMap(group => group.items)).toHaveLength(1875);
  expect(new Set(groups.flatMap(group => group.items).map(schoolItemKey)).size).toBe(1875);
  expect(groups.flatMap(group => group.aliases)).toHaveLength(1920);
  expect(groups.find(group => group.label === '분류 미확인')!.items.length).toBeGreaterThan(0);
  for (const group of groups) {
    const keys = new Set(group.items.map(schoolItemKey));
    expect(group.aliases.every(item => keys.has(schoolItemKey(item)))).toBe(true);
    const sections = coolingSectionGroups(group);
    if (group.label === '분류 미확인') { expect(sections).toEqual([]); continue; }
    expect(sections.map(section => section.label)).toEqual([...coolingBookChapters.find(chapter => chapter.title === group.label)!.sections, '세부 분류 미확인']);
    expect(sections.flatMap(section => section.items)).toHaveLength(group.items.length);
    expect(new Set(sections.flatMap(section => section.items).map(schoolItemKey)).size).toBe(group.items.length);
    expect(sections.flatMap(section => section.aliases)).toHaveLength(group.aliases.length);
  }
  expect(pool.every(i => i.subject === '냉동냉장설비')).toBe(true);
  for (const item of pool) expect(items.find(i => i.id === item.id)?.question).toBe(item.question);
  const one = pool.find(i => (i.question.text || '').length > 8)!;
  const altered = { ...one, id: 'different-numbers', question: { ...one.question, text: `${one.question.text} 123.5` } };
  expect(uniqueSchoolItems([one, one, altered])).toHaveLength(2);
  const old = normalizeSchoolExamData({ version: 1, rounds: [], scopes: [], memoryCards: [] });
  const merged = mergeSchoolExamData(old, { questionSets: [{ id: 'a', title: '중간고사', subject: '냉동공학', itemIds: [one.id, one.id] }] });
  expect(merged.questionSets?.[0].itemIds).toEqual([one.id]);
  expect(normalizeSchoolExamData(JSON.parse(JSON.stringify(merged)))).toEqual(merged);
  const scoped = pool.map(coolingRecordItem);
  expect(scoped[0].id).not.toBe(pool[0].id);
  expect(coolingOriginalId(scoped[0].id)).toBe(pool[0].id);
  expect(scoped[0].question).toBe(pool[0].question);
  const draw = { ids: scoped.slice(0, 20).map(item => item.id), resetAt: 0, savedAt: 1 };
  expect(coolingUnusedItems(scoped, scoped, draw, {}).every(item => !draw.ids.includes(item.id))).toBe(true);
  expect(coolingUnusedItems([scoped[0]], scoped, { ids: [], resetAt: 0, savedAt: 0 }, { [scoped[0].id]: { at: 10 } })).toHaveLength(0);
  expect(coolingUnusedItems([scoped[0]], scoped, { ids: [], resetAt: 20, savedAt: 20 }, { [scoped[0].id]: { at: 10 } })).toHaveLength(1);
  const topicExamples = ['카르노 냉동사이클의 성적계수', '스크롤 압축기의 구조', '제빙 및 동결장치의 특징', '부하 계산과 침입열 및 열관류', '오일트랩과 이중입상관', '냉각탑 냉각수의 수온'];
  topicExamples.forEach((text, index) => expect(coolingTopic({ ...one, question: { ...one.question, text, html: '', ocrText: '', explanation: '', explanationHtml: '', choices: [] } })).toBe(coolingTopics[index]));
  expect(coolingTopic({ ...one, question: { ...one.question, text: '원문 이미지 문제', html: '', ocrText: '', explanation: '', explanationHtml: '', choices: [] } })).toBe('분류 미확인');
  for (const [text, chapter, section] of [
    ['브라인의 동결 온도', '냉동이론', '냉매와 브라인'],
    ['몰리에르 선도와 냉동 사이클', '냉동이론', '냉매선도와 냉동 사이클'],
    ['이상 기체의 등온 과정', '냉동이론', '기초열역학'],
    ['열역학 제1법칙', '냉동이론', '열역학의 법칙'],
    ['피스톤 핀과 커넥팅 로드의 대단부', '냉동장치의 구조', '압축기 구성 기기와 특징'],
    ['히트펌프와 축열장치', '냉동장치의 응용과 안전관리', '냉동장치의 응용(열펌프 및 축열장치)'],
    ['냉동 부하와 침입열 계산', '냉동냉장 부하계산', '냉동냉장부하 계산'],
    ['냉매 충전 작업', '냉동설비의 설치', '냉동설비의 설치'],
    ['냉각탑 수질관리', '냉방설비운영', '냉각탑 점검·종류·특성·수질관리'],
  ]) {
    const item = { ...one, question: { ...one.question, text, html: '', ocrText: '', explanation: '', explanationHtml: '', choices: [] } };
    expect(coolingTopic(item)).toBe(chapter);
    expect(coolingBookSection(item, chapter)).toBe(section);
  }
  const distribution: Record<string, number> = {};
  pool.forEach(item => { const label = coolingTopic(item); distribution[label] = (distribution[label] || 0) + 1; });
  console.log('Cooling topic rule audit:', distribution);
  console.log('Cooling book chapter audit:', JSON.stringify(groups.map(group => ({ title: group.label, unique: group.items.length, sections: coolingSectionGroups(group).map(section => ({ title: section.label, count: section.items.length })) }))));
  expect(Object.values(distribution).reduce((sum, value) => sum + value, 0)).toBe(1920);
});

test('회차별 중간고사·공조+한솔 검색·학교 시험지 담기·새로고침 이어하기', async ({ page }, info) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('modern-cbt-qualification-industrial')) localStorage.setItem('modern-cbt-qualification-industrial', 'hvac');
    localStorage.setItem('unified-cbt-dynamic-ui', 'false');
  });
  await page.goto('./?safe=1');
  const menu = page.getByRole('button', { name: '메뉴 열기', exact: true });
  if ((page.viewportSize()?.width || 1440) <= 900) await menu.click();
  await page.locator('.sidebar').getByRole('button', { name: /회차별 문제/ }).click();
  await page.locator('.rounds-collection').getByRole('button', { name: '냉동공학 중간고사', exact: true }).click();
  const bank = page.locator('.cooling-midterm');
  await expect(bank.getByRole('button', { name: '교재 목차', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(bank.locator('.round-card').first()).toBeVisible({ timeout: 30000 });
  await bank.getByRole('button', { name: '전체·랜덤', exact: true }).click();
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

test('전체 범위 학습과 한솔 랜덤 CBT를 별도 학교 기록으로 저장', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('modern-cbt-qualification-industrial')) localStorage.setItem('modern-cbt-qualification-industrial', 'hvac');
    localStorage.setItem('unified-cbt-dynamic-ui', 'false');
  });
  await page.goto('./?safe=1');
  const menu = page.getByRole('button', { name: '메뉴 열기', exact: true });
  if ((page.viewportSize()?.width || 1440) <= 900) await menu.click();
  await page.locator('.sidebar').getByRole('button', { name: /회차별 문제/ }).click();
  await page.locator('.rounds-collection').getByRole('button', { name: '냉동공학 중간고사', exact: true }).click();
  const bank = page.locator('.cooling-midterm');
  await bank.getByRole('button', { name: '전체·랜덤', exact: true }).click();
  await expect(bank.getByRole('button', { name: '전체 문제 학습', exact: true })).toBeEnabled({ timeout: 30000 });
  await bank.getByRole('button', { name: '전체 문제 학습', exact: true }).click();
  await expect(page.locator('.session-topbar')).toContainText('전체 1875문제');
  await page.waitForTimeout(400);
  const whole = await page.evaluate(() => Object.keys(localStorage).map(key => {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  }).find(value => value?.itemIds?.length === 1875));
  expect(whole?.mode).toBe('learn');
  expect(whole?.qualificationKey).toBe('school-exams');
  expect(await page.evaluate(() => localStorage.getItem('modern-cbt-qualification-industrial'))).toBe('school-exams');
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
  expect(random?.itemIds.every((id: string) => id.startsWith('school-cooling::hvac-hansol-'))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('소과목 카드 선택, 오답 분리, 두 랜덤 묶음 중복 제외와 이전 답안 복원', async ({ page }, info) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('modern-cbt-qualification-industrial')) localStorage.setItem('modern-cbt-qualification-industrial', 'hvac');
    localStorage.setItem('unified-cbt-dynamic-ui', 'false');
    if (!localStorage.getItem('unified-industrial-cbt-v1')) localStorage.setItem('unified-industrial-cbt-v1', JSON.stringify({ attempts: { 'existing-hvac:1': { count: 3, lastCorrect: false, at: 1 } }, wrong: { 'existing-hvac:1': { count: 3, at: 1 } }, bookmarks: [], progress: {}, notes: {} }));
  });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('./?safe=1');
  if ((page.viewportSize()?.width || 1440) <= 900) await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
  await page.locator('.sidebar').getByRole('button', { name: /회차별 문제/ }).click();
  await page.locator('.rounds-collection').getByRole('button', { name: '냉동공학 중간고사', exact: true }).click();
  const bank = page.locator('.cooling-midterm');
  await bank.getByRole('button', { name: '전체·랜덤', exact: true }).click();
  await expect(bank.getByRole('button', { name: '전체 문제 학습', exact: true })).toBeEnabled({ timeout: 30000 });
  await bank.getByRole('combobox', { name: '문제 출처', exact: true }).selectOption('hvac');
  await expect(bank.getByRole('combobox', { name: '연도', exact: true })).toHaveCount(0);
  await expect(bank.getByRole('combobox', { name: '회차', exact: true })).toHaveCount(0);
  const topics = await bank.getByRole('combobox', { name: '교재 장', exact: true }).locator('option').allTextContents();
  coolingTopics.forEach(topic => expect(topics.some(label => label.includes(topic))).toBe(true));
  await bank.getByRole('combobox', { name: '교재 장', exact: true }).selectOption('냉동이론');
  await bank.getByRole('button', { name: '교재 목차', exact: true }).click();
  const theoryCount = await bank.locator('.round-grid article').count();
  expect(theoryCount).toBe(7);
  await page.screenshot({ path: `/private/tmp/cbt-cooling-rounds-${info.project.name}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await bank.locator('.round-card[data-topic="냉동이론"]').getByRole('button', { name: /^학습모드 ·/ }).click();
  await expect(page.locator('.session-topbar')).toContainText('냉동이론');
  await page.waitForTimeout(300);
  const readSession = () => page.evaluate(() => Object.keys(localStorage).map(key => {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  }).find(value => value?.itemIds?.length && value?.title?.startsWith('냉동공학 중간고사')));
  const roundSaved = await readSession();
  expect(roundSaved.itemIds.length).toBeGreaterThan(100);
  const originalId = coolingOriginalId(roundSaved.itemIds[0]);
  const context = { window: {} as Record<string, Catalog> };
  vm.runInNewContext(fs.readFileSync('data/hvac.js', 'utf8'), context);
  const originalItems = Object.values(context.window)[0].rounds.flatMap(r => r.questions.map(q => ({ round: { ...r, qualificationKey: 'hvac' }, question: q, id: questionId(r, q), subject: subjectFor(r, q) })));
  const theoryGroup = coolingTopicGroups(coolingMidtermItems(originalItems)).find(group => group.label === '냉동이론')!;
  const originalsById = new Map(originalItems.map(item => [item.id, item]));
  expect(roundSaved.itemIds.map((id: string) => schoolItemKey(originalsById.get(coolingOriginalId(id))!)).sort()).toEqual(theoryGroup.items.map(schoolItemKey).sort());
  const original = Object.values(context.window)[0].rounds.flatMap(r => r.questions.map(q => ({ id: questionId(r, q), q }))).find(row => row.id === originalId)!;
  const wrongChoice = original.q.answer === 1 ? 2 : 1;
  await page.locator('.question-card').first().locator('button.choice-button').nth(wrongChoice - 1).click();
  await page.waitForTimeout(400);
  const wrongStore = await page.evaluate(() => JSON.parse(localStorage.getItem('unified-industrial-cbt-v1') || '{}'));
  expect(wrongStore.wrong[roundSaved.itemIds[0]]).toBeTruthy();
  expect(wrongStore.attempts[originalId]).toBeUndefined();
  expect(wrongStore.wrong['existing-hvac:1'].count).toBe(3);
  await page.locator('.session-topbar .back-button').click();
  const roundCard = bank.locator('.round-card[data-topic="냉동이론"]');
  await expect(roundCard).toContainText(`풀이 1/${roundSaved.itemIds.length}`);
  await expect(roundCard.getByRole('button', { name: '오답 1개', exact: true })).toBeVisible();
  await roundCard.getByRole('button', { name: '이어서 풀기', exact: true }).click();
  await expect(page.locator('.session-topbar')).toContainText('냉동이론');
  await page.waitForTimeout(300);
  expect((await readSession()).answers[roundSaved.itemIds[0]]).toBe(wrongChoice);
  await page.locator('.session-topbar .back-button').click();
  await bank.getByRole('button', { name: '중간고사 오답', exact: true }).click();
  await expect(bank.getByRole('heading', { name: '중간고사 전용 오답 1문제', exact: true })).toBeVisible();
  await bank.getByRole('button', { name: '전체·랜덤', exact: true }).click();
  await bank.getByRole('combobox', { name: '랜덤 문제 수', exact: true }).selectOption('10');
  await bank.getByRole('button', { name: '랜덤 10문제 학습', exact: true }).click();
  await page.waitForTimeout(400);
  const first = await readSession();
  await page.locator('.session-topbar .back-button').click();
  await bank.getByRole('combobox', { name: '랜덤 문제 수', exact: true }).selectOption('10');
  await bank.getByRole('button', { name: '랜덤 10문제 학습', exact: true }).click();
  await page.waitForTimeout(400);
  const second = await readSession();
  expect(first.itemIds.some((id: string) => second.itemIds.includes(id))).toBe(false);
  await page.reload();
  await bank.getByRole('button', { name: '풀이 기록', exact: true }).click();
  await expect(bank.getByRole('heading', { name: '진행 중인 문제 묶음 3개', exact: true })).toBeVisible();
  await bank.locator(`article[data-session-id="${roundSaved.id}"]`).getByRole('button', { name: '이 묶음 이어풀기', exact: true }).click();
  await expect(page.locator('.session-topbar')).toContainText('냉동이론');
  await page.waitForTimeout(300);
  const resumed = await readSession();
  expect(resumed.id).toBe(roundSaved.id);
  expect(resumed.answers[roundSaved.itemIds[0]]).toBe(wrongChoice);
  await page.locator('.session-topbar .back-button').click();
  await bank.getByRole('button', { name: '전체·랜덤', exact: true }).click();
  await bank.getByRole('button', { name: '랜덤 출제 순환 다시 시작', exact: true }).click();
  await page.waitForTimeout(300);
  const resetStore = await page.evaluate(() => JSON.parse(localStorage.getItem('unified-industrial-cbt-v1') || '{}'));
  expect(resetStore.wrong[roundSaved.itemIds[0]]).toEqual(wrongStore.wrong[roundSaved.itemIds[0]]);
  expect(resetStore.progress['school-cooling-midterm-draws'].ids).toEqual([]);
  expect(resetStore.progress['school-cooling-midterm-sessions'].sessions).toHaveLength(3);
  await bank.getByRole('button', { name: '랜덤 10문제 CBT', exact: true }).click();
  await page.waitForTimeout(300);
  const exam = await readSession();
  await page.locator('.question-card').first().locator('button.choice-button').first().click();
  await page.getByRole('button', { name: '시험 제출·채점', exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByRole('button', { name: '시작 화면으로', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '시작 화면으로', exact: true }).click();
  await bank.getByRole('button', { name: '풀이 기록', exact: true }).click();
  await expect(bank.getByRole('heading', { name: '완료한 중간고사 1개', exact: true })).toBeVisible();
  await page.reload();
  await expect(bank.getByRole('heading', { name: '완료한 중간고사 1개', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('modern-cbt-qualification-industrial'))).toBe('school-exams');
  const completedStore = await page.evaluate(() => JSON.parse(localStorage.getItem('unified-industrial-cbt-v1') || '{}'));
  expect(completedStore.progress['school-cooling-midterm-sessions'].sessions).toHaveLength(3);
  expect(completedStore.attempts[exam.itemIds[0]]).toBeTruthy();
  expect(completedStore.attempts[coolingOriginalId(exam.itemIds[0])]).toBeUndefined();
  await bank.getByRole('button', { name: '같은 문제 다시 풀기', exact: true }).click();
  await page.waitForTimeout(300);
  const replayed = await readSession();
  expect(replayed.itemIds).toEqual(exam.itemIds);
  expect(replayed.answers).toEqual({});
});

test('v5.3 중간고사 진행 답안은 유지하고 새 분리 ID로 이어풀기', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('modern-cbt-qualification-industrial', 'school-exams');
    localStorage.setItem('unified-cbt-dynamic-ui', 'false');
    if (!localStorage.getItem('unified-cbt-learning-session-industrial')) localStorage.setItem('unified-cbt-learning-session-industrial', JSON.stringify({ version: 1, qualificationKey: 'school-exams', mode: 'learn', title: '냉동공학 중간고사 · 전체 2문제', itemIds: ['hvac-20211:21', 'hvac-20211:22'], answers: { 'hvac-20211:21': 2 }, kept: ['hvac-20211:22'], page: 1, pageSize: 1, startedAt: Date.now() - 10000, savedAt: Date.now() }));
    localStorage.setItem('school-cooling-selection-v1', JSON.stringify({ layoutVersion: 2, source: 'all', year: '2023', roundId: 'hvac-20231', topic: '냉동이론', tab: 'rounds' }));
  });
  await page.goto('./?safe=1');
  if ((page.viewportSize()?.width || 1440) <= 900) await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
  await page.locator('.sidebar').getByRole('button', { name: /회차별 문제/ }).click();
  await expect(page.locator('.cooling-midterm').getByRole('button', { name: '교재 목차', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.cooling-midterm .round-card')).toHaveCount(7);
  await page.locator('.resume-learning-card').getByRole('button', { name: '이어서 풀기', exact: true }).click();
  await expect(page.locator('.session-topbar')).toContainText('냉동공학 중간고사');
  await page.waitForTimeout(400);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial') || '{}'));
  expect(saved.itemIds).toEqual(['school-cooling::hvac-20211:21', 'school-cooling::hvac-20211:22']);
  expect(saved.answers).toEqual({ 'school-cooling::hvac-20211:21': 2 });
  expect(saved.kept).toEqual(['school-cooling::hvac-20211:22']);
  expect(saved.page).toBe(1);
});

test('학교 회차 첫 화면은 중간고사·일반 기출 버튼 없음·종목별 기출 유지', async ({ page }, info) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('modern-cbt-qualification-industrial')) localStorage.setItem('modern-cbt-qualification-industrial', 'school-exams');
    localStorage.setItem('unified-cbt-dynamic-ui', 'false');
  });
  await page.goto('./?safe=1');
  const openMenu = async () => {
    if ((page.viewportSize()?.width || 1440) <= 900) await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
  };
  await openMenu();
  await page.locator('.sidebar').getByRole('button', { name: /회차별 문제/ }).click();
  const choices = page.locator('.rounds-collection');
  await expect(page.getByRole('button', { name: '일반 기출', exact: true })).toHaveCount(0);
  await expect(choices).toHaveCount(0);
  await expect(page.locator('.cooling-midterm .round-card').first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.cooling-midterm .round-card')).toHaveCount(7);
  await expect(page.locator('.cooling-midterm').getByRole('combobox', { name: '연도', exact: true })).toHaveCount(0);
  for (const label of [...coolingTopics, '분류 미확인']) await expect(page.locator('.cooling-midterm').getByRole('heading', { name: label, exact: true })).toBeVisible();
  await expect(page.locator('.school-hero')).toHaveCount(0);
  await page.screenshot({ path: `/private/tmp/cbt-cooling-relocated-${info.project.name}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  if (info.project.name === 'desktop') {
    await page.setViewportSize({ width: 960, height: 900 });
    await page.screenshot({ path: '/private/tmp/cbt-cooling-relocated-fhd-half.png' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await page.getByRole('combobox', { name: '현재 화면의 자격증 종목', exact: true }).selectOption('hvac');
  await expect(page.locator('.cooling-midterm')).toHaveCount(0);
  expect(await page.locator('.round-grid .round-card').count()).toBeGreaterThan(0);
  await openMenu();
  await page.locator('.sidebar').getByRole('button', { name: /학교 시험 준비/ }).click();
  await expect(page.locator('.cooling-midterm')).toHaveCount(0);
  await expect(page.locator('.school-rounds')).toBeVisible();
  await openMenu();
  await page.locator('.sidebar').getByRole('button', { name: /회차별 문제/ }).click();
  await expect(page.locator('.cooling-midterm')).toBeVisible();
  await page.getByRole('combobox', { name: '현재 화면의 자격증 종목', exact: true }).selectOption('energy');
  await expect(page.getByRole('combobox', { name: '현재 화면의 자격증 종목', exact: true })).toHaveValue('energy');
  await expect(page.locator('.round-grid .round-card').first()).toBeVisible();
  await expect(page.locator('.cooling-midterm')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('modern-cbt-qualification-industrial'))).toBe('energy');
});

test('오래된 분리 CSS가 남아도 버전별 CSS로 필터·버튼 스타일 유지', async ({ page }) => {
  const obsoleteRequests: string[] = [];
  await page.route('**/modern/CoolingMidterm.css', route => {
    obsoleteRequests.push(route.request().url());
    return route.fulfill({ contentType: 'text/css', body: '.cooling-midterm[data-v-obsolete]{display:block}' });
  });
  await page.addInitScript(() => {
    localStorage.setItem('modern-cbt-qualification-industrial', 'school-exams');
    localStorage.setItem('unified-cbt-dynamic-ui', 'false');
  });
  await page.goto('./?safe=1');
  if ((page.viewportSize()?.width || 1440) <= 900) await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
  await page.locator('.sidebar').getByRole('button', { name: /회차별 문제/ }).click();
  const bank = page.locator('.cooling-midterm');
  await expect(bank.locator('.round-card').first()).toBeVisible({ timeout: 30000 });
  await expect.poll(() => bank.locator('.midterm-controls').evaluate(element => getComputedStyle(element).display)).toBe('flex');
  expect(await bank.getByRole('button', { name: '교재 목차', exact: true }).innerText()).toBe('교재 목차');
  await bank.getByRole('button', { name: '전체·랜덤', exact: true }).click();
  for (const name of ['문제 출처', '교재 장']) {
    expect(await bank.getByRole('combobox', { name, exact: true }).evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  }
  expect(obsoleteRequests).toEqual([]);
  const cssUrls = await page.locator('link[rel=stylesheet]').evaluateAll(elements => elements.map(element => (element as HTMLLinkElement).href));
  expect(cssUrls.some(url => /\/CoolingMidterm-v\d+\.css$/.test(url))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('교재 세부 목차 선택·범위 학습/랜덤/오답·이어풀기와 소과목 표기 제거', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept());
  await page.addInitScript(() => {
    if (!localStorage.getItem('modern-cbt-qualification-industrial')) localStorage.setItem('modern-cbt-qualification-industrial', 'school-exams');
    localStorage.setItem('unified-cbt-dynamic-ui', 'false');
  });
  await page.goto('./?safe=1');
  if ((page.viewportSize()?.width || 1440) <= 900) await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
  await page.locator('.sidebar').getByRole('button', { name: /회차별 문제/ }).click();
  const bank = page.locator('.cooling-midterm');
  await expect(bank.getByRole('button', { name: '학습모드 · 냉동이론', exact: true })).toBeEnabled({ timeout: 30000 });
  await expect(bank.getByText('소과목', { exact: true })).toHaveCount(0);
  await bank.getByRole('button', { name: '세부 목차 보기 · 냉동이론', exact: true }).click();
  await expect(bank.locator('.round-card')).toHaveCount(7);
  for (const title of coolingBookChapters[0].sections) await expect(bank.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.screenshot({ path: `/private/tmp/cbt-cooling-book-${info.project.name}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  if (info.project.name === 'desktop') {
    await page.setViewportSize({ width: 960, height: 900 });
    await page.screenshot({ path: '/private/tmp/cbt-cooling-book-fhd-half.png' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  const card = bank.locator('.round-card[data-section="냉매와 브라인"]');
  await expect(card.getByRole('button', { name: '학습모드 · 냉매와 브라인', exact: true })).toBeEnabled();
  await card.getByRole('button', { name: '학습모드 · 냉매와 브라인', exact: true }).click();
  await expect(page.locator('.session-topbar')).toContainText('냉매와 브라인');
  await page.waitForTimeout(300);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial') || '{}'));
  expect(saved.itemIds.length).toBeGreaterThan(0);
  const context = { window: {} as Record<string, Catalog> };
  for (const key of ['hvac', 'hvac-hansol']) vm.runInNewContext(fs.readFileSync(`data/${key}.js`, 'utf8'), context);
  const items: QuestionItem[] = Object.values(context.window).flatMap(c => c.rounds.flatMap(r => r.questions.map(q => ({ round: { ...r, qualificationKey: c.key }, question: q, id: questionId(r, q), subject: subjectFor(r, q) }))));
  const byId = new Map(items.map(item => [item.id, item]));
  expect(saved.itemIds.every((id: string) => coolingBookSection(byId.get(coolingOriginalId(id))!, '냉동이론') === '냉매와 브라인')).toBe(true);
  const first = byId.get(coolingOriginalId(saved.itemIds[0]))!;
  const wrong = first.question.answer === 1 ? 2 : 1;
  await page.locator('.question-card').first().locator('button.choice-button').nth(wrong - 1).click();
  await page.waitForTimeout(400);
  await page.locator('.session-topbar .back-button').click();
  await expect(card).toContainText(`풀이 1/${saved.itemIds.length}`);
  await card.getByRole('button', { name: '이어서 풀기', exact: true }).click();
  await expect(page.locator('.session-topbar')).toContainText('냉매와 브라인');
  await page.waitForTimeout(300);
  await page.locator('.session-topbar .back-button').click();
  await bank.getByRole('button', { name: '전체·랜덤', exact: true }).click();
  await bank.getByRole('combobox', { name: '세부 목차', exact: true }).selectOption('냉매와 브라인');
  await bank.getByRole('button', { name: '중간고사 오답', exact: true }).click();
  await expect(bank.getByRole('heading', { name: '중간고사 전용 오답 1문제', exact: true })).toBeVisible();
  await bank.getByRole('button', { name: '전체·랜덤', exact: true }).click();
  await page.reload();
  await expect(bank.getByRole('combobox', { name: '세부 목차', exact: true })).toHaveValue('냉매와 브라인');
  await bank.getByRole('combobox', { name: '랜덤 문제 수', exact: true }).selectOption('10');
  await bank.getByRole('button', { name: '랜덤 10문제 CBT', exact: true }).click();
  await expect(page.locator('.session-topbar')).toContainText('냉매와 브라인');
  await page.waitForTimeout(300);
  await page.locator('.session-topbar .back-button').click();
  await bank.getByRole('button', { name: '교재 목차', exact: true }).click();
  await expect(bank.locator('.round-card')).toHaveCount(7);
});
