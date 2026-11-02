import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
test.use({serviceWorkers:'block'});
test('분류 누락 없음·모든 미확정 보류 유지·현재 기준 해시',()=>{
 const data=JSON.parse(fs.readFileSync('work/hansol-whole-book/batch-review/triage.json','utf8'));
 const queue=JSON.parse(fs.readFileSync('work/hansol-whole-book/review-queue.json','utf8')).rows;
 expect(data.rows).toHaveLength(data.summary.total);expect(data.summary.unreviewed).toBe(queue.filter((r:any)=>r.kind!=='reviewed-unresolved').length);expect(data.summary.held).toBe(21);
 const keys=new Set(data.rows.map((r:any)=>r.key));expect(keys.size).toBe(data.rows.length);
 for(const r of queue)expect(keys.has(`${r.page}:${r.number}`)).toBe(true);
 expect(Object.values(data.summary.riskCounts).reduce((n:any,v:any)=>n+v,0)).toBe(data.rows.length);
 for(const row of data.rows){expect(row.fingerprint).toMatch(/^[a-f0-9]{64}$/);for(const [asset,hash] of Object.entries(row.snapshot.assetHashes))expect(hash,asset).not.toBe('MISSING');}
 const before=fs.readFileSync('work/hansol-whole-book/batch-review/triage.json','utf8');
 execFileSync(process.execPath,['tools/build-hansol-batch-review.mjs']);
 expect(fs.readFileSync('work/hansol-whole-book/batch-review/triage.json','utf8')).toBe(before);
});
test('비공개 묶음·범위/위험도 필터·원본 그림·확인 전 확정 금지·저장/재개/내보내기',async({page},info)=>{
 test.skip(info.project.name!=='desktop','검수 도구는 PC 전용; 앱 UI 변경 없음');
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/work/hansol-whole-book/batch-review/index.html?risk=figure&size=8');
 const cards=page.locator('.review-card');await expect(cards).not.toHaveCount(0);
 const data=JSON.parse(fs.readFileSync('work/hansol-whole-book/batch-review/triage.json','utf8'));
 const sample=data.rows.find((r:any)=>r.risk==='figure'&&(r.source?.sourceImage||r.source?.images?.length||r.source?.choiceImages?.some((c:any[])=>c.length)));
 await page.locator('#search').fill(sample.key);await expect(cards).toHaveCount(1);
 const row=cards.first();await expect(row.locator('.source-figures img,.full-image,.choice-figure').first()).toBeVisible();
 await row.getByRole('button',{name:'원문 동일',exact:true}).click();await expect(row.locator('.row-error')).toContainText('직접 확인');
 // UI plumbing test only: a hold is not an assertion of source equivalence.
 const rowKey=await row.getAttribute('data-key');
 await row.locator('[name=note]').fill('자동 UI 검사: 원문을 확정하지 않은 보류 기록');
 await row.getByRole('button',{name:'계속 보류',exact:true}).click();await expect(row.locator('.decision-status')).toContainText('보류');
 await page.reload();await expect(page.locator(`[data-key="${rowKey}"]`)).toHaveCount(0);
 await page.locator('#status').selectOption('hold');await expect(page.locator(`[data-key="${rowKey}"]`)).toBeVisible();
 await page.getByRole('button',{name:'차이만 보기',exact:true}).click();await expect(page.locator('.pair').first()).not.toBeVisible();
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'검수 결과 내보내기',exact:true}).click()]);
 const file=await download.path();const exported=JSON.parse(fs.readFileSync(file!,'utf8'));expect(exported.kind).toBe('hansol-private-batch-review');expect(exported.decisions[0].result).toBe('hold');
 await page.evaluate(()=>localStorage.removeItem('cbt-hansol-private-batch-review-v1'));
 await page.reload();await page.locator('#status').selectOption('hold');await expect(cards).toHaveCount(0);
 const stale={...exported,decisions:exported.decisions.map((d:any)=>({...d,fingerprint:'old'}))};
 await page.locator('#import').setInputFiles({name:'stale.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(stale))});
 await expect(page.locator('#message')).toContainText('0개 불러옴');await page.locator('#message button').click();await expect(cards).toHaveCount(0);
 await page.locator('#import').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
 await expect(page.locator('#message')).toContainText('1개 불러옴');await page.locator('#message button').click();await expect(cards).toHaveCount(1);
 expect(errors).toEqual([]);
});
test('원문 대조용4문제 캡처',async({page},info)=>{
 test.skip(info.project.name!=='desktop');
 await page.setViewportSize({width:1700,height:1100});
 for(const risk of ['values','wording']){
  await page.goto(`/work/hansol-whole-book/batch-review/index.html?part=2&risk=${risk}&size=8&inspect=1`);
  await expect(page.locator('.review-card')).not.toHaveCount(0);
  // Keep a small, directly legible group; don't generate thousands of crops.
  await page.locator('.review-card').evaluateAll(rows=>rows.slice(4).forEach(r=>r.remove()));
  await page.locator('.review-card img').evaluateAll(async(imgs:HTMLImageElement[])=>Promise.all(imgs.map(async img=>{img.loading='eager';await img.decode();})));
  await page.screenshot({path:`/private/tmp/hansol-batch-${risk}.png`,fullPage:true});
 }
});
