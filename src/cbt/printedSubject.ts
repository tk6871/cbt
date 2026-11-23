import type {QuestionItem} from './types';
const hansol=['공기조화설비','냉동냉장설비','공조냉동설치운영'];
const energy=['열역학 및 연소관리','계측 및 에너지진단','열설비구조 및 시공','열설비취급 및 안전관리'];
export function bookSubject(book:string,page:string,n:number,item?:QuestionItem){
 if(book==='hansol'){
   const vol=Number(page.split('-')[0]);
   const ordinal=vol<=3?vol:Math.ceil(n/20);
   if(ordinal>=1&&ordinal<=3)return {name:hansol[ordinal-1],ordinal};
 }
 if(book==='energy'&&Number(page)>=321&&n>=1&&n<=80){
   const ordinal=Math.ceil(n/20);return {name:energy[ordinal-1],ordinal};
 }
 return sourceSubject(item);
}
function sourceSubject(item?:QuestionItem){
 const name=item?.subject||'과목 미확인';
 const pos=item?.round.subjects.indexOf(name)??-1;
 return {name,ordinal:pos>=0?pos+1:0};
}
export function questionSubject(item:QuestionItem){
 const m=/^textbook-(hansol|energy)-(.+)$/.exec(item.round.id);
 return m?bookSubject(m[1],m[2],item.question.number,item):sourceSubject(item);
}
export const subjectLabel=({name,ordinal}:{name:string,ordinal:number})=>ordinal?`${ordinal}과목 · ${name}`:name;
