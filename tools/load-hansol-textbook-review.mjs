// Small, manually verified book wording patches. Not an OCR correction model.
import fs from 'node:fs';import assert from 'node:assert/strict';
export function loadHansolReview(originals){
 const base=JSON.parse(fs.readFileSync('tools/hansol-textbook-page-review.json','utf8'));
 const changes=JSON.parse(fs.readFileSync('tools/hansol-book-copy-patches.json','utf8'));
 const rows=[...base.rows];const seen=new Set(rows.map(r=>`${r.page}:${r.number}`));
 for(const row of changes.rows){
  const key=`${row.page}:${row.number}`;assert.ok(!seen.has(key),key);seen.add(key);
  const source=originals.get(row.sourceId);assert.ok(source,row.sourceId);assert.equal(source.answer,row.answer,key);
  const correction={text:source.text?.replace(/^\s*\d+[.．)](?!\d)\s*/,''),choices:Array.from(source.choices,c=>c.text),note:row.note||'책의 지문·네 보기·정답을 대조해 조사·어미·영문 표기를 교재에 맞춘 사본입니다. 기존 CBT 원본과 해설은 보존합니다.'};
  if(row.bookAnswer!==undefined){assert.ok([1,2,3,4].includes(row.bookAnswer),key);assert.ok(row.note&&row.explanation,`${key}: answer difference needs explicit explanation`);correction.answer=row.bookAnswer;}
  if(row.explanation)correction.explanation=row.explanation;
  assert.equal(typeof correction.text,'string',key);assert.equal(correction.choices.length,4,key);
  for(const patch of row.patches){
   assert.notEqual(patch.from,patch.to,`${key}: correction must change the wording`);
   const index=/^choice([1-4])$/.exec(patch.field);assert.ok(patch.field==='text'||index,key);
   const old=index?correction.choices[Number(index[1])-1]:correction.text;
   assert.equal(old.split(patch.from).length,2,`${key} ${patch.field}: source wording changed`);
   const next=old.replace(patch.from,patch.to);if(index)correction.choices[Number(index[1])-1]=next;else correction.text=next;
  }
  const {patches,...meta}=row;rows.push({...meta,correction});
 }
 return {...base,date:changes.date,rows};
}
