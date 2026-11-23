import {authoredMeta,type FinalSubject} from './finalCourseBank';
import type {QuestionItem} from './types';
import {energyPick,energyPool} from './energyFinal';

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
export type FinalOptions={expected:boolean,exclude:boolean};
export const sampleSize=10;
const thermalGroups=new Set(['불림','풀림','뜨임','담금질','냉각선도']);
const tttGroups=new Set(['TTT축','변태율','Ms','마퀜칭','오스템퍼링','마템퍼링','코','항온조직']);
export function metalBlock(i:QuestionItem){
 const group=authoredMeta.get(i.id)?.group.split(':')[1]??'';
 return thermalGroups.has(group)?'thermal':tttGroups.has(group)?'ttt':'phase';
}
export function selectFinalItems(all:QuestionItem[],subject:FinalSubject,options:FinalOptions){
 if(subject==='energy'){
   const pool=energyPool(all,options.exclude,options.expected);
   if(!options.expected)return pool;
   const used=new Set<string>();
   return shuffle(pool).filter(i=>{
     const skill=energyPick(i.sourceQuestionId);
     if(options.exclude&&used.has(skill))return false;
     used.add(skill);return true;
   }).slice(0,sampleSize);
 }
 const eligible=options.expected?all.filter(i=>curated(i,subject)):all;
 let pool=options.expected?shuffle(eligible):eligible;
 if(subject==='metal'&&options.expected){
   const slice=(block:string,n:number)=>{
     const group=pool.filter(i=>metalBlock(i)===block);
     return (options.exclude?group.filter((i,k)=>group.findIndex(x=>authoredMeta.get(x.id)?.group===authoredMeta.get(i.id)?.group)===k):group).slice(0,n);
   };
   return shuffle([...slice('phase',5),...slice('ttt',3),...slice('thermal',2)]);
 }
 if(!options.exclude)return options.expected?pool.slice(0,sampleSize):pool;
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
   if(options.expected&&results.length===sampleSize)break;
 }
 return results;
}
