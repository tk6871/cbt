import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { unifiedAnswerHotspots } from '../src/cbt/answerHotspotGeometry';
import type { AnswerHotspot } from '../src/cbt/types';
test.use({ serviceWorkers:'block' });
const boxes=JSON.parse(fs.readFileSync('data/energy-textbook-hotspots.json','utf8')) as Record<string,AnswerHotspot[]>;
test('교재191장·764영역·원문해시·한 박스·인접 침범 없음',()=>{
 const review=JSON.parse(fs.readFileSync('data/energy-textbook-hotspot-review.json','utf8'));
 expect(Object.keys(boxes)).toHaveLength(191);expect(review.images).toHaveLength(191);
 for(const row of review.images)expect(crypto.createHash('sha256').update(fs.readFileSync(row.asset)).digest('hex')).toBe(row.sha256);
 for(const [asset,source] of Object.entries(boxes)){
  expect(source.map(b=>b.choice)).toEqual([1,2,3,4]);const bs=unifiedAnswerHotspots(source);
  for(const b of bs){expect(b.segments).toHaveLength(1);expect(b.width).toBeGreaterThan(0);expect(b.height).toBeGreaterThan(0);expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(100.01);expect(b.y+b.height).toBeLessThanOrEqual(100.01);}
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
   const a=bs[i],b=bs[j],w=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x),h=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);
   expect(Math.max(0,w)*Math.max(0,h),asset+':'+a.choice+'/'+b.choice).toBeLessThan(.01);
  }
 }
 const multiline=boxes['assets/energy-textbook/questions/2021-1-1.webp'];expect(multiline[2].height).toBeGreaterThan(multiline[0].height*1.5);
 const fraction=boxes['assets/energy-textbook/questions/2022-1-12.webp'];expect(fraction[0].y).toBeLessThan(50);expect(fraction[0].y+fraction[0].height).toBeGreaterThan(64);
});
test('교재191장 실제 hover·선택·박스 일치·취소764개',async({page})=>{
 test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/work/energy-textbook/answer-geometry/harness.html');
 await page.waitForFunction(()=>Boolean((window as any).review));
 expect(await page.evaluate(()=>(window as any).review.items.length)).toBe(191);
 for(let i=0;i<191;i++){
  await page.evaluate(async i=>{window.scrollTo({top:0,behavior:'instant'});await (window as any).review.show(i);},i);
  const img=page.locator('.source-question-image');await expect.poll(()=>img.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);await img.evaluate((el:HTMLImageElement)=>el.decode());
  const buttons=page.locator('.image-answer-hotspot');await expect(buttons).toHaveCount(4);
  for(let choice=0;choice<4;choice++){
   const button=buttons.nth(choice);await button.hover();
   const style=await button.getAttribute('style');await button.click();await expect(button).toHaveClass(/selected/);
   await expect(page.locator('.image-answer-area-highlight')).toHaveAttribute('style',style!);
   expect(await button.evaluate(el=>getComputedStyle(el).borderTopColor)).not.toBe('rgba(0, 0, 0, 0)');
   await button.click();await expect(page.locator('.image-answer-area-highlight')).toHaveCount(0);
  }
 }
 expect(errors).toEqual([]);
});
test('좁은 화면·태블릿: 여러 줄·분수·2열 보기와 마커·다크 표시',async({page})=>{
 await page.goto('/work/energy-textbook/answer-geometry/harness.html');await page.waitForFunction(()=>Boolean((window as any).review));
 const keys=['2021-1-1','2022-1-12','2024-1-63'];
 for(const width of [393,820]){
  await page.setViewportSize({width,height:1000});
  for(const key of keys){
   await page.evaluate(async key=>{const r=(window as any).review;await r.show(r.items.findIndex((i:any)=>i.question.sourceImage.endsWith('/'+key+'.webp')));},key);
   await page.locator('.source-question-image').evaluate((el:HTMLImageElement)=>el.decode());
   for(let choice=0;choice<4;choice++){
    const b=page.locator('.image-answer-hotspot').nth(choice);await b.click();await expect(b).toHaveClass(/selected/);await b.click();
   }
   await page.evaluate(async key=>{const r=(window as any).review;await r.show(r.items.findIndex((i:any)=>i.question.sourceImage.endsWith('/'+key+'.webp')),'marker');document.documentElement.dataset.theme='dark';},key);
   await page.locator('.image-answer-hotspot').nth(2).click();await expect(page.locator('.image-answer-pick-marker')).toBeVisible();
   await expect.poll(()=>page.locator('.source-question-image').evaluate(el=>getComputedStyle(el).filter)).toContain('invert');
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
 }
 await page.screenshot({path:'work/energy-textbook/answer-geometry/verified-tablet.png',fullPage:true});
});
