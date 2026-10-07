import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import vm from 'node:vm';
import type {Catalog} from '../src/cbt/types';

test('PDF73원문·84출처와 우선분류·중복 및 기존ID',()=>{
  const c={window:{} as Record<string,Catalog>};
  vm.runInNewContext(fs.readFileSync('data/energy-midterm.js','utf8'),c);
  const qs=c.window.CBT_DATA_ENERGY_MIDTERM.rounds.flatMap(r=>r.questions);
  expect(qs).toHaveLength(179);
  const images=qs.filter(q=>q.sourceImage);
  expect(images).toHaveLength(73);
  expect(images.reduce((n,q)=>n+(q.midtermPdfSources?.length||0),0)).toBe(84);
  expect(new Set(qs.map(q=>`${q._originRoundId}:${q._originalNumber}`)).size).toBe(179);
  expect(images.every(q=>q.imageOnly&&fs.existsSync(q.sourceImage!))).toBe(true);
  for(const [key,count] of Object.entries({repeat:35,recent:18,note:61,related:65}))
    expect(qs.filter(q=>q.midtermPriority===key)).toHaveLength(count);
  const ledger=JSON.parse(fs.readFileSync('data/energy-midterm-selection.json','utf8'));
  expect(ledger.pendingPdf).toEqual([]);
  const reviewed={
    '2021-1-77':3,'2021-2-60':3,'2021-2-62':2,'2022-1-6':3,
    '2022-1-24':2,'2022-4-17':2,'2022-4-49':3,'2022-4-74':3,
    '2023-2-52':2,'2023-2-63':4,'2024-1-25':2,'2025-1-23':4,
    '2025-3-13':1,'2025-3-53':1,
  };
  for(const [key,answer] of Object.entries(reviewed)){
    const entry=ledger.pdfSelections.find((r:{key:string})=>r.key===key);
    expect(entry.answer).toBe(answer);
    const question=qs.find(q=>`${q._originRoundId}:${q._originalNumber}`===entry.questionId);
    expect(question?.answer).toBe(answer);
    expect(fs.existsSync(entry.asset)).toBe(true);
  }
});

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('modern-cbt-qualification-industrial','energy-midterm');
    localStorage.setItem('unified-cbt-dynamic-ui','false');
    sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');
    sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');
  });
});

test('보완14이미지 로딩과 두단 연결 문제 답안·해설·화면 복원',async({page},info)=>{
  await page.goto('./?safe=1');
  const keys=['2021-1-77','2021-2-60','2021-2-62','2022-1-6','2022-1-24','2022-4-17','2022-4-49','2022-4-74','2023-2-52','2023-2-63','2024-1-25','2025-1-23','2025-3-13','2025-3-53'];
  const sizes=await page.evaluate(async(keys)=>Promise.all(keys.map(key=>new Promise<{key:string;width:number;height:number}>((resolve,reject)=>{
    const img=new Image();img.onload=()=>resolve({key,width:img.naturalWidth,height:img.naturalHeight});img.onerror=()=>reject(new Error(key));img.src=`assets/energy-midterm/questions/${key}.webp`;
  }))),keys);
  expect(sizes.every(r=>r.width>1000&&r.height>=360)).toBe(true);
  if((page.viewportSize()?.width||1440)<=900)await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
  await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();
  await page.locator('#round-card-school-energy-topic-18').getByRole('button',{name:'학습모드',exact:true}).click();
  const card=page.locator('.question-card').filter({has:page.locator('img[src$="2021-1-77.webp"]')});
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();
  const img=card.locator('.source-question-image');
  await expect.poll(()=>img.evaluate((el:HTMLImageElement)=>el.naturalHeight)).toBe(1074);
  await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});
  await expect.poll(()=>img.evaluate(el=>getComputedStyle(el).filter)).toContain('invert');
  await page.screenshot({path:`work/energy-pdf-manual-${info.project.name}-dark.png`});
  await page.evaluate(()=>{document.documentElement.dataset.theme='light';});
  await expect.poll(()=>img.evaluate(el=>getComputedStyle(el).filter)).toBe('none');
  await card.locator('.choice-button').nth(2).click();
  await expect(card).toContainText('응력이 집중');
  await expect(card.locator('.choice-button').nth(2)).toHaveClass(/selected/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`work/energy-pdf-manual-${info.project.name}-light.png`});
  await page.reload();
  await page.locator('.resume-learning-card').getByRole('button',{name:'이어서 풀기',exact:true}).click();
  await expect(card.locator('.choice-button').nth(2)).toHaveClass(/selected/);
});

test('분리 기본·통합 전환과 PDF 원문 다크/라이트·답안 복원',async({page},info)=>{
  await page.goto('./?safe=1');
  if((page.viewportSize()?.width||1440)<=900)await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
  await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();
  const intro=page.locator('.energy-midterm-intro');
  await expect(intro.getByRole('button',{name:'따로 풀기 · 기본',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.energy-midterm-priority-grid article')).toHaveCount(4);
  if((page.viewportSize()?.width||1440)<=900)
    await expect.poll(()=>page.locator('.sidebar').evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  await page.locator('.energy-midterm-mode').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  await page.screenshot({path:`work/energy-midterm-priority-${info.project.name}.png`});
  await intro.getByRole('button',{name:'함께 풀기',exact:true}).click();
  await expect(intro.getByRole('button',{name:'전체179문제 함께 학습',exact:true})).toBeVisible();
  await intro.getByRole('button',{name:'따로 풀기 · 기본',exact:true}).click();
  await intro.getByRole('button',{name:'교재·CBT 반복 예상 학습',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').itemIds?.length)).toBe(35);
  const card=page.locator('.question-card').first();const img=card.locator('.source-question-image');
  await expect(img).toBeVisible();
  await expect.poll(()=>img.evaluate((im:HTMLImageElement)=>im.naturalWidth)).toBeGreaterThan(1000);
  await expect(card.locator('.question-text')).toHaveCount(0);
  await expect(card.locator('.choice-button')).toHaveCount(4);
  await card.locator('.choice-button').nth(1).click();
  await expect(card.locator('.choice-button').nth(1)).toHaveClass(/selected/);
  await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});
  await expect.poll(()=>img.evaluate(el=>getComputedStyle(el).filter)).toContain('invert');
  await page.screenshot({path:`work/energy-pdf-${info.project.name}-dark.png`});
  await page.evaluate(()=>{document.documentElement.dataset.theme='light';});
  await expect.poll(()=>img.evaluate(el=>getComputedStyle(el).filter)).toBe('none');
  await page.screenshot({path:`work/energy-pdf-${info.project.name}-light.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.reload();
  await page.locator('.resume-learning-card').getByRole('button',{name:'이어서 풀기',exact:true}).click();
  await expect(card.locator('.choice-button').nth(1)).toHaveClass(/selected/);
});
