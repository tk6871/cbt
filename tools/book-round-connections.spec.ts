import {expect, test} from '@playwright/test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {problemImage} from '../src/cbt/problemImages';
import {bookContents, contentsEntries, examQuery, searchContents, contentsRows} from '../src/cbt/textbookContents';
import {textbookEntries, textbookStudyId, readableBookPages} from '../src/cbt/textbookPages';
import type {Catalog} from '../src/cbt/types';

test.use({serviceWorkers:'block'});

test('한솔 부록 9회와 에너지 교재 21회의 전 문항 번호를 대조한다', () => {
  const env = {window:{} as {CBT_DATA_HANSOL_HVAC?:Catalog}};
  vm.runInNewContext(readFileSync('data/hvac-hansol.js','utf8'), env);
  const latest = bookContents.hansol.find(n=>n.id==='hansol-latest')!.children!;
  expect(latest).toHaveLength(9);
  for (const node of latest) {
    const round = env.window.CBT_DATA_HANSOL_HVAC!.rounds.find(r=>r.id===node.roundBankId)!;
    expect(round.title).toContain(node.title);
    expect(round.questions.map(q=>q.number)).toEqual(Array.from({length:60},(_,i)=>i+1));
  }
  const reviewed=contentsEntries(latest.find(node=>node.roundBankId==='hvac-hansol-2023-3')!,textbookEntries);
  expect(reviewed.map(e=>e.number)).toEqual(Array.from({length:60},(_,i)=>i+1));
  expect(reviewed.every(e=>e.sourceId&&!e.reviewHold)).toBe(true);
  for(const e of reviewed.filter(e=>e.previousDirectId))expect(textbookStudyId(e)).toBe(e.previousDirectId);
  expect(readableBookPages('energy','82','99',[],new Set()).map(p=>p.page)).toEqual(['88','89']);
  const energy = bookContents.energy.find(n=>n.id==='energy-exams')!.children!;
  expect(energy).toHaveLength(21);
  for (const node of energy) {
    const entries = contentsEntries(node,textbookEntries).filter(e=>e.sourceId&&!e.reviewHold);
    expect(new Set(entries.map(e=>e.sourceId)).size,node.title).toBe(80);
    expect([...new Set(entries.map(e=>e.number))].sort((a,b)=>a-b)).toEqual(Array.from({length:80},(_,i)=>i+1));
  }
  const rows=contentsRows(bookContents.energy,textbookEntries);
  expect(examQuery('23년 제 3회')).toEqual({year:'2023',session:'3'});
  expect(searchContents(rows,'23년 3회')).toHaveLength(0);
  expect(searchContents(rows,'2020년 2회')[0]?.node.title).toContain('1·2통합');
});

