import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { coolingMidtermItems, coolingSafetyItems, schoolItemKey, schoolItemBaseKey, uniqueSchoolItems, coolingRecordItem, coolingUnusedItems, coolingOriginalId, coolingItemsWithOccurrences } from '../src/cbt/schoolQuestionBank';
import { questionId, subjectFor } from '../src/cbt/catalog';
import { coolingCalculation } from '../src/cbt/coolingPractice';
import type { Catalog } from '../src/cbt/types';

const review=JSON.parse(fs.readFileSync('docs/cooling-midterm-duplicate-review-2026-10-12.json','utf8'));
const overlay=JSON.parse(fs.readFileSync('data/cooling-midterm-reviewed-duplicates.json','utf8'));
function bank(){const c={window:{} as Record<string,Catalog>};for(const key of ['hvac','hvac-hansol'])vm.runInNewContext(fs.readFileSync(`data/${key}.js`,'utf8'),c);return Object.values(c.window).flatMap(c=>c.rounds.flatMap(r=>r.questions.map(q=>({round:{...r,qualificationKey:c.key},question:q,id:questionId(r,q),subject:subjectFor(r,q)}))));}
test('전체1180ID·승인178묶음·일반758/안전43·원본 바이트와 검수 해시 보존',()=>{
 const source=bank(),general=coolingMidtermItems(source),safety=coolingSafetyItems(source),all=[...general,...safety];
 expect(all).toHaveLength(1180);expect(uniqueSchoolItems(all,schoolItemBaseKey)).toHaveLength(1037);
 expect(review.rows).toHaveLength(1037);expect(review.pairs).toHaveLength(2900);expect(review.comparedPairs).toBe(537166);
 expect(new Set(review.rows.flatMap((r:any)=>r.members))).toEqual(new Set(all.map(i=>i.id)));
 expect(overlay.clusters).toHaveLength(178);expect(review.issues).toHaveLength(8);expect(review.sourceViews).toHaveLength(123);
 expect(uniqueSchoolItems(general)).toHaveLength(758);expect(uniqueSchoolItems(safety)).toHaveLength(43);expect(uniqueSchoolItems(general).filter(coolingCalculation)).toHaveLength(197);
 for(const key of ['hvac','hvac-hansol']){
  const bytes=fs.readFileSync(`data/${key}.js`);expect(bytes.equals(execFileSync('git',['show',`b067c6fc:data/${key}.js`],{maxBuffer:20e6}))).toBe(true);
  expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(review.sourceSha256[key]);
 }
 for(const image of review.sourceViews)expect(crypto.createHash('sha256').update(fs.readFileSync(image.path)).digest('hex')).toBe(image.sha256);
 const approved=new Set<string>();
 for(const g of overlay.clusters){const members=g.members.flatMap((m:any)=>m.ids).map((id:string)=>all.find(i=>i.id===id)!);expect(members.every(Boolean)).toBe(true);
  for(const m of members){expect(approved.has(m.id)).toBe(false);approved.add(m.id);expect(schoolItemKey(m)).toBe(g.group);expect(schoolItemKey(coolingRecordItem(m))).toBe(g.group);}
  expect(new Set(members.map(i=>safety.some(s=>s.id===i.id))).size).toBe(1);
  const rep=uniqueSchoolItems(members)[0];expect(rep.round.year).toBe(Math.max(...members.map(i=>i.round.year)));expect(rep.question.midtermOccurrences?.length).toBeGreaterThan(0);
 }
 for(const issue of review.issues){const pair=issue.ids.map((id:string)=>all.find(i=>i.id===id)!);expect(schoolItemKey(pair[0])).not.toBe(schoolItemKey(pair[1]));}
 for(const [a,b] of [[173,896],[197,338],[293,13],[109,733],[469,484],[995,1011]]){
  const pair=[a,b].map(index=>all.find(i=>i.id===review.rows[index].id)!);expect(schoolItemKey(pair[0])).not.toBe(schoolItemKey(pair[1]));
 }
 expect(coolingCalculation(all.find(i=>i.id==='hvac-hansol-2021-3:30')!)).toBe(true);
});
test('승인 별칭 변경가드·이전ID 복구·오답/미출제 순환은 같은 그룹으로 연결',()=>{
 const all=[...coolingMidtermItems(bank()),...coolingSafetyItems(bank())];
 for(const g of overlay.clusters){
  const members=g.members.flatMap((m:any)=>m.ids).map((id:string)=>all.find(i=>i.id===id)!);
  const one=members[0];
  for(const q of [{...one.question,text:`${one.question.text} 조건123kPa`},{...one.question,answer:one.question.answer===1?2:1},{...one.question,images:['new-diagram.png']}])expect(schoolItemKey({...one,question:q})).not.toBe(g.group);
  const scoped=members.map(coolingRecordItem),rep=uniqueSchoolItems(scoped)[0];
  const old=scoped.find(i=>i.id!==rep.id)!;expect(coolingOriginalId(old.id)).toBe(members.find(i=>i.id===coolingOriginalId(old.id))!.id);
  const restored=coolingItemsWithOccurrences(scoped).find(i=>i.id===old.id)!;
  expect(restored.question.midtermOccurrences).toEqual(rep.question.midtermOccurrences);
  const {midtermOccurrences,...original}=restored.question;expect(original).toEqual(old.question);
  expect(coolingUnusedItems([rep],scoped,{ids:[old.id],resetAt:0,savedAt:1},{})).toHaveLength(0);
  expect(uniqueSchoolItems(scoped.filter(i=>i.id===old.id))).toHaveLength(1);
 }
 const reportBytes=fs.readFileSync('docs/cooling-midterm-duplicate-review-2026-10-12.json');
 execFileSync('node',['tools/finalize-cooling-duplicate-review.mjs']);
 expect(fs.readFileSync('docs/cooling-midterm-duplicate-review-2026-10-12.json').equals(reportBytes)).toBe(true);
});
test('검수대장 PC: 전체/주의/후보·검색·원문 로딩/확대·기록불변',async({page})=>{
 await page.goto('./docs/cooling-midterm-duplicate-review-2026-10-12.html');await expect(page.locator('#count')).toContainText('178개 결과');
 await expect(page.locator('#summary')).toContainText('758');await expect(page.locator('#summary')).toContainText('43');await expect(page.locator('#error')).toBeEmpty();
 const before=await page.evaluate(()=>JSON.stringify(localStorage));
 await page.getByRole('button',{name:'전체 문제',exact:true}).click();await expect(page.locator('#count')).toContainText('1,037개 결과');
 await page.getByLabel('문제 검색').fill('hvac-hansol-2021-3:30');await expect(page.locator('#count')).toContainText('1개 결과');await expect(page.locator('#list')).toContainText('계산');
 await page.locator('.question details').first().locator('summary').click();const img=page.locator('.source-image').first();await expect.poll(()=>img.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
 await img.click();await expect(page.locator('#zoom')).toBeVisible();await page.getByRole('button',{name:'닫기',exact:true}).click();
 await page.getByLabel('문제 검색').fill('');await page.getByRole('button',{name:'원문 차이·정답 주의',exact:true}).click();await expect(page.locator('#count')).toContainText('8개 결과');await page.screenshot({path:'/private/tmp/cbt-cooling-review-586.png'});
 await page.getByRole('button',{name:'전체 비교 후보',exact:true}).click();await expect(page.locator('#count')).toContainText('2,900개 결과');await page.getByLabel('검토 결과').selectOption('merge');await expect(page.locator('#count')).toContainText('304개 결과');
 await page.getByRole('button',{name:'통합 묶음',exact:true}).click();await page.getByLabel('문제 범위').selectOption('safety');await expect(page.locator('#list')).toContainText('안전 별도');
 expect(await page.evaluate(()=>JSON.stringify(localStorage))).toBe(before);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
