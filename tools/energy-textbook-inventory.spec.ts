import {test,expect} from '@playwright/test';
import fs from 'node:fs';

test('book-first inventory covers the actual 21 rounds without loading a question bank',()=>{
 const r=JSON.parse(fs.readFileSync('docs/energy-textbook-inventory-2026-10-13.json','utf8'));
 expect(r.source.pages).toBe(634);
 expect(r.source.sha256).toBe('840565d198cbbfe871b25a08e2bcb9b2d3dbdcbbadead2b2ca031308caed767d');
 expect(r.rounds).toHaveLength(21);expect(r.rows).toHaveLength(1680);
 expect(new Set(r.rows.map((q:any)=>`${q.year}-${q.session}:${q.number}`)).size).toBe(1680);
 expect(r.rounds.reduce((a:number,q:any)=>a+q.slots,0)).toBe(1680);
 expect(r.rounds.filter((q:any)=>q.year<=2020).length*80).toBe(640);
 expect(r.rounds.filter((q:any)=>q.year>=2021).length*80).toBe(1040);
 expect(r.rows.filter((q:any)=>!q.located)).toHaveLength(14);
 expect(r.structure[0]).toMatchObject({kind:'theory',firstPdfPage:1,lastPdfPage:307});
 for(const q of r.rows){expect(q).not.toHaveProperty('stem');expect(q).not.toHaveProperty('rows');}
 for(const file of ['tools/inventory-energy-textbook.mjs','tools/screen-energy-textbook-topics.mjs']){
  const text=fs.readFileSync(file,'utf8');expect(text).not.toContain('data/energy.js');expect(text).not.toContain('data/energy-midterm.js');
 }
});

test('screening candidates remain provisional and reference-only',()=>{
 const r=JSON.parse(fs.readFileSync('docs/energy-textbook-topic-screening-2026-10-13.json','utf8'));
 expect(r.counts).toEqual({slots:1680,located:1666,missing:14,candidateSlots:183});
 expect(r.topics).toHaveLength(20);
 const unique=new Set(r.topics.flatMap((t:any)=>t.candidates.map((q:any)=>`${q.year}-${q.session}:${q.number}`)));
 expect(unique.size).toBe(183);
 expect(r.limits.join(' ')).toContain('최종 선별은 미완료');
});
