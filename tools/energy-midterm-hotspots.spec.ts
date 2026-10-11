import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import vm from 'node:vm';
import {unifiedAnswerHotspots} from '../src/cbt/answerHotspotGeometry';
import type {AnswerHotspot} from '../src/cbt/types';
const boxes=JSON.parse(fs.readFileSync('data/energy-midterm-hotspots.json','utf8')) as Record<string,AnswerHotspot[]>;

test('73이미지 292영역: 범위·인접 침범·단일 박스 및 기존 데이터 보존',()=>{
 const c={window:{} as any};vm.runInNewContext(fs.readFileSync('data/energy-midterm.js','utf8'),c);
 const qs=c.window.CBT_DATA_ENERGY_MIDTERM.rounds.flatMap((r:any)=>r.questions);
 expect(qs).toHaveLength(179);expect(Object.keys(boxes)).toHaveLength(73);
 expect(qs.filter((q:any)=>q.sourceImage)).toHaveLength(73);
 for(const [asset,original] of Object.entries(boxes)){
  expect(fs.existsSync(asset)).toBe(true);expect(original.map(b=>b.choice)).toEqual([1,2,3,4]);
  const bs=unifiedAnswerHotspots(original);
  for(const b of bs){expect(b.width).toBeGreaterThan(0);expect(b.height).toBeGreaterThan(0);expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(100.01);expect(b.y+b.height).toBeLessThanOrEqual(100.01);expect(b.segments).toHaveLength(1);}
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
   const a=bs[i],b=bs[j];const w=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x),h=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);
   expect(Math.max(0,w)*Math.max(0,h),asset+':'+a.choice+'/'+b.choice).toBeLessThan(.01);
  }
 }
 const multiline=boxes['assets/energy-midterm/questions/2021-1-1.webp'];expect(multiline[2].height).toBeGreaterThan(multiline[0].height*1.5);
 const fraction=boxes['assets/energy-midterm/questions/2024-1-59.webp'];expect(fraction[0].y).toBeLessThan(48);expect(fraction[0].y+fraction[0].height).toBeGreaterThan(65);
});

test('73이미지 실제 hover·클릭·선택 박스·취소·마커 292개',async({page},info)=>{
 test.skip(process.env.CBT_GEOMETRY_DEV!=='1','Vue 원본 검수용 Vite 서버에서 실행');test.setTimeout(240000);
 await page.goto('/work/energy-answer-geometry/harness.html');
 await page.waitForFunction(()=>Boolean((window as any).review));
 const count=await page.evaluate(()=>(window as any).review.items.length);expect(count).toBe(73);
 for(let i=0;i<count;i++){
  await page.evaluate(i=>(window as any).review.show(i),i);
  // Wait for each actual image, not just Vue's nextTick: lazy decoding can still reflow the stage.
  await expect.poll(()=>page.locator('.source-question-image').evaluate((image:HTMLImageElement)=>image.complete&&image.naturalHeight>0)).toBe(true);
  await page.locator('.source-question-image').evaluate((image:HTMLImageElement)=>image.decode());
  const buttons=page.locator('.image-answer-hotspot');await expect(buttons).toHaveCount(4);
  for(let choice=0;choice<4;choice++){
   const b=buttons.nth(choice);await b.hover();
   const before=await b.getAttribute('style');await b.click();await expect(b).toHaveClass(/selected/);
   await expect(page.locator('.image-answer-area-highlight')).toHaveAttribute('style',before!);
   const r=await b.boundingBox();expect(r?.width).toBeGreaterThan(2);expect(r?.height).toBeGreaterThan(2);
   await b.click();await expect(page.locator('.image-answer-area-highlight')).toHaveCount(0);
  }
 }
 await page.evaluate(()=>(window as any).review.show(0,'marker'));await page.locator('.image-answer-hotspot').nth(2).click();await expect(page.locator('.image-answer-pick-marker')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'work/energy-answer-geometry/verified-'+info.project.name+'.png'});
});

for(const mode of ['학습','CBT'])test(`실제 중간고사 ${mode}: 기존 설정·직접선택 전환·이어풀기`,async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('modern-cbt-qualification-industrial','energy-midterm');
  localStorage.setItem('unified-cbt-dynamic-ui','false');
  sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');
  sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');
 });
 await page.goto('./?safe=1');
 if((page.viewportSize()?.width||1440)<=900)await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
 await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();
 await page.locator('.energy-midterm-subgroups > summary').click();
 await page.getByRole('button',{name:`교재·CBT 반복 예상 ${mode}`,exact:true}).click();
 const card=page.locator('.question-card').first();
 await expect(card.locator('.choice-button')).toHaveCount(4);
 await expect(card.locator('.image-answer-hotspot')).toHaveCount(0);
 await page.evaluate(()=>localStorage.setItem('unified-cbt-answer-layout','hotspot'));
 await page.reload();
 await page.locator('.resume-learning-card').getByRole('button',{name:'이어서 풀기',exact:true}).click();
 const buttons=card.locator('.image-answer-hotspot');await expect(buttons).toHaveCount(4);
 await buttons.nth(2).click();await expect(buttons.nth(2)).toHaveClass(/selected/);
 await expect(card.locator('.image-answer-pick-marker')).toBeVisible();
 await buttons.nth(2).click();await expect(card.locator('.image-answer-pick-marker')).toHaveCount(0);
 await buttons.nth(1).click();
 await page.reload();await page.locator('.resume-learning-card').getByRole('button',{name:'이어서 풀기',exact:true}).click();
 await expect(card.locator('.image-answer-hotspot').nth(1)).toHaveClass(/selected/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
