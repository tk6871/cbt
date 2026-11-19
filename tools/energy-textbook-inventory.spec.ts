import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const archive = 'work/private-notes/retired-public-v59/docs';

function readReport(filename: string, sha256: string) {
 const archived = `${archive}/${filename}`;
 const bytes = fs.readFileSync(fs.existsSync(archived) ? archived : `docs/${filename}`);
 expect(createHash('sha256').update(bytes).digest('hex'), filename).toBe(sha256);
 return JSON.parse(bytes.toString('utf8'));
}

test('book-first inventory covers the actual 21 rounds without loading a question bank',()=>{
 const r=readReport('energy-textbook-inventory-2026-10-13.json','1abbeee618cb0540f652f05ade9e0fd947231d65b3d40bd38cb57d23fc26d110');
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
 const r=readReport('energy-textbook-topic-screening-2026-10-13.json','2747e6252ada7307a49ee148731c2461fbccf24a22b104b6d72945cb1cfeb8e3');
 expect(r.counts).toEqual({slots:1680,located:1666,missing:14,candidateSlots:183});
 expect(r.topics).toHaveLength(20);
 const unique=new Set(r.topics.flatMap((t:any)=>t.candidates.map((q:any)=>`${q.year}-${q.session}:${q.number}`)));
 expect(unique.size).toBe(183);
 expect(r.limits.join(' ')).toContain('최종 선별은 미완료');
});
