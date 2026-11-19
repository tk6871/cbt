import {expect, test} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('학교 시험의 직접 입력, 암기 복습, 백업 병합과 복원이 같은 문제를 유지한다', async ({page}) => {
  await page.goto('./?safe=1#/study/school');
  await page.getByPlaceholder('예: 냉동공학').fill('냉동 실습');
  await page.getByRole('button', {name:'시험지 만들기'}).click();
  await page.getByPlaceholder('객관식 문제를 입력하세요').fill('증발기의 역할은?');
  for (const [index, text] of ['압축', '흡열', '방열', '팽창'].entries()) {
    await page.getByPlaceholder(`${index + 1}번 보기`, {exact:true}).fill(text);
  }
  await page.getByRole('combobox', {name:'정답',exact:true}).selectOption('2');
  await page.getByRole('button', {name:'객관식 문제 추가'}).click();
  await page.getByPlaceholder('예: 증발기의 역할을 쓰시오.').fill('증발 과정');
  await page.getByPlaceholder('외워야 할 답을 입력하세요.').fill('열을 흡수한다.');
  await page.getByRole('button', {name:'암기카드 추가'}).click();
  await page.getByRole('button', {name:'정답 펼치기'}).click();
  await page.getByRole('button', {name:'외웠어요'}).click();
  await expect(page.getByText(/확인 1회 · 외움 1회/)).toBeVisible();
  async function backup() {
    const result = page.waitForEvent('download');
    await page.getByRole('button', {name:'백업 저장'}).click();
    const file = await (await result).path();
    return JSON.parse(await readFile(file!, 'utf8'));
  }
  const saved = await backup();
  expect(saved.rounds[0].questions[0]).toMatchObject({text:'증발기의 역할은?',answer:2});
  expect(saved.memoryCards[0]).toMatchObject({prompt:'증발 과정',reviewCount:1,knownCount:1});
  await page.reload();
  await expect(page.getByText(/확인 1회 · 외움 1회/)).toBeVisible();
  expect(await backup()).toEqual(saved);

  const extra={memoryCards:[{...saved.memoryCards[0],id:'school-fixture-card',prompt:'별도 카드'}]};
  const importFile = (data:unknown) => ({name:'학교.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  const files=page.locator('[data-react-view="school-exams"] input[type=file]');
  const invalidFile = page.waitForEvent('dialog');
  const input = files.nth(1).setInputFiles(importFile({version:1}));
  const dialog = await invalidFile;
  expect(dialog.message()).toContain('읽지 못했습니다');
  await dialog.accept();
  await input;
  expect(await backup()).toEqual(saved);
  await files.nth(0).setInputFiles(importFile(extra));
  await expect(page.getByRole('heading',{name:'별도 카드'})).toBeVisible();
  expect((await backup()).rounds).toEqual(saved.rounds);
  await files.nth(1).setInputFiles(importFile(saved));
  await expect(page.getByRole('heading',{name:'별도 카드'})).toHaveCount(0);
  expect(await backup()).toEqual(saved);
});
