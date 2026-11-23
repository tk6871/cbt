import groups from '../../data/energy-final-families.json' with {type:'json'};
import type {QuestionItem} from './types';

// All IDs are occurrences in the scanned textbook, not matches from another CBT.
const picks:Record<string,string>={
 '2018-1:1':'T-S면적','2018-1:5':'기체상태식','2018-1:21':'보일러입열','2018-1:41':'관류보일러','2018-1:61':'스케일','2018-1:62':'펌프형식',
 '2019-1:1':'제1법칙','2019-1:5':'회분','2019-1:21':'제어응답','2019-1:61':'역귀환배관','2019-1:62':'증기트랩',
 '2021-1:1':'제1법칙','2021-1:3':'석탄분석','2021-1:21':'열전대','2021-1:41':'증기트랩','2021-1:42':'신축이음','2021-1:61':'화염검출','2021-1:63':'소다끓이기',
 '2021-2:5':'완전연소','2022-1:2':'집진효율','2022-2:6':'매연','2022-4:3':'건도','2023-1:2':'기체연료','2023-1:23':'서미스터','2023-1:42':'잔류편차',
 '2023-2:1':'온도환산','2023-4:4':'저위발열량','2024-1:2':'SI단위','2024-1:21':'절탄기','2024-1:23':'액위계','2024-1:42':'피드백제어','2024-2:1':'오토사이클',
 '2025-1:1':'건도','2025-1:22':'탄성압력계','2025-1:41':'분출작업','2025-1:42':'캐스케이드','2025-1:43':'온오프제어','2025-1:61':'개조검사',
 '2025-2:3':'제2법칙','2025-3:2':'기체연료','2025-3:65':'수면계','2025-3:70':'안전밸브시험','2025-3:80':'포스트퍼지',
};
export const energyKey=(id='')=>id.match(/\d{4}-.+$/)?.[0]??'';
export const energyPick=(id?:string)=>picks[energyKey(id)];
const byOccurrence=new Map(groups.flatMap(g=>g.map(id=>[id,g] as const)));
export const energyFamily=(id?:string)=>byOccurrence.get(energyKey(id));
export const energyLabel=(key:string)=>key.replace(/^(\d{4})-([^:]+):(\d+)$/,'$1년 $2회 $3번');
export function energyPool(items:QuestionItem[],exclude:boolean,expected:boolean){
 const seen=new Set<string>(),unique=items.filter(i=>{
   const key=energyKey(i.sourceQuestionId);
   if(!key||seen.has(key))return false;
   seen.add(key);return true;
 });
 const eligible=expected?unique.filter(i=>energyPick(i.sourceQuestionId)):unique;
 if(!exclude)return eligible;
 const keys=new Set(eligible.map(i=>energyKey(i.sourceQuestionId)));
 return eligible.filter(i=>{
   const key=energyKey(i.sourceQuestionId),family=energyFamily(i.sourceQuestionId);
   return !family||family.find(id=>keys.has(id))===key;
 });
}
