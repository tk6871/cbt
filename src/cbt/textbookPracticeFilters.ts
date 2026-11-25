import type {QuestionItem} from './types';
import {energyFamily,energyKey,energyLabel} from './energyFinal';
import {coolingAppendixRound} from './textbookRoundInfo';

export type BookPracticeFilters={duplicates:boolean;similar:boolean;calculations:boolean};
export const emptyBookPracticeFilters:BookPracticeFilters={duplicates:false,similar:false,calculations:false};
const plain=(s='')=>s.normalize('NFKC').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/[−–]/g,'-').trim();
const tidy=(s='')=>plain(s).toLowerCase().replace(/\s+/g,'').replace(/[?？。]+$/,'');
function wording(i:QuestionItem){
 const q=i.question;
 // OCR may contain the full question and options in one block.
 const raw=(q.bookCorrection?q.text:q.bookFilterText||q.ocrText||q.text||q.html)||'';
 const parts=raw.split(/([①②③④])/);
 const stem=plain(parts[0]).replace(new RegExp('^\\s*0*'+q.number+'(?:[.)]\\s*|\\s+(?=[가-힣]))'),'');
 const printed=Array<string>(4).fill('');
 for(let k=1;k<parts.length;k+=2)printed['①②③④'.indexOf(parts[k])]=parts[k+1]||'';
 const choices=printed.every(c=>c.trim())?printed:q.choices.map(c=>c.text||c.html||'');
 return {stem,choices:choices.map(tidy)};
}

