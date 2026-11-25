import {authoredMeta,type FinalSubject} from './finalCourseBank';
import type {QuestionItem} from './types';
import {energyKey,energyPick,energyPool} from './energyFinal';
import {forkliftQuota} from './forkliftFinal';
import {filterBookPractice,type BookPracticeFilters} from './textbookPracticeFilters';
import {questionSubject} from './printedSubject';
import {coolingAppendixRound} from './textbookRoundInfo';

// Printed page:number -> tested skill. An allow-list, not a random sample of the book.
const coolingPicks:Record<string,string>={
 '4-10:21':'흡수식 냉매쌍','4-25:28':'냉각부하','4-27:37':'고압측 기기','4-38:26':'열역학 법칙',
 '4-40:35':'저압 이상','4-52:33':'사이클 과정','4-63:31':'흡수식 원리','4-65:40':'모세관',
 '4-76:29':'동결부하','4-79:38':'냉동사이클 상태량','4-91:36':'중간냉각기','4-102:34':'다단압축',
 '4-113:23':'제빙','4-127:30':'압축기 구조','4-129:39':'피스톤 압출량','4-141:37':'증발식 응축기',
 '4-152:26':'냉각부하','4-154:35':'압축기 간극','4-164:24':'동결부하','4-175:22':'흡수식 성적계수',
 '4-177:31':'냉동효과','4-179:40':'피스톤 압출량','4-191:38':'감온식 팽창밸브','5-20:25':'만액식 증발기',
 '5-22:34':'기체 상태식','5-31:23':'중간압력','5-32:32':'감온식 팽창밸브','5-45:30':'건조기',
 '5-46:39':'압축비','5-56:28':'냉동효과 계산','5-68:26':'보냉','5-70:35':'냉매 요건',
 '5-79:24':'냉각탑 레인지','5-80:33':'냉매 환경성','5-93:40':'윤활유',
};
export function shuffle<T>(items:readonly T[]):T[]{
 const out=items.slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;
}
const norm=(s='')=>s.normalize('NFKC').toLowerCase().replace(/<[^>]+>/g,'').replace(/\s+/g,'').replace(/[?。]/g,'');
function stem(i:QuestionItem){
 return norm((i.question.ocrText||i.question.text||'').replace(/^\s*\d+\s*[.)]\s*/,''));
}
function curated(i:QuestionItem,subject:FinalSubject){
 const authored=authoredMeta.get(i.id);
 if(authored)return authored.pick?authored.group:undefined;
 if(subject==='cooling')return coolingPicks[i.round.id.replace('textbook-hansol-','')+':'+i.question.number];
}
export const finalRangeSizes=['actual','20','30','40','50','60','70','80'] as const;
export type FinalRangeSize=typeof finalRangeSizes[number];
export type FinalOptions={expected:boolean,exclude:boolean,count?:number,range?:number,rangeSize?:FinalRangeSize,paper?:string,skipDrawn?:boolean,bookFilters?:BookPracticeFilters};
const drawKey=(subject:FinalSubject)=>'school-final-drawn-v1:'+subject;
export function drawnIds(subject:FinalSubject):Set<string>{
 try{const v:unknown=JSON.parse(localStorage.getItem(drawKey(subject))||'[]');return new Set(Array.isArray(v)?v.filter(i=>typeof i==='string'):[]);}
 catch{return new Set();}
}
export function storeDraw(subject:FinalSubject,ids:string[]){try{localStorage.setItem(drawKey(subject),JSON.stringify(ids));}catch{}}
export const sampleSize=10;
export const rangeSize=60;
export function printedPage(i:QuestionItem){return /^textbook-(?:hansol|energy)-(.+)$/.exec(i.round.id)?.[1]||'';}
function originalRound(i:QuestionItem){
 const r=i.round, q=i.question;
 if(r.id.startsWith('textbook-hansol-')){
   const source=coolingAppendixRound(printedPage(i));
   if(source)return {id:source.id,label:source.title,number:q.number,kind:source.year?'exam':'mock'};
 }
 if(r.id.startsWith('textbook-energy-')){
   const key=energyKey(i.sourceQuestionId).split(':')[0].replace(/1-2통합/g,'1·2통합');
   const [year,session]=key.split('-');
   if(year&&session)return {id:key,label:year+'년 '+session+'회',number:q.number,kind:'exam'};
 }
 const key=i.sourceQuestionId?.split(':')[0]||'';
 if(r.year>=1900&&r.session)return {id:r.year+':'+r.session,label:r.year+'년 '+r.session,number:Number(i.sourceQuestionId?.split(':').at(-1))||q.number,kind:'exam'};
 const m=/^hvac-(?:hansol-)?(\d{4})-?([1-4])$/.exec(key);
 if(m)return {id:m[1]+':'+m[2]+'회',label:m[1]+'년 '+m[2]+'회',number:Number(i.sourceQuestionId?.split(':').at(-1))||q.number,kind:'exam'};
 // A publisher-authored mock or a direct page is not a confirmed past exam.
 return {id:'book:'+printedPage(i).split('-')[0],label:'교재 수록 · 회차 미확인',number:q.number,kind:'unknown'};
}
function displayNumbers(values:Iterable<number>){
 const nums=[...new Set(values)].sort((a,b)=>a-b);
 const runs:Array<[number,number]>=[];
 for(const n of nums){
   const tail=runs.at(-1);
   if(tail&&n===tail[1]+1)tail[1]=n;else runs.push([n,n]);
 }
 return runs.map(([a,b])=>a===b?String(a):a+'~'+b).join(', ');
}
export function finalRanges(pool:QuestionItem[],selection?:FinalRangeSize){
 const size=selection&&selection!=='actual'?Number(selection):pool[0]?.round.id==='school-final-forklift'?15:pool[0]?.round.id.startsWith('school-final-')?10:rangeSize;
 const grouped=new Map<string,QuestionItem[]>();
 if(selection==='actual')for(const i of pool){
   const key=originalRound(i).id;
   const items=grouped.get(key)||[];items.push(i);grouped.set(key,items);
 }
 const ranges=selection==='actual'?[...grouped.values()]:Array.from({length:Math.ceil(pool.length/size)},(_,index)=>pool.slice(index*size,(index+1)*size));
 return ranges.map((items,index)=>{
   const first=printedPage(items[0]),last=printedPage(items.at(-1)!);
   const source=new Map<string,{label:string;kind:string;numbers:number[]}>();
   if(first&&selection)for(const i of items){
     const row=originalRound(i),entry=source.get(row.id)||{label:row.label,kind:row.kind,numbers:[]};
     entry.numbers.push(row.number);source.set(row.id,entry);
   }
   const described=[...source.values()];
   const compact=(labels:string[])=>labels.length<2?labels[0]:labels[0]+' ~ '+labels.at(-1);
   const known=described.filter(row=>row.kind==='exam').map(row=>row.label);
   const mocks=described.filter(row=>row.kind==='mock').map(row=>row.label);
   const headings=described.map(row=>row.label);
   const title=selection==='actual'?(headings[0]||index+1+'회'):index+1+'회';
   const summary=[known.length&&compact(known)+' · 기출 '+known.length+'회차',mocks.length&&'핵심 모의고사 '+mocks.length+'회차',
     known.length+mocks.length<headings.length&&'회차 미확인 포함'].filter(Boolean).join(' / ');
   return {index,items,title,summary,detail:described.map(s=>s.label+' '+displayNumbers(s.numbers)+'번'),
     label:first?(first===last?first:first+'~'+last)+'쪽':(index*size+1)+'~'+(index*size+items.length)+'번'};
 });
}
const thermalGroups=new Set(['불림','풀림','뜨임','담금질','냉각선도']);
const tttGroups=new Set(['TTT축','변태율','Ms','마퀜칭','오스템퍼링','마템퍼링','코','항온조직']);
export function metalBlock(i:QuestionItem){
 const group=authoredMeta.get(i.id)?.group.split(':')[1]??'';
 if(i.question.sourcePage && /PDF (?:[2-9]|1\d|2\d|3\d|4\d|50|9[1-5])쪽/.test(i.question.sourcePage))return 'materials';
 return thermalGroups.has(group)?'thermal':tttGroups.has(group)?'ttt':'phase';
}
export function selectFinalItems(all:QuestionItem[],subject:FinalSubject,options:FinalOptions){
 if(subject==='forklift'&&options.expected){
   const paper:QuestionItem[]=[];
   for(const [topic,count] of Object.entries(forkliftQuota)){
     const pool=all.filter(i=>i.subject===topic);
     if(pool.length<count)return [];
     paper.push(...shuffle(pool).slice(0,count));
   }
   return paper;
 }
 const limit=Math.max(1,Math.trunc(options.count||sampleSize));
 if(!options.expected && options.range!==undefined){
   if(subject==='energy')all=energyPool(all,false,false);
   all=finalRanges(all,options.rangeSize)[options.range]?.items??[];
 }
 if(options.paper)all=all.filter(i=>questionSubject(i).name===options.paper);
 if(options.bookFilters&&(subject==='energy'||subject==='cooling')){
   const eligible=subject==='energy'?energyPool(all,false,options.expected):options.expected?all.filter(i=>curated(i,subject)):all;
   const kept=filterBookPractice(eligible,options.bookFilters);
   return options.expected?shuffle(kept).slice(0,limit):kept;
 }
 if(subject==='energy'){
   const pool=energyPool(all,options.exclude,options.expected);
   if(!options.expected)return pool;
   const used=new Set<string>();
   return shuffle(pool).filter(i=>{
     const skill=energyPick(i.sourceQuestionId);
     if(options.exclude&&used.has(skill))return false;
     used.add(skill);return true;
   }).slice(0,limit);
 }
 const eligible=options.expected?all.filter(i=>curated(i,subject)):all;
 let pool=options.expected?shuffle(eligible):eligible;
 if(subject==='metal'&&options.expected){
   const blockPool=(block:string)=>{
     const group=pool.filter(i=>metalBlock(i)===block);
     return options.exclude?group.filter((i,k)=>group.findIndex(x=>authoredMeta.get(x.id)?.group===authoredMeta.get(i.id)?.group)===k):group;
   };
   const bins={phase:blockPool('phase'),ttt:blockPool('ttt'),thermal:blockPool('thermal'),materials:blockPool('materials')};
   const schedule=['materials','phase','ttt','thermal','materials','phase','materials','thermal','ttt','materials'] as const;
   const out:QuestionItem[]=[];
   while(out.length<limit&&Object.values(bins).some(b=>b.length)){
     for(const b of schedule){const next=bins[b].pop();if(next)out.push(next);if(out.length===limit)break;}
   }
   return shuffle(out);
 }
 if(!options.exclude)return options.expected?pool.slice(0,limit):pool;
 const keys=new Set<string>(), results:QuestionItem[]=[];
 // Only compare near-identical stems with the same answer, numeric conditions and polarity.
 const near=new Map<string,Set<string>[]>();
 for(const i of pool){
   const s=stem(i),q=i.question,answer=norm(q.choices[q.answer-1]?.text);
   const printedPlaceholder=/교재.*쪽.*번|이미지.*문제/.test(s);
   const keysHere:string[]=[];
   const authored=authoredMeta.get(i.id);
   if(authored)keysHere.push('author:'+authored.group);
   if(i.sourceQuestionId&&!q.bookCorrection)keysHere.push('source:'+i.sourceQuestionId);
   if(!printedPlaceholder&&s.length>10&&answer)keysHere.push('text:'+s+'|'+answer);
   if(options.expected){const family=curated(i,subject);if(family)keysHere.push('skill:'+family);}
   const bucket=answer+'|'+(s.match(/[-+]?\d+(?:\.\d+)?/g)||[]).join(',')+'|'+/틀린|아닌|않은|없는|아니/.test(s);
   const grams=answer&&s.length>=22&&!printedPlaceholder?new Set(Array.from({length:s.length-2},(_,j)=>s.slice(j,j+3))):undefined;
   const peers=near.get(bucket)||[];
   if(keysHere.some(k=>keys.has(k))||grams&&peers.some(old=>{
     if(Math.min(old.size,grams.size)<.84*Math.max(old.size,grams.size))return false;
     let n=0;for(const g of grams)if(old.has(g))n++;return n/(old.size+grams.size-n)>=.82;
   }))continue;
   if(grams){peers.push(grams);near.set(bucket,peers);}
   keysHere.forEach(k=>keys.add(k));results.push(i);
   if(options.expected&&results.length===limit)break;
 }
 return results;
}
