import numberReview from '../data/textbook-direct-number-review.json' with {type:'json'};
import {expect,test} from '@playwright/test';
import boxes from '../data/textbook-direct-hitboxes.json' with {type:'json'};
import {textbookDirectSources} from '../src/cbt/textbookPages';
import {saveTextbookAnswer, mergeTextbookAnswers, importLegacyDirectAnswers} from '../src/cbt/textbookAnswerProgress';

test('기존 원문 답과 서로 다른 기기의 교재 답·선택 취소를 문항별로 병합한다', () => {
  const id = 'hansol-direct-1-168-25';
  const key = 'cbt-book-direct-choice-v1::' + id;
  const snapshot = {length:1, key:()=>key, getItem:(name:string)=>name===key?'3':null};
  const local:Record<string,unknown> = {textbookPageAnswersV1:{energy:2}};
  importLegacyDirectAnswers(local,snapshot);
  expect(local.textbookPageAnswersV1).toEqual({energy:2,[id]:3});
  const remote:Record<string,unknown> = {};
  saveTextbookAnswer(remote,id,0);
  saveTextbookAnswer(remote,'energy-other',4);
  const merged = {...local,...remote};
  mergeTextbookAnswers(merged,local,remote);
  importLegacyDirectAnswers(merged,snapshot);
  expect(merged.textbookPageAnswersV1).toEqual({energy:2,'energy-other':4});
  const reverse = {...merged,...local};
  mergeTextbookAnswers(reverse,merged,local);
  expect(reverse.textbookPageAnswersV1).toEqual(merged.textbookPageAnswersV1);
});

test('각 원문 보기의 실제 터치 영역이 해당 지문 안에 있고 서로 겹치지 않는다',()=>{
  const sources = new Map(textbookDirectSources.map(source=>[source.id,source]));
  expect(Object.keys(boxes).filter(id=>!numberReview.hiddenDuplicates.includes(id)).sort()).toEqual([...sources.keys()].sort());
  for(const [id, choices] of Object.entries(boxes)){
    if(numberReview.hiddenDuplicates.includes(id))continue;
    const question = sources.get(id)!;
    expect(choices, id).toHaveLength(4);
    choices.forEach(([part,x,y,w,h],i)=>{
      const [left,top,width,height]=question.questionParts[part!]!.rect;
      expect(x!>=left! && y!>=top! && w!>0 && h!>0 && x!+w!<=left!+width! && y!+h!<=top!+height!,id).toBe(true);
      for(const [other,xx,yy,ww,hh] of choices.slice(i+1)){
        expect(part!==other || x!+w!<=xx! || xx!+ww!<=x! || y!+h!<=yy! || yy!+hh!<=y!,id).toBe(true);
      }
    });
  }
});

import { enterBookReader, switchTextbook, chooseBookPage } from './textbook-reader-test-helpers';

// Centers of the printed glyphs measured on the scans, independent of the button boxes.
const samples = [
  { book: 'hansol', page: '1-168', number: 25, size: [671, 250], points: [[49,158],[318,158],[49,206],[318,206]], keep: 1 },
  { book: 'energy', page: '414', number: 16, size: [445, 243], points: [[65,152],[253,153],[65,212],[253,212]], keep: 2 },
  { book: 'energy', page: '471', number: 70, size: [445, 221], points: [[65,167],[266,168],[65,197],[266,198]], keep: 3 },
  { book: 'energy', page: '486', number: 70, size: [680, 564], points: [[87,375],[87,416],[87,457],[87,500]], keep: 4 },
] as const;

test('인쇄된 번호를 눌러 답안을 저장하고 교재 이동·새로고침 후 복원한다', async ({page, hasTouch}) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    if (!localStorage.getItem('unified-industrial-cbt-v1')) {
      localStorage.setItem('cbt-book-direct-choice-v1::hansol-direct-1-168-25','3');
    }
  });
  await page.goto('./', {waitUntil: 'domcontentloaded'});
  async function openReader() {
    if (hasTouch) await page.getByRole('button', {name:'메뉴 열기', exact:true}).click();
    await page.locator('.sidebar').getByRole('button', {name:/회차별 문제/}).click();
    await page.getByRole('button', {name:'교재 페이지별', exact:true}).click();
    await enterBookReader(page);
  }
  await openReader();
  await expect(page.locator('[data-react-view="textbook-reader"] .reader-toolbar')).toBeVisible();
  async function openSample(sample: typeof samples[number]) {
    await switchTextbook(page, sample.book);
    await chooseBookPage(page, sample.page);
    const row = page.locator('.book-sheet-question').filter({
      has: page.getByRole('heading', {name: '교재 ' + sample.number + '번', exact:true}),
    });
    const stage = row.locator(sample.book === 'energy' ? '.source-image-stage' : '.direct-question-parts .direct-viewport').first();
    const img = stage.locator('img');
    const reactChoices = sample.book === 'energy' ? '[data-react-view="printed-choices"]' : '[data-react-view="direct-question"]';
    await expect(row.locator(reactChoices)).toHaveCount(1);
    await expect(img).toBeAttached();
    await img.evaluate((image: HTMLImageElement) => image.decode());
    return stage;
  }
  async function storedAnswer(sample: typeof samples[number]) {
    return page.evaluate(({book, page, number}) => {
      if (book === 'hansol') return Number(localStorage.getItem('cbt-book-direct-choice-v1::hansol-direct-' + page + '-' + number));
      const answers = JSON.parse(localStorage.getItem('unified-industrial-cbt-v1') || '{}').progress?.textbookPageAnswersV1 || {};
      const prefix = 'book-study::energy::' + page + '::' + number + '::';
      return Object.entries(answers).find(([id]) => id.startsWith(prefix))?.[1];
    }, sample);
  }
  for (const sample of samples) {
    const stage = await openSample(sample);
    if (sample.book === 'hansol') {
      await expect(stage.locator('[aria-pressed=true]')).toHaveAttribute('aria-label','이미지에서 3번 선택');
    }
    const choices = [1,2,3,4].filter(n => n !== sample.keep).concat(sample.keep);
    for (const choice of choices) {
      await stage.evaluate(el => el.scrollIntoView({behavior:'instant',block:'center'}));
      const rect = (await stage.boundingBox())!;
      const [px, py] = sample.points[choice - 1];
      const x = rect.x + rect.width * px / sample.size[0], y = rect.y + rect.height * py / sample.size[1];
      if (hasTouch) await page.touchscreen.tap(x,y);
      else await page.mouse.click(x,y);
      await expect(stage.locator('[aria-pressed=true]')).toHaveAttribute('aria-label', '이미지에서 ' + choice + '번 선택');
      await expect.poll(() => storedAnswer(sample)).toBe(choice);
    }
  }

  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.getByRole('region', {name:'교재 전용 풀이'})).toBeVisible();
  for (const sample of samples) {
    const stage = await openSample(sample);
    await expect(stage.locator('[aria-pressed=true]')).toHaveAttribute('aria-label', '이미지에서 ' + sample.keep + '번 선택');
    expect(await storedAnswer(sample)).toBe(sample.keep);
  }
});