export function isTextbookCalculation(i:QuestionItem){
 const q=i.question,{stem:raw,choices}=wording(i);
 const stem=raw.replace(/얼\s*마/g,'얼마').replace(/계\s*산/g,'계산').replace(/일\s*때/g,'일 때');
 if(q.midtermCalculation)return true;
 if(/구하는\s*(?:공식|식|방법)|계산\s*(?:공식|식|방법)|(?:공식|계산식)\s*(?:으로|은|중)/.test(stem)&&!/(?:얼마|얼마나|계산하면)/.test(stem))return false;
 const data=/\d\s*(?:℃|°C|K\b|kW|kJ|kcal|Wh|MPa|kPa|Pa\b|kg|g\b|ton|t\b|L\b|mm|cm|m[²³23]?\b|h\b|s\b|초|분|시간|%|rpm|회전)/i.test(stem);
 const inputCount=(stem.match(/[-+]?\d+(?:[.,]\d+)*/g)||[]).length;
 const numerical=choices.filter(x=>!/^[1-4]번$/.test(x)&&/^[~≈±+\-(]*\d|^[~≈]*√/.test(x)).length>=3;
 const goal=/계산(?:하|하면|값|결과)|산출|구하|(?:값|열량|동력|유량|효율|압력|온도|능력|성적계수|부하|부피|질량|지름|길이|비율)(?:\s*[은는을를]|\s*(?:\?|으로))|얼마|몇\s*(?:배|회|%|[a-z])/i.test(stem);
 if(/기준|법령|규정|설치\s*높이|유효기간/.test(stem)&&!/계산|환산|산출|\d+\s*(?:일\s*때|일\s*경우)/.test(stem))return false;
 if(/(?:환산|단위\s*변환)/.test(stem)&&inputCount>0&&numerical)return true;
 if(numerical&&goal&&(data||inputCount>=2))return true;
 if(data&&goal&&inputCount>=2&&/일 때|인 경우|이라면|이면|가정|얼마|계산/.test(stem))return true;
 if(/계산하면|계산한\s*값|계산하시오/.test(stem)&&inputCount>0)return true;
 // Image/OCR questions can have a short stem but a reviewed numeric derivation.
 return numerical&&goal&&inputCount>0&&/\d\s*[×÷=]\s*[-+]?\d/.test(plain(q.explanation));
}

const label=(i:QuestionItem)=>{
 const key=energyKey(i.sourceQuestionId);
 if(i.round.id.startsWith('textbook-energy-')&&key)return energyLabel(key);
 if(i.round.id.startsWith('textbook-hansol-')){
   const page=i.round.id.slice('textbook-hansol-'.length);
   const group=coolingAppendixRound(page);
   if(group)return group.title+' · '+page+'쪽 '+i.question.number+'번';
 }
 const round=i.round.session;
 return [i.round.year||'',round||'',i.question.sourcePage||i.round.title].filter(Boolean).join(' · ');
};
function rank(i:QuestionItem){
 const r=i.round;
 const cooling=coolingAppendixRound(r.id.startsWith('textbook-hansol-')?r.id.slice('textbook-hansol-'.length):'');
 if(cooling?.year)return cooling.year*10000+cooling.round*100;
 const key=energyKey(i.sourceQuestionId);
 const parsed=/^(\d{4})-(\d+)/.exec(key);
 return Number(r.sortKey||r.date?.replace(/\D/g,'')||0)
   || (Number(parsed?.[1]||r.year||0)*10000+Number(parsed?.[2]||r.session?.match(/\d+/)?.[0]||0)*100);
}
function facts(i:QuestionItem){
 const q=i.question,{stem:raw,choices}=wording(i),stem=tidy(raw).replace(/^다음중/,'');
 const answer=choices[q.answer-1];
 const visual=/그림|도표|그래프|선도|다음표|다음식|교재.*쪽.*번/.test(stem)
   || q.images?.length || q.choices.some(c=>c.images?.length);
 if(!answer||new Set(choices.filter(c=>c&&!/^[1-4]번$/.test(c))).size<4||stem.length<12||visual)return;
 const choiceKey=JSON.stringify([answer,[...choices].sort()]);
 const nums=stem.match(/[-+]?\d+(?:[.,]\d+)*/g)||[];
 // Numeric conditions, units, operation direction and negative prompts are not interchangeable.
 const flags=stem.match(/kwh|kw|kcal|kj|wh|mpa|kpa|kg|mm|cm|℃|°c|%|m[23³²]|입구|출구|이상|이하|이전|이후|상승|하강|증가|감소|초과|미만|틀린|아닌|않은|없는|않는/g)||[];
 const nearKey=JSON.stringify([choiceKey,nums,flags]);
 const grams=new Set(Array.from({length:stem.length-2},(_,j)=>stem.slice(j,j+3)));
 return {exact:JSON.stringify([stem,choiceKey]),nearKey,grams,calculation:isTextbookCalculation(i)};
}

export function filterBookPractice(items:QuestionItem[],f:BookPracticeFilters,decorate=true){
 const filtered=f.calculations?items.filter(i=>!isTextbookCalculation(i)):items;
 if(!f.duplicates&&!f.similar)return filtered;
 const winners=new Map<string,QuestionItem>();
 const occurrences=new Map<string,Set<string>>();
 const near=new Map<string,Array<{i:QuestionItem;grams:Set<string>}>>();
 const skipped=new Set<string>();
 const append=(kept:QuestionItem,other:QuestionItem)=>{
   skipped.add(other.id);
   if(!decorate)return;
   const labels=occurrences.get(kept.id)||new Set([label(kept)]);
   labels.add(label(other)); occurrences.set(kept.id,labels);
 };
 for(const i of [...filtered].sort((a,b)=>rank(b)-rank(a))){
   const data=facts(i), energy=i.round.id.startsWith('textbook-energy-');
   const family=energy&&!i.question.bookCorrection?energyFamily(i.sourceQuestionId):undefined;
   const keys=[family&&'verified:'+family[0],data&&'exact:'+data.exact].filter((x):x is string=>!!x);
   const exact=keys.map(k=>winners.get(k)).find(Boolean);
   if(exact){append(exact,i);continue;}
   // Never cluster different calculations based only on a similar prompt or answer.
   if(f.similar&&data&&!data.calculation){
     const peers=near.get(data.nearKey)||[];
     const similar=peers.find(p=>{
       if(Math.min(data.grams.size,p.grams.size)<.78*Math.max(data.grams.size,p.grams.size))return false;
       let shared=0;for(const g of data.grams)if(p.grams.has(g))shared++;
       return shared/(data.grams.size+p.grams.size-shared)>=.72;
     });
     if(similar){append(similar.i,i);for(const k of keys)winners.set(k,similar.i);continue;}
     peers.push({i,grams:data.grams});near.set(data.nearKey,peers);
   }
   for(const k of keys)winners.set(k,i);
 }
 return filtered.filter(i=>!skipped.has(i.id)).map(i=>occurrences.has(i.id)?{
   ...i,question:{...i.question,midtermOccurrences:[...occurrences.get(i.id)!],midtermLatestSource:label(i)}
 }:i);
}

export function energyFinalInScope(i:QuestionItem){
 const suffix=energyKey(i.sourceQuestionId);
 const m=/^(\d{4})-(\d+)/.exec(suffix);
 if(!m)return false;
 const year=Number(m[1]),round=Number(m[2]);
 return (year>2019||year===2019&&round>=4)&&(year<2025||year===2025&&round<=3);
}
