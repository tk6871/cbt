import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
execFileSync('node_modules/.bin/esbuild',['src/cbt/hvacPracticalRestored.ts','--bundle','--platform=node','--format=cjs','--outfile=/private/tmp/cbt-remaining-adapter.cjs']);
const prompts=createRequire(import.meta.url)('/private/tmp/cbt-remaining-adapter.cjs').hvacPracticalRestored as any[];
const rows=JSON.parse(fs.readFileSync('data/hvac-practical-restored.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('data/hvac-practical-remaining-video-crops.json','utf8'));
test('90개 사진의 원본 좌표·해시·역할과102문항 적용 이력 보존',()=>{
 expect(manifest.crops).toHaveLength(90);
 const history=JSON.parse(fs.readFileSync('data/hvac-practical-remaining-review-history.json','utf8'));
 expect(history.changes).toHaveLength(102);
 for(const change of history.changes){
  expect(rows.find((r:any)=>r.id===change.id)).toEqual(change.updated);
  for(const key of ['id','year','session','number','bookNumber','category','difficulty','points'])expect(change.updated[key]).toEqual(change.previous[key]);
  for(const file of [...(change.previous.images||[]),...(change.previous.answerImages||[])])expect(fs.existsSync(file)).toBe(true);
 }
 for(const crop of manifest.crops){
  expect(crypto.createHash('sha256').update(fs.readFileSync(crop.output)).digest('hex')).toBe(crop.sha256);
  expect(crop.crop[2]-crop.crop[0]).toBe(crop.outputSize[0]);
  expect(crop.crop[3]-crop.crop[1]).toBe(crop.outputSize[1]);
  const row=rows.find((r:any)=>r.id===crop.id);
  expect(row[crop.role==='answer'?'answerImages':'images']).toContain(crop.output);
  if(crop.role==='answer')expect(row.images||[]).not.toContain(crop.output);
 }
 const old=JSON.parse(execFileSync('git',['show','4eeb5150:data/hvac-practical-restored.json'],{encoding:'utf8'}));
 expect(rows.map((r:any)=>r.id)).toEqual(old.map((r:any)=>r.id));
 expect(rows.filter((r:any)=>r.year===2026)).toEqual(old.filter((r:any)=>r.year===2026));
 const choices=JSON.parse(fs.readFileSync('docs/hvac-practical-missing-visuals-2026-10-06.json','utf8')).choiceOnlyAnswers;
 for(const c of choices)expect(rows.find((r:any)=>r.id===c.id).answer.length).toBeGreaterThan(10);
 expect(prompts.filter(p=>p.sourceUrl)).toHaveLength(192);
 for(const source of JSON.parse(fs.readFileSync('data/hvac-practical-public-video-sources.json','utf8')).sources){
  for(const chapter of source.chapters){
   expect(prompts.find(p=>p.id===`hvac-practical-restored-${source.year}-${source.session}-${String(chapter.number).padStart(2,'0')}`).sourceUrl).toBe(`${source.url}&t=${chapter.startSeconds}s`);
  }
 }
});

test('9회차 사진·답안 전용·동작 영상 링크 실제 표시와 새로고침 기록 보존',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./?safe=1');
 const later=page.getByRole('button',{name:'나중에',exact:true});if(await later.isVisible())await later.click();
 await page.getByRole('button',{name:'패치노트 보기'}).click();
 await page.getByRole('button',{name:/신기술 학습관/}).click();
 await page.getByRole('button',{name:/필답형 훈련관 열기/}).click();
 await page.addStyleTag({content:'html,*{scroll-behavior:auto!important}'});
 for(const [yearNumber,session] of [[2018,'3'],[2019,'1'],[2019,'2'],[2019,'3'],[2020,'1'],[2020,'2A'],[2020,'2B'],[2020,'3'],[2020,'4']] as const){
  const year=page.locator('.practical-year-group').filter({has:page.getByRole('heading',{name:`${yearNumber}년`,exact:true})});
  await year.getByRole('button',{name:new RegExp(`^${session.replace('2A','2회 A형').replace('2B','2회 B형')}${session.includes('2')&&session.length>1?'':'회'}`)}).click();
  await page.getByLabel('필답형 화면 배치').selectOption('0');
  const crops=manifest.crops.filter((c:any)=>c.id.startsWith(`hvac-practical-restored-${yearNumber}-${session}-`));
  for(const id of new Set(crops.map((c:any)=>c.id))){
   const article=page.locator(`[data-practical-id="${id}"]`);
   for(const crop of crops.filter((c:any)=>c.id===id&&c.role==='question')){
    const image=article.locator(`.practical-prompt-images img[src="${crop.output}"]`);
    await image.scrollIntoViewIfNeeded();
    await expect.poll(()=>image.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
   }
   const link=article.getByRole('link',{name:/원문 동작 영상 보기/});
   await expect(link).toHaveAttribute('href',prompts.find(p=>p.id===id).sourceUrl);
   await expect(article.locator('.practical-solution')).toHaveCount(0);
   await article.getByRole('button',{name:'정답·채점 기준 보기'}).click();
   await expect(article.locator('.practical-solution')).toContainText(prompts.find(p=>p.id===id).answer);
   for(const crop of crops.filter((c:any)=>c.id===id&&c.role==='answer')){
    const image=article.locator(`.practical-solution img[src="${crop.output}"]`);
    await image.scrollIntoViewIfNeeded();await expect.poll(()=>image.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
   }
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  if(yearNumber===2020&&session==='4')await page.locator('[data-practical-id="hvac-practical-restored-2020-4-07"]').screenshot({path:'/private/tmp/cbt-remaining-final-device.png'});
  await page.getByRole('button',{name:'← 회차·자료 목록',exact:true}).click();
 }
 const year=page.locator('.practical-year-group').filter({has:page.getByRole('heading',{name:'2023년',exact:true})});
 await year.getByRole('button',{name:/1회/}).click();
 const article=page.locator('[data-practical-id="hvac-practical-restored-2023-1-02"]');
 const diagram=article.locator('.practical-prompt-images img');
 await diagram.scrollIntoViewIfNeeded();await expect(diagram).toHaveAttribute('src',/redrawn-v560.svg$/);
 await expect.poll(()=>diagram.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth===1000)).toBe(true);
 await diagram.screenshot({path:'/private/tmp/cbt-remaining-redrawn.png'});
 await article.locator('textarea').fill('나: RL 직결·GL 운전');
 await page.reload();
 await year.getByRole('button',{name:/1회/}).click();
 await expect(article.locator('textarea')).toHaveValue('나: RL 직결·GL 운전');
 expect(errors).toEqual([]);
});
