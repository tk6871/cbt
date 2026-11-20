import {expect,test} from '@playwright/test';
import {enterBookReader,closeBookNavigator} from './textbook-reader-test-helpers';

test('네 문제 중 선택한 문항으로 집중하고 답과 위치를 보존한다',async({page})=>{
  await page.goto('./#/study/rounds');
  await page.locator('#round-card-hvac-20160306').getByRole('button',{name:'학습모드',exact:true}).click();
  const cards=page.locator('.question-columns .question-card');
  const second=page.locator('#session-question-2');
  await expect(cards).toHaveCount(4);
  await second.getByRole('button',{name:'2번 한 문제로 크게 보기'}).click();
  await expect(cards).toHaveCount(1);
  await second.locator('button.choice-button:visible').nth(2).click();
  await second.getByRole('button',{name:'네 문제로 돌아가기'}).click();
  await expect(cards).toHaveCount(4);
  await expect(second.locator('button.choice-button:visible').nth(2)).toHaveAttribute('aria-pressed','true');
  await expect(second.locator('.reading-focus')).toBeFocused();
  await page.locator('.pager-next').click();
  await page.locator('#session-question-7 .reading-focus').click();
  await expect(cards).toHaveCount(1);
  await page.locator('#session-question-7 .reading-focus').click();
  await expect(cards.first()).toHaveAttribute('id','session-question-5');
  await page.locator('.pager-prev').click();
  await expect(second.locator('button.choice-button:visible').nth(2)).toHaveAttribute('aria-pressed','true');
});

test('실제 기출의 단위와 보기 차이를 해설에서 읽는다',async({page})=>{
  await page.goto('./#/study/rounds');
  await page.locator('#round-card-hvac-20160306').getByRole('button',{name:'학습모드',exact:true}).click();
  for(let i=0;i<5;i++)await page.locator('.pager-next').click();
  const q=page.locator('#session-question-23');
  await q.locator('button.choice-button:visible').nth(2).click();
  const unit=q.locator('.reading-unit');
  await expect(unit.locator('output')).toHaveText('6.9kW');
  await unit.getByRole('button',{name:'W로 보기',exact:true}).click();
  await expect(unit.locator('output')).toHaveText('6,900 W');
  await unit.getByRole('button',{name:'kW로 보기',exact:true}).click();
  await expect(unit.locator('output')).toHaveText('6.9kW');
  const compare=q.locator('.reading-comparison');
  await compare.locator('summary').click();
  await compare.locator('select').first().selectOption('0');
  await compare.locator('select').nth(1).selectOption('2');
  await expect(compare.locator('p').nth(1)).toHaveText('6.9kW');
  const original=await compare.locator('p').allTextContents();
  await expect(compare.locator('mark')).toHaveCount(2);
  await compare.getByRole('button').click();
  await expect(compare.locator('mark')).toHaveCount(0);
  expect(await compare.locator('p').allTextContents()).toEqual(original);
});

test('일반 CBT 시험에서 이미 응답한 문항을 미응답 필터로 제외한다',async({page})=>{
  await page.goto('./#/study/rounds');
  await page.locator('#round-card-hvac-20160306').getByRole('button',{name:'CBT 시험모드',exact:true}).click();
  await page.locator('#session-question-1 button.choice-button:visible').first().click();
  const sheet=page.locator('.omr-sheet');
  if(!await sheet.locator('.omr-filter-bar').isVisible())await page.getByRole('button',{name:'OMR 열기',exact:true}).click();
  const rows=sheet.locator('[data-omr-index]');
  const total=await rows.count();
  await sheet.getByRole('button',{name:/^미응답 \d/}).click();
  await expect(rows).toHaveCount(total-1);
  await expect(sheet.locator('[data-omr-index="0"]')).toHaveCount(0);
  await sheet.getByRole('button',{name:'전체',exact:true}).click();
  await expect(rows).toHaveCount(total);
});

test('교재 단원 색인으로 실제 수록 쪽을 연다',async({page})=>{
  await page.goto('./#/study/rounds');
  await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
  await enterBookReader(page);await closeBookNavigator(page);
  const index=page.locator('.book-edge-index');
  await index.locator('summary').click();
  const tab=index.getByRole('button',{name:/냉동장치의 구조/});
  const printed=await tab.locator('small').innerText();
  await tab.click();
  await expect(page.locator('.reader-navigator-trigger')).toContainText(printed);
  await expect(page.locator('.book-sheet')).toBeVisible();
});
