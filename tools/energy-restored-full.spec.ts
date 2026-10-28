import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import type { Catalog } from '../src/cbt/types';
test.use({ serviceWorkers: 'block' });
const sha=(p:string)=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function banks(){
 const context={window:{} as Record<string,Catalog>};
 for(const file of ['energy','energy-restored','energy-midterm','energy-textbook'])vm.runInNewContext(fs.readFileSync(`data/${file}.js`,'utf8'),context);
 return context.window;
}
test('산업기사13회차1040·기존33회차2640·중간고사 불변·정답/이미지/좌표',()=>{
 const w=banks(),old=w.CBT_DATA_ENERGY,bank=w.CBT_DATA_ENERGY_RESTORED;
 const audit=JSON.parse(fs.readFileSync('data/energy-restored-import-audit.json','utf8'));
 expect(old.rounds).toHaveLength(33);expect(old.rounds.flatMap(r=>r.questions)).toHaveLength(2640);
 expect(bank.rounds).toHaveLength(13);expect(bank.rounds.flatMap(r=>r.questions)).toHaveLength(1040);
 expect(new Set([...old.rounds,...bank.rounds].map(r=>r.id)).size).toBe(46);
 expect(w.CBT_DATA_ENERGY_MIDTERM.rounds.flatMap(r=>r.questions)).toHaveLength(179);
 expect(w.CBT_DATA_ENERGY_TEXTBOOK.rounds.flatMap(r=>r.questions)).toHaveLength(191);
 for(const [key,value] of Object.entries(audit.preservedBanks))expect(sha(`data/${key}.js`)).toBe(value);
 for(const r of bank.rounds){
  expect(r.questions.map(q=>q.number)).toEqual(Array.from({length:80},(_,i)=>i+1));
  expect(r.subjects).toEqual(old.rounds[0].subjects);
  for(const q of r.questions){
   expect(q.imageOnly).toBe(true);expect(q.choices).toHaveLength(4);
   expect(q.answer).toBeGreaterThanOrEqual(1);expect(q.answer).toBeLessThanOrEqual(4);
   expect(fs.existsSync(q.sourceImage!)).toBe(true);
   expect(q.explanationImages?.length||q.explanation?.length).toBeGreaterThan(0);
   for(const p of q.explanationImages||[])expect(fs.existsSync(p)).toBe(true);
   const bs=q.answerHotspots||[];expect([0,4]).toContain(bs.length);
   if(bs.length)expect(bs.map(b=>b.choice)).toEqual([1,2,3,4]);
   for(const b of bs){expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.width).toBeGreaterThan(0);expect(b.height).toBeGreaterThan(0);expect(b.x+b.width).toBeLessThanOrEqual(100.01);expect(b.y+b.height).toBeLessThanOrEqual(100.01);}
   for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){
    const a=bs[i],b=bs[j];const width=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x),height=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);
    expect(Math.max(0,width)*Math.max(0,height),`${r.id}:${q.number}:${i}/${j}`).toBeLessThan(.02);
   }
  }
 }
 for(const row of Object.values(audit.images) as any[]){
  expect(row.native).toBe('arm64');expect(row.tile).toBe(256);
  expect(row.outputSize).toEqual(row.sourceSize.map((n:number)=>n*2));expect(sha(row.asset)).toBe(row.outputSha256);
 }
 expect(fs.readFileSync('data/catalog-bootstrap.js','utf8')).not.toContain('energy-engineer.js');
});

async function rounds(page:Page){
 const later=page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true});
 if(await later.isVisible())await later.click();
 if((page.viewportSize()?.width||1440)<=900)await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
 await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();
}
test.beforeEach(async({page})=>{
 page.on('dialog',d=>d.accept());
 await page.addLocatorHandler(page.locator('.pwa-error-notice'),async()=>{
  await page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click();
 });
 await page.addInitScript(()=>{
  localStorage.setItem('modern-cbt-qualification-industrial','energy');
  localStorage.setItem('unified-cbt-dynamic-ui','false');
  localStorage.setItem('unified-cbt-answer-layout','hotspot');
  sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');
  sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');
 });
});
test('새 회차 목록·이미지 선택/취소·해설·다크/라이트·저장 복원',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 await page.goto('./?safe=1');await rounds(page);
 const round=page.locator('#round-card-energy-industrial-restored-2025-3');
 await expect(round).toBeVisible();await expect(round).toContainText('80문제');
 await page.screenshot({path:`/private/tmp/energy-restored-${info.project.name}-rounds.png`});
 await round.getByRole('button',{name:'학습모드',exact:true}).click();
 const card=page.locator('.question-card').first();const img=card.locator('.source-question-image');
 await expect.poll(()=>img.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>600)).toBe(true);
 const buttons=card.locator('.image-answer-hotspot');
 await expect(buttons).toHaveCount(4);
 await buttons.nth(2).click();await expect(buttons.nth(2)).toHaveClass(/selected/);
 const explanation=card.locator('.textbook-explanation-image img').first();await expect(explanation).toBeVisible();
 await expect.poll(()=>explanation.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');
 for(const image of [img,explanation])await expect.poll(()=>image.evaluate(el=>getComputedStyle(el).filter)).toContain('invert');
 await page.screenshot({path:`/private/tmp/energy-restored-${info.project.name}-dark.png`,fullPage:true});
 await page.evaluate(()=>document.documentElement.dataset.theme='light');
 for(const image of [img,explanation])await expect.poll(()=>image.evaluate(el=>getComputedStyle(el).filter)).toBe('none');
 await buttons.nth(2).click();await expect(card.locator('.image-answer-pick-marker')).toHaveCount(0);
 await buttons.nth(1).click();await expect(buttons.nth(1)).toHaveClass(/selected/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}'));
 await expect.poll(async()=>(await saved()).answers?.['energy-industrial-restored-2025-3:1']).toBe(2);
 const snapshot=await saved();expect(snapshot.itemIds).toHaveLength(80);
 await page.reload();await page.locator('#round-card-energy-industrial-restored-2025-3').getByRole('button',{name:'이어 학습',exact:true}).click();
 await expect(page.locator('.question-card').first().locator('.image-answer-hotspot').nth(1)).toHaveClass(/selected/);
 expect((await saved()).answers).toEqual(snapshot.answers);
 expect(requests.some(p=>p.includes('energy-engineer.js'))).toBe(false);expect(errors).toEqual([]);
});

test('새 회차 CBT에서 선택·취소와 제출 전 정답 비노출',async({page})=>{
 await page.goto('./?safe=1');await rounds(page);
 await page.locator('#round-card-energy-industrial-restored-2025-3').getByRole('button',{name:'CBT 시험모드',exact:true}).click();
 const card=page.locator('.question-card').first();
 const buttons=card.locator('.image-answer-hotspot');await expect(buttons).toHaveCount(4);
 await buttons.nth(2).click();await expect(buttons.nth(2)).toHaveClass(/selected/);
 await expect(card.locator('.textbook-explanation-image img')).toHaveCount(0);
 await buttons.nth(2).click();await expect(buttons.nth(2)).not.toHaveClass(/selected/);
});
