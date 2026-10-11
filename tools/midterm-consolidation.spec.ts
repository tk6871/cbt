import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { schoolItemKey, uniqueSchoolItems, coolingMidtermItems } from '../src/cbt/schoolQuestionBank';
import { questionId, subjectFor } from '../src/cbt/catalog';
import type { Catalog } from '../src/cbt/types';

const bank=()=>{const c={window:{} as Record<string,Catalog>};vm.runInNewContext(fs.readFileSync('data/energy-midterm.js','utf8'),c);return c.window.CBT_DATA_ENERGY_MIDTERM;};
test('에너지179원문·정답·ID 보존,25개 제외·최신 대표·계산22유지',()=>{
  const c={window:{} as Record<string,Catalog>};vm.runInNewContext(execFileSync('git',['show','2494f2cc:data/energy-midterm.js'],{encoding:'utf8',maxBuffer:3e6}),c);
  const qs=bank().rounds.flatMap(r=>r.questions),before=c.window.CBT_DATA_ENERGY_MIDTERM.rounds.flatMap(r=>r.questions);
  expect(qs).toHaveLength(179);
  expect(qs.filter(q=>!q.midtermDuplicateOf)).toHaveLength(154);
  expect(qs.filter(q=>q.midtermCalculation)).toHaveLength(22);
  for(let i=0;i<qs.length;i++){
    const {midtermDuplicateOf,midtermOccurrences,midtermLatestSource,...original}=qs[i];
    expect(original).toEqual(before[i]);
    if(midtermDuplicateOf){const rep=qs.find(q=>`${q._originRoundId}:${q._originalNumber}`===midtermDuplicateOf);expect(rep).toBeTruthy();expect(rep?.midtermDuplicateOf).toBeUndefined();expect(qs[i].midtermCalculation).toBe(false);}
  }
  const kept=qs.filter(q=>!q.midtermDuplicateOf);
  for(const number of [57,51])expect(kept.some(q=>q._originalNumber===number&&q.midtermCalculation)).toBe(true);
  const id=(q:typeof qs[number])=>`${q._originRoundId}:${q._originalNumber}`;
  expect(kept.some(q=>id(q)==='school-energy-energy-industrial-20170923:17')).toBe(true);
  expect(kept.find(q=>id(q)==='school-energy-energy-industrial-20170923:17')?.midtermOccurrences).toEqual(['2025년 3회','2023년 1회','2002년 4회']);
  expect(fs.readFileSync('data/energy.js','utf8')).toBe(execFileSync('git',['show','2494f2cc:data/energy.js'],{encoding:'utf8',maxBuffer:15e6}));
});

test('냉동 최신 대표·회차·계산 수치/단위/정답·그림 보존',()=>{
  const c={window:{} as Record<string,Catalog>};for(const key of ['hvac','hvac-hansol'])vm.runInNewContext(fs.readFileSync(`data/${key}.js`,'utf8'),c);
  const source=Object.values(c.window).flatMap(c=>c.rounds.flatMap(r=>r.questions.map(q=>({round:{...r,qualificationKey:c.key},question:q,id:questionId(r,q),subject:subjectFor(r,q)}))));
  const pool=coolingMidtermItems(source),snapshot=JSON.stringify(pool),unique=uniqueSchoolItems(pool);
  expect(unique).toHaveLength(983);
  for(const item of unique){
    const aliases=pool.filter(other=>schoolItemKey(other)===schoolItemKey(item));
    expect(item.round.year).toBe(Math.max(...aliases.map(a=>a.round.year)));
    if(aliases.length>1)expect(item.question.midtermOccurrences?.length).toBeGreaterThanOrEqual(1);
  }
  expect(JSON.stringify(pool)).toBe(snapshot);
  const one=pool.find(i=>schoolItemKey(i).includes('same-question-answer-v1'))!;
  for(const text of [`${one.question.text} 100 kPa`,`${one.question.text} 100 MPa`,`${one.question.text} 아닌 것은`])expect(schoolItemKey({...one,question:{...one.question,text}})).not.toBe(schoolItemKey(one));
  const changedAnswer={...one,question:{...one.question,answer:one.question.answer===1?2:1}};
  expect(schoolItemKey(changedAnswer)).not.toBe(schoolItemKey(one));
  expect(schoolItemKey({...one,question:{...one.question,images:['different-diagram.png']}})).not.toBe(schoolItemKey(one));
});

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('modern-cbt-qualification-industrial','energy-midterm');
    localStorage.setItem('unified-cbt-dynamic-ui','false');
    sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');
    sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');
  });
});
const saved=(page:import('@playwright/test').Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}'));
async function rounds(page:import('@playwright/test').Page){await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();await expect(page.locator('.energy-midterm-intro')).toBeVisible();}

