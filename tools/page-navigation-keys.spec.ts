import {test,expect} from '@playwright/test';
import {chooseBookPage,enterBookReader,openBookNavigator,closeBookNavigator} from './textbook-reader-test-helpers';
test.use({serviceWorkers:'block'});

test('교재에서 방향키로 쪽을 넘기고 목차 입력 중에는 현재 쪽을 유지한다',async({page})=>{
 await page.goto('./');
 await page.getByRole('button',{name:'회차별 기출 고르기',exact:true}).click();
 await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
 await enterBookReader(page);
 await chooseBookPage(page,'4-10');
 const number=page.locator('.printed-page-number');
 await expect(number).toContainText('4-10');
 await number.focus();await page.keyboard.press('ArrowRight');await expect(number).toContainText('4-11');
 await page.keyboard.press('Shift+ArrowRight');await expect(number).toContainText('4-11');
 const dialog=await openBookNavigator(page,'pages');
 const field=dialog.locator('.page-picker input').first();await field.focus();await field.press('End');await field.press('ArrowLeft');
 expect(await field.evaluate(el=>(el as HTMLInputElement).selectionStart)).toBe(3);
 await expect(number).toContainText('4-11');
 await dialog.getByRole('button',{name:'에너지설비 교재',exact:true}).click();await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'한솔 공조 교재',exact:true}).click();await expect(field).toHaveValue('4-11');
 await closeBookNavigator(page);
 await page.keyboard.press('ArrowLeft');await expect(number).toContainText('4-10');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cbt-textbook-pages-v1')!).hansol.from)).toBe('4-10');
});

for(const layout of ['standard','combat','comcbt']){
 test(layout+' 풀이에서 방향키가 한 화면씩 이동하고 번호 입력 중에는 멈춘다',async({page})=>{
  await page.addInitScript(mode=>localStorage.setItem('unified-cbt-solve-layout',mode),layout);
  await page.goto('./');await page.getByRole('button',{name:'회차별 기출 고르기',exact:true}).click();
  await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
  const library=page.locator('.textbook-library');await library.locator('.library-books button').filter({hasText:'한솔 공조 교재'}).click();
  await library.getByRole('searchbox').fill('23년 3회');await library.locator('.contents-results button').click();
  await library.getByRole('button',{name:'교재 회차 60문제 풀기'}).click();
  const first=page.locator('#session-question-1');await expect(first).toBeVisible();
  const choice=first.getByRole('button',{name:'이미지에서 2번 선택',exact:true});await choice.focus();await page.keyboard.press('ArrowRight');
  await expect(first).toHaveCount(0);
  const input=page.getByLabel('이동할 문제 번호');if(await input.count()){
    await input.focus();await input.press('ArrowLeft');await expect(first).toHaveCount(0);
    await input.evaluate(el=>(el as HTMLElement).blur());
  }
  await page.keyboard.press('ArrowLeft');await expect(first).toBeVisible();
 });
}

test('실기 답안을 쓰는 중에는 커서만 움직이고 풀이에서는 다음·이전 문제로 이동한다',async({page})=>{
 await page.goto('./?safe=1#/study/guide');
 await page.getByRole('button',{name:'필답형 문제풀이',exact:true}).click();
 const question=page.locator('.practical-question-grid > article').first();
 const open=page.locator('.practical-round-library button').filter({hasText:/시작하기|이어풀기/}).first();
 await expect(question.or(open).first()).toBeVisible();
 if(!await question.isVisible())await open.click();
 await page.getByLabel('필답형 화면 배치').selectOption('single');
 const answer=page.locator('.practical-answer-input textarea').first();await answer.fill('압축기');await answer.press('End');await answer.press('ArrowLeft');
 expect(await answer.evaluate(el=>(el as HTMLTextAreaElement).selectionStart)).toBe(2);
 await page.getByRole('button',{name:/다음 문제/}).focus();await page.keyboard.press('ArrowRight');await expect(answer).toHaveValue('');
 await page.keyboard.press('ArrowLeft');await expect(answer).toHaveValue('압축기');
});

test('CBT 시험에서 좌우 방향키로 이동해도 답안은 그대로 남는다',async({page})=>{
 await page.goto('./');
 await page.getByRole('button',{name:'회차별 기출 고르기',exact:true}).click();
 await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
 await enterBookReader(page);await chooseBookPage(page,'5-27','5-38');
 await page.getByRole('button',{name:'범위를 모아 CBT 시험',exact:true}).click();
 const first=page.locator('#session-question-1');
 const choice=first.getByRole('button',{name:'이미지에서 2번 선택',exact:true});
 await choice.click();await expect(choice).toHaveAttribute('aria-pressed','true');
 await page.keyboard.press('ArrowRight');await expect(first).toHaveCount(0);
 await page.keyboard.press('ArrowLeft');await expect(choice).toHaveAttribute('aria-pressed','true');
});