for (const book of ['hansol','energy'] as const) {
  test(book+' 교재 목차에서 전체 회차를 열고 원문 이미지의 3번을 저장한다', async ({page,hasTouch})=>{
    await page.route('**/cloud-config.js*',route=>route.fulfill({contentType:'application/javascript',body:'window.CBT_CLOUD_CONFIG = {};'}));
    if(book==='hansol'&&hasTouch)await page.addInitScript(()=>{
      localStorage.setItem('cbt-book-direct-choice-v1::hansol-direct-5-27-3','4');
    });
    await page.goto('./');
    await page.getByRole('button',{name:'회차별 기출 고르기',exact:true}).click();
    await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
    const library=page.locator('.textbook-library');
    await library.locator('.library-books button').filter({hasText:book==='hansol'?'한솔 공조 교재':'에너지설비 교재'}).click();
    await library.getByRole('searchbox').fill('23년 3회');
    const results=library.locator('.contents-results');
    if(book==='energy') {
      await expect(results).toContainText('이 교재에 없습니다');
      await expect(results.getByRole('button')).toHaveCount(3);
      await results.getByRole('button',{name:/2023년 4회/}).click();
    } else {
      await expect(results.getByRole('button')).toHaveCount(1);
      await expect(results.getByRole('button')).toContainText('60문제 연결');
      await results.getByRole('button',{name:/2023년 3회/}).click();
    }
    if(book==='hansol'&&hasTouch){
      await library.getByRole('button',{name:/이 단원 펼치기/}).click();
      const sheet=page.getByRole('article',{name:'교재 페이지 풀이'});
      const third=sheet.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 3번',exact:true})});
      await expect(third.getByRole('button',{name:'이미지에서 4번 선택'})).toHaveAttribute('aria-pressed','true');
      await expect(sheet.getByRole('heading',{name:'교재 5번',exact:true})).toHaveCount(0);
      await page.getByRole('button',{name:'2023년 3회 한솔 기출 60문제 전체 풀기'}).click();
    }else{
      await library.getByRole('button',{name:book==='hansol'?'한솔 기출 60문제 전체 풀기':'교재 회차 80문제 풀기'}).click();
    }
    const card=page.locator('[data-react-view="question-card"]').first();
    const image=card.locator('.source-image-stage img').first();
    await expect(image).toBeVisible();
    await image.evaluate((el:HTMLImageElement)=>el.decode());
    const choice=card.getByRole('button',{name:'이미지에서 3번 선택',exact:true});
    if(hasTouch) await choice.tap(); else await choice.click();
    const recordKey='unified-cbt-learning-session-industrial';
    const readAnswer=()=>page.evaluate(key=>{
      const record=JSON.parse(localStorage.getItem(key)||'{}');
      return [record.itemIds?.length,record.itemIds?.[0],record.answers?.[record.itemIds?.[0]]];
    },recordKey);
    const expected=[book==='hansol'?60:80,book==='hansol'?'hvac-hansol-2023-3:1':'book-study::energy::553::1::energy-industrial-restored-2023-4:1',3];
    await expect.poll(readAnswer).toEqual(expected);
    await page.reload();
    expect(await readAnswer()).toEqual(expected);
  });
}

test('공조 회차 목록에서 한솔 27회차와 일반 기출을 오간다',async({page})=>{
  await page.goto('./');
  await page.getByRole('button',{name:'회차별 기출 고르기'}).click();
  await page.getByRole('button',{name:'한솔 공조 기출 회차 보기'}).click();
  const cards=page.locator('.round-card');
  await expect(cards).toHaveCount(27);
  await expect(page.locator('#round-card-hvac-hansol-2023-3')).toContainText('60문제');
  await page.getByRole('button',{name:'일반 공조 기출 회차 보기'}).click();
  await expect(page.locator('#round-card-hvac-20233')).toBeVisible();
});

test('2024년 1회 마지막 인쇄 ②가 이전 원문 선택 기록에 저장된다',async({page})=>{
  await page.goto('./');
  await page.getByRole('button',{name:'회차별 기출 고르기'}).click();
  await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
  const library=page.locator('.textbook-library');
  await library.locator('.library-books button').filter({hasText:'한솔 공조 교재'}).click();
  await library.getByRole('searchbox').fill('2024년 1회');
  await library.locator('.contents-results button').click();
  await library.getByRole('button',{name:'교재 회차 60문제 풀기',exact:true}).click();
  const jump=page.getByLabel('이동할 문제 번호');await jump.fill('60');await jump.press('Enter');
  const last=page.locator('#session-question-60');
  await expect(last).toBeVisible();
  await last.getByRole('button',{name:'이미지에서 2번 선택'}).click();
  await expect.poll(()=>page.evaluate(()=>{
    const record=JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}');
    return record.answers?.['hansol-direct-5-50-60'];
  })).toBe(2);
});