test('기본2·6,계산만22원문 확인·기록불변·전체/랜덤·제외문항 이어풀기',async({page})=>{
  await page.goto('./?safe=1');await rounds(page);
  for(const n of [1,2,6,11,15]){
    const cb=page.locator(`#round-card-school-energy-topic-${n} input[type=checkbox]`);
    if([2,6].includes(n))await expect(cb).toBeChecked();else await expect(cb).not.toBeChecked();
  }
  const old=await saved(page);
  await page.getByText('계산 문제만 보기 · 전체22개',{exact:true}).click();
  await expect(page.locator('.energy-calculation-review-item')).toHaveCount(22);
  await page.locator('.energy-calculation-review-item > summary').first().click();
  await expect(page.locator('.energy-calculation-review .question-card').first()).toBeVisible();
  const image=page.locator('.energy-calculation-review .question-card').first().locator('img.source-question-image');
  await expect.poll(()=>image.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
  await image.evaluate((el:HTMLImageElement)=>el.decode());
  expect(await saved(page)).toEqual(old);
  await page.screenshot({path:'/private/tmp/cbt-midterm-calculation-review-585.png'});
  await page.getByRole('button',{name:'랜덤20문제 학습',exact:true}).click();
  await expect.poll(async()=> (await saved(page)).itemIds?.length).toBe(20);
  const session=await saved(page),b=bank();
  const selected=b.rounds.flatMap((r,i)=>r.questions.map(q=>({q,topic:i+1}))).filter(({q})=>session.itemIds.includes(`${q._originRoundId}:${q._originalNumber}`));
  expect(selected.filter(i=>i.q.midtermCalculation).map(i=>i.topic).sort((a,b)=>a-b)).toEqual([2,6]);
  expect(selected.some(i=>i.q.midtermDuplicateOf)).toBe(false);
  await page.locator('.session-topbar .back-button').click();
  await page.locator('.energy-midterm-other-actions > summary').click();
  await page.getByRole('button',{name:'전체149문제 학습',exact:true}).click();
  await expect.poll(async()=> (await saved(page)).itemIds?.length).toBe(149);
  // A retired ID in an old saved session must still restore its original answer.
  const q=b.rounds.flatMap(r=>r.questions).find(q=>q.midtermDuplicateOf)!;
  const id=`${q._originRoundId}:${q._originalNumber}`;
  await page.locator('.session-topbar .back-button').click();
  const seed={...await saved(page),itemIds:[id],answers:{[id]:q.answer},page:0};
  // Seed both real storage copies after unload; pagehide flushes the old store.
  await page.addInitScript(seed=>{
    seed.savedAt=Date.now();localStorage.setItem('unified-cbt-learning-session-industrial',JSON.stringify(seed));
    const k='unified-industrial-cbt-v1',store=JSON.parse(localStorage.getItem(k)||'{}');
    store.progress||={};store.progress.activeLearningSessionV1=seed;localStorage.setItem(k,JSON.stringify(store));
  },seed);
  await page.reload();await expect(page.locator('.resume-learning-card')).toBeVisible();
  await page.locator('.resume-learning-card').getByRole('button',{name:'이어서 풀기',exact:true}).click();
  await expect.poll(async()=> (await saved(page)).itemIds).toEqual([id]);
  await expect(page.locator('.question-card .choice-button.selected')).toHaveCount(1);
  expect((await saved(page)).answers[id]).toBe(q.answer);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('냉동 대표 문제의 나왔던 회차는 이어풀기에서도 표시',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('modern-cbt-qualification-industrial','school-exams');
    const id='school-cooling::hvac-20110821:29';
    const seed={id:'old-cooling-test',version:1,qualificationKey:'school-exams',mode:'learn',title:'냉동공학 중간고사 · 이전 풀이',itemIds:[id],answers:{},kept:[],page:0,pageSize:4,startedAt:Date.now(),savedAt:Date.now(),remainingSeconds:1800};
    localStorage.setItem('unified-cbt-learning-session-industrial',JSON.stringify(seed));
    localStorage.setItem('unified-industrial-cbt-v1',JSON.stringify({attempts:{},wrong:{},bookmarks:[],notes:{},progress:{activeLearningSessionV1:seed}}));
  });
  await page.goto('./?safe=1');
  await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();
  await page.locator('.resume-learning-card').getByRole('button',{name:'이어서 풀기',exact:true}).click();
  await expect(page.locator('.energy-occurrences')).toBeVisible();
  await page.locator('.energy-occurrences summary').click();
  await expect(page.locator('.energy-occurrences')).toContainText('2011.08.21');
  await expect(page.locator('.energy-occurrences')).toContainText('2006.08.16');
  await page.screenshot({path:'/private/tmp/cbt-cooling-occurrences-585.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
