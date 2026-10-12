import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
test('pattern ledger distinguishes machine search from manual approval', () => {
 const r=JSON.parse(fs.readFileSync('docs/energy-restored-patterns-2026-10-12.json','utf8'));
 expect(r.oldBankSha256).toBe(crypto.createHash('sha256').update(fs.readFileSync('data/energy.js')).digest('hex'));
 expect(r.rows).toHaveLength(1040);expect(r.rounds).toHaveLength(13);
 expect(new Set(r.rows.map((q:any)=>`${q.year}-${q.session}-${q.number}`)).size).toBe(1040);
 expect(Object.values(r.totals).reduce((a:number,b:any)=>a+b,0)).toBe(1040);
 expect(r.manualExamples).toHaveLength(18);
 expect(r.manualExamples.filter((q:any)=>q.verdict==='repeat')).toHaveLength(13);
 for(const row of r.rounds)expect(row.strong+row.related+row.unmatched+row.missing).toBe(80);
 for(const row of r.rows){expect(row.number).toBeGreaterThan(0);expect(row.number).toBeLessThanOrEqual(80);if(row.group==='missing')expect(row.pdfPage).toBeNull();else expect(row.pdfPage).toBeGreaterThanOrEqual(431);expect(row).not.toHaveProperty('text');expect(row).not.toHaveProperty('ocrRows');}
 expect(r.limits).toContain('신문제 수 또는 비율로 해석하지 말 것');
});
test('pattern report exposes all rounds and keeps browser storage intact', async ({page}, testInfo) => {
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('cbt-pattern-sentinel','preserved'));
 await page.goto('/docs/energy-restored-patterns-2026-10-12.html');
 await expect(page.locator('.notice')).toContainText('18개만 수동 시각 판정');
 await expect(page.locator('body > article')).toHaveCount(18);
 await page.screenshot({path:testInfo.outputPath('energy-restored-patterns.png'),fullPage:false});
 await page.locator('details > summary').click();
 await expect(page.locator('#rows article')).toHaveCount(1040);
 await page.locator('#round').selectOption('2025-3');
 await expect(page.locator('#rows article')).toHaveCount(80);
 await page.locator('#round').selectOption('all');await page.locator('#group').selectOption('missing');
 await expect(page.locator('#rows article')).toHaveCount(10);
 expect(await page.evaluate(()=>localStorage.getItem('cbt-pattern-sentinel'))).toBe('preserved');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);
});