test('한솔 부록 1,440개 인쇄 정답과 417개 신규 스캔의 실제 보기 중심을 대조한다', () => {
  const sheets: Array<{page:string;start:number;answers:string;markers:Record<string,number[][]>}> =
    JSON.parse(readFileSync('tools/hansol-appendix-print-review.json','utf8'));
  const source:Catalog['rounds']=JSON.parse(readFileSync('data/hansol-appendix-rounds.json','utf8'));
  const all:Catalog['rounds']=[...source];
  for(const file of ['hvac','hvac-hansol','hvac-hansol-book']){
    const env={window:{} as Record<string,Catalog>};
    vm.runInNewContext(readFileSync('data/'+file+'.js','utf8'),env);
    for(const bank of Object.values(env.window))all.push(...bank.rounds);
  }
  const questions=new Map(all.flatMap(r=>r.questions.map(q=>[r.id+':'+q.number,q] as const)));
  const pages=new Map(sheets.map(p=>[p.page,p]));
  const nodes=bookContents.hansol.filter(n=>n.id==='hansol-mock'||n.id==='hansol-latest').flatMap(n=>n.children!);
  expect(nodes).toHaveLength(24);
  let targets=0;
  for(const node of nodes){
    const entries=contentsEntries(node,textbookEntries);
    expect(entries.map(e=>e.number),node.title).toEqual(Array.from({length:60},(_,i)=>i+1));
    for(const entry of entries){
      expect(entry.reviewHold).not.toBe(true);
      if (entry.page==='4-87' && entry.number===22) {
        expect(entry.sourceId).toBe('hvac-hansol-2024-2:39');
        expect(entry.correction?.text).toContain('0.93');
        expect(entry.correction?.answer).toBe(2);
        expect(entry.correction?.hotspots?.map(box=>box.choice)).toEqual([1,2,3,4]);
      }
      const question=questions.get(entry.sourceId!)!;
      const printed=pages.get(entry.page)!;
      expect(entry.correction?.answer??question.answer,entry.sourceId!).toBe(Number(printed.answers[entry.number-printed.start]));
      const centers=printed.markers[String(entry.number)];
      if(!centers)continue;
      const [w,h]=question.sourceImageSize!;
      expect(centers).toHaveLength(4);
      for(const [i,[x,y]] of centers.entries()){
        const hits=question.answerHotspots!.filter(b=>x/w*100>=b.x&&x/w*100<b.x+b.width&&y/h*100>=b.y&&y/h*100<b.y+b.height);
        expect(hits.map(h=>h.choice),entry.sourceId!).toEqual([i+1]);targets++;
      }
      for(const path of [question.sourceImage!,...question.explanationImages!])expect(readFileSync(problemImage(path)!).toString('ascii',8,12)).toBe('WEBP');
    }
  }
  expect(targets).toBe(417*4);
});

test('모의 7회 22번은 정정 조건을 먼저 읽고 이미지의 ②를 저장한다', async ({page})=>{
  await page.goto('./?safe=1');
  await page.getByRole('button',{name:'교재에서 풀기',exact:true}).click();
  const library=page.locator('.textbook-library');
  await library.locator('.library-books button').filter({hasText:'한솔 공조 교재'}).click();
  await library.getByRole('button',{name:'쪽번호로 바로 열기'}).click();
  const dialog=page.locator('dialog.library-page-dialog[open]');
  await dialog.locator('input').fill('4-87');
  await dialog.getByRole('button',{name:'문제 풀기'}).click();
  const card=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 22번',exact:true})});
  await expect(card.getByLabel('문제 조건 정정')).toContainText('0.93');
  await expect(card.getByRole('link',{name:/한솔 정오표/})).toHaveAttribute('href',/id=691/);
  const choice=card.getByRole('button',{name:'이미지에서 2번 선택',exact:true});
  await choice.click();
  await expect(choice).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem('unified-industrial-cbt-v1')||'{}');
    return state.attempts?.['book-study::hansol::4-87::22::hvac-hansol-2024-2:39'];
  })).toMatchObject({lastChoice:2,correctCount:1,wrongCount:0});
  await page.reload();
  await expect(choice).toHaveAttribute('aria-pressed','true');
});
