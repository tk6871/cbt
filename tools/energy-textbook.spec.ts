import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { energySourceRounds, energyQuestionKey } from '../src/cbt/energyTextbook';
import { energyMidtermPractice } from '../src/cbt/energyMidtermPractice';
import type { Catalog } from '../src/cbt/types';
test.use({serviceWorkers:'block'});
function banks(){const c={window:{} as Record<string,Catalog>};for(const f of ['energy-midterm','energy-textbook'])vm.runInNewContext(fs.readFileSync(`data/${f}.js`,'utf8'),c);return {old:c.window.CBT_DATA_ENERGY_MIDTERM,book:c.window.CBT_DATA_ENERGY_TEXTBOOK};}
test('교재140/기존CBT154·기본131/139·반복51·원본179 불변',()=>{
 const {old,book}=banks();const review=JSON.parse(fs.readFileSync('data/energy-textbook-review.json','utf8'));
 expect(crypto.createHash('sha256').update(fs.readFileSync('data/energy-midterm.js')).digest('hex')).toBe(review.legacyBankSha256);
 expect(old.rounds.flatMap(r=>r.questions)).toHaveLength(179);expect(book.rounds.flatMap(r=>r.questions)).toHaveLength(191);
 const rounds=old.rounds.map(r=>({...r,questions:[...r.questions,...book.rounds.find(b=>b.id===r.id)!.questions]}));
 for(const [mode,total,eligible] of [['textbook',140,131],['combined',154,139]] as const){
  const selected=energySourceRounds(rounds,mode);expect(selected.flatMap(r=>r.questions)).toHaveLength(total);
  const pools=selected.map((r,i)=>r.questions.filter(q=>!q.midtermCalculation||[5,10].includes(i)).map(q=>({q,topic:i+1})));
  expect(pools.flat()).toHaveLength(eligible);
  for(let n=0;n<30;n++){
   const draw=energyMidtermPractice(pools,Math.random,{isCalculation:i=>!!i.q.midtermCalculation,calculationTopics:[6,11]});
   expect(new Set(draw.map(i=>i.topic)).size).toBe(20);expect(draw.filter(i=>i.q.midtermCalculation).map(i=>i.topic).sort((a,b)=>a-b)).toEqual([6,11]);
  }
  if(mode==='combined') {
   expect(selected.flatMap(r=>r.questions)).toEqual(old.rounds.flatMap(r=>r.questions.filter(q=>!q.midtermDuplicateOf)));
  } else expect(selected.flatMap(r=>r.questions).every(q=>q.midtermTextbook)).toBe(true);
 }
 expect(review.consolidated).toBe(51);expect(review.duplicateGroups).toBe(35);
});
test('382 원문·해설 이미지의2배 치수·해시·arm64 타일256',()=>{
 const {book}=banks();const ledger=JSON.parse(fs.readFileSync('data/energy-textbook-images.json','utf8')).images;
 expect(Object.keys(ledger)).toHaveLength(382);
 for(const q of book.rounds.flatMap(r=>r.questions)){
  expect(q.imageOnly&&q.midtermTextbook).toBe(true);expect(q.choices).toHaveLength(4);expect(q.answer).toBeGreaterThanOrEqual(1);expect(q.answer).toBeLessThanOrEqual(4);
  expect(q.explanationImages).toHaveLength(1);expect(q.explanationProvenance).toBe('printed-textbook-explanation-image');
 }
 for(const im of Object.values(ledger) as any[]){expect(im.native).toBe('arm64');expect(im.tile).toBe(256);expect(im.outputSize).toEqual(im.sourceSize.map((n:number)=>n*2));expect(crypto.createHash('sha256').update(fs.readFileSync(im.asset)).digest('hex')).toBe(im.outputSha256);}
});
test.beforeEach(async({page})=>{
 page.on('dialog',dialog=>dialog.accept());
 await page.addInitScript(()=>{
  localStorage.setItem('modern-cbt-qualification-industrial','energy-midterm');localStorage.setItem('unified-cbt-dynamic-ui','false');
  sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');
 });
});
async function rounds(page:Page){if((page.viewportSize()?.width||1440)<=900)await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();await expect(page.locator('.energy-source-picker')).toBeVisible();if((page.viewportSize()?.width||1440)<=900)await expect.poll(()=>page.locator('.sidebar').evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);}
const saved=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}'));
test('실제 교재/통합 출처·랜덤20·주제 풀이·원문 해설·다크/라이트·선택 기억',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('./?safe=1');await rounds(page);
 await expect(page.getByRole('radio',{name:'에너지 교재 문제',exact:true})).toBeChecked();
 await expect(page.locator('.energy-midterm-intro')).toContainText('현재 출처 140문제');
 await page.screenshot({path:`/private/tmp/energy-textbook-${info.project.name}-picker.png`});
 await page.locator('.energy-midterm-other-actions > summary').click();
 await page.getByRole('button',{name:'전체131문제 학습',exact:true}).click();
 await expect.poll(async()=> (await saved(page)).itemIds?.length).toBe(131);
 await page.locator('.session-topbar .back-button').click();
 await page.getByRole('button',{name:'랜덤20문제 학습',exact:true}).click();
 await expect.poll(async()=> (await saved(page)).itemIds?.length).toBe(20);
 expect((await saved(page)).itemIds.every((id:string)=>id.startsWith('school-energy-textbook-'))).toBe(true);
 await page.locator('.session-topbar .back-button').click();
 await page.locator('#round-card-school-energy-topic-9').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
 await page.locator('#round-card-school-energy-topic-9').getByRole('button',{name:'학습모드',exact:true}).click();
 const card=page.locator('.question-card').first(),img=card.locator('.source-question-image');
 await expect.poll(()=>img.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>300)).toBe(true);
 await card.locator('.choice-button').nth(2).click();
 const explanation=card.locator('.textbook-explanation-image img');await expect(explanation).toBeVisible();
 await expect.poll(()=>explanation.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>300)).toBe(true);
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');
 for(const image of [img,explanation])await expect.poll(()=>image.evaluate(el=>getComputedStyle(el).filter)).toContain('invert');
 await page.evaluate(()=>document.documentElement.dataset.resizing='true');
 await expect.poll(()=>explanation.evaluate(el=>getComputedStyle(el).filter)).toContain('invert');
 await page.evaluate(()=>delete document.documentElement.dataset.resizing);
 await page.screenshot({path:`/private/tmp/energy-textbook-${info.project.name}-dark.png`,fullPage:true});
 await page.evaluate(()=>document.documentElement.dataset.theme='light');
 for(const image of [img,explanation])await expect.poll(()=>image.evaluate(el=>getComputedStyle(el).filter)).toBe('none');
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');
 await img.evaluate(el=>el.className='source-question-image restored-image-original');
 await explanation.evaluate(el=>el.className='restored-image-original');
 for(const image of [img,explanation])await expect.poll(()=>image.evaluate(el=>getComputedStyle(el).filter)).toBe('none');
 await page.evaluate(()=>document.documentElement.dataset.theme='light');
 await page.screenshot({path:`/private/tmp/energy-textbook-${info.project.name}-light.png`,fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.session-topbar .back-button').click();
 await page.getByRole('radio',{name:'CBT + 에너지 교재',exact:true}).check();await expect(page.locator('.energy-midterm-intro')).toContainText('현재 출처 154문제');
 await page.reload();await expect(page.getByRole('radio',{name:'CBT + 에너지 교재',exact:true})).toBeChecked();
 await page.locator('.energy-midterm-other-actions > summary').click();
 await page.getByRole('button',{name:'전체139문제 학습',exact:true}).click();
 await expect.poll(async()=> (await saved(page)).itemIds?.length).toBe(139);
 await page.locator('.session-topbar .back-button').click();
 await page.getByRole('button',{name:'랜덤20문제 CBT',exact:true}).click();await expect.poll(async()=> (await saved(page)).mode).toBe('exam');
 await expect.poll(async()=> (await saved(page)).itemIds?.length).toBe(20);
 expect((await saved(page)).itemIds.every((id:string)=>!id.startsWith('school-energy-textbook-'))).toBe(true);expect(errors).toEqual([]);
});
test('교재 기본에서도 과거179문항의 이어풀기 ID와 답안 복원',async({page})=>{
 const q=banks().old.rounds.flatMap(r=>r.questions).find(q=>q.midtermDuplicateOf)!;const id=energyQuestionKey(q);
 await page.addInitScript(({id,answer})=>{
  const seed={id:'legacy-energy-restore',version:1,qualificationKey:'energy-midterm',mode:'learn',title:'이전 에너지 학습',itemIds:[id],answers:{[id]:answer},kept:[],page:0,pageSize:4,startedAt:Date.now(),savedAt:Date.now(),remainingSeconds:1800};
  localStorage.setItem('unified-cbt-learning-session-industrial',JSON.stringify(seed));localStorage.setItem('unified-industrial-cbt-v1',JSON.stringify({attempts:{},wrong:{},bookmarks:[],notes:{},progress:{activeLearningSessionV1:seed}}));
 },{id,answer:q.answer});await page.goto('./?safe=1');await rounds(page);
 await page.locator('.resume-learning-card').getByRole('button',{name:'이어서 풀기',exact:true}).click();
 await expect.poll(async()=> (await saved(page)).itemIds).toEqual([id]);expect((await saved(page)).answers[id]).toBe(q.answer);
 await expect(page.locator('.choice-button.selected')).toHaveCount(1);
});
for(const mode of ['학습모드','CBT 시험모드'] as const)test(`배포본 교재 ${mode}: 이미지 직접선택·취소·새로고침 복원`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('unified-cbt-answer-layout','hotspot'));
 await page.goto('./?safe=1');await rounds(page);
 const round=page.locator('#round-card-school-energy-topic-1');
 await round.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
 await round.getByRole('button',{name:mode,exact:true}).click();
 const card=page.locator('.question-card').first(),buttons=card.locator('.image-answer-hotspot');
 await expect(buttons).toHaveCount(4);await buttons.nth(2).click();await expect(buttons.nth(2)).toHaveClass(/selected/);
 await expect(card.locator('.image-answer-pick-marker')).toBeVisible();
 await buttons.nth(2).click();await expect(card.locator('.image-answer-pick-marker')).toHaveCount(0);
 await buttons.nth(1).click();
 await expect.poll(async()=>Object.values((await saved(page)).answers||{})).toContain(2);
 const snapshot=await saved(page);
 expect(snapshot.itemIds.every((id:string)=>id.startsWith('school-energy-textbook-'))).toBe(true);
 await page.reload();await page.locator('.resume-learning-card').getByRole('button',{name:'이어서 풀기',exact:true}).click();
 await expect(card.locator('.image-answer-hotspot').nth(1)).toHaveClass(/selected/);
 expect((await saved(page)).answers).toEqual(snapshot.answers);
});
