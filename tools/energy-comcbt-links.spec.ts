import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import matches from '../data/energy-textbook-comcbt-links.json' with {type:'json'};
import {withEnergyTextbookComcbt} from '../src/cbt/energyTextbookExplanation';
import {explanationSource} from '../src/cbt/explanationSource';
import type {Question} from '../src/cbt/types';

function banks(){
 const context:any={window:{}};
 for(const file of ['energy','energy-restored','energy-textbook','energy-midterm','energy-book-earlier'])vm.runInNewContext(fs.readFileSync(`data/${file}.js`,'utf8'),context);
 return new Map<string,Question>(Object.values(context.window).flatMap((b:any)=>b.rounds.flatMap((r:any)=>r.questions.map((q:any)=>[`${q._originRoundId||r.id}:${q._originalNumber||q.number}`,q]))));
}
test('동일 문항만 실제 COMCBT 해설 우선 · 원문/기존 설명 보존',()=>{
 const map=banks();const before=JSON.stringify([...map]);
 expect(Object.keys(matches.links).length).toBeGreaterThan(200);
 for(const [id,link] of Object.entries(matches.links)){
  const q=map.get(id)!,source=map.get(link.sourceId)!;
  expect(q,id).toBeTruthy();expect(source,link.sourceId).toBeTruthy();
  if(q.sourceImage)expect(crypto.createHash('sha256').update(fs.readFileSync(q.sourceImage)).digest('hex')).toBe((link as any).targetImageSha256);
  const result=withEnergyTextbookComcbt(q,id,source);
  expect(result.explanationProvenance,id).toBe('comcbt-matched-textbook');
  expect(result.explanation,id).toBe(source.explanation||source.explanationHtml?.replace(/<[^>]+>/g,' ').trim());
  expect(result.explanationImages).toEqual(q.explanationImages);
  expect(result.originalExplanationImagesFolded).toBe(true);
  expect(explanationSource(result).label).toContain('COMCBT');
  if(q.explanation&&q.explanation!==result.explanation)expect(result.additionalExplanations?.some(e=>e.text===q.explanation)).toBe(true);
  expect(withEnergyTextbookComcbt(result,id,source)).toBe(result);
  expect(withEnergyTextbookComcbt({...q,answer:q.answer===1?2:1},id,source).explanationProvenance).toBe(q.explanationProvenance);
  expect(withEnergyTextbookComcbt({...q,text:q.text+'조건 변경'},id,source).explanationProvenance).toBe(q.explanationProvenance);
  expect(withEnergyTextbookComcbt(q,id,{...source,explanationType:'ai-reference'})).toBe(q);
  expect(withEnergyTextbookComcbt(q,id,{...source,source:'https://example.org'})).toBe(q);
 }
 expect(JSON.stringify([...map])).toBe(before);
});
