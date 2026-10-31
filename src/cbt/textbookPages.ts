import links from '../../data/textbook-pages.json' with { type: 'json' };
import { coolingBookFingerprint } from './coolingBookScope';
import type { QuestionItem, AnswerHotspot } from './types';
import {questionId,subjectFor} from './catalog';
import {energyTextbookComcbtSource,withEnergyTextbookComcbt} from './energyTextbookExplanation';
import workedExamples from '../../data/textbook-worked-examples.json' with {type:'json'};
import pageAudit from '../../data/textbook-page-audit.json' with {type:'json'};
export type TextbookKey = 'hansol' | 'energy';
export type TextbookEntry = { book: string; page: string; number: number; sourceId: string | null; fingerprint: string | null; column?:number; imageSize?:number[]; pendingReason?:string; reviewHold?:boolean; correction?:{text:string;choices:string[];answer?:number;note:string;asset:string;size:number[];hotspots:AnswerHotspot[];sourceImage?:string|null;explanation?:string} };
export const textbookEntries: TextbookEntry[] = links.entries;
export const textbookNames = { hansol:'한솔 공조 교재', energy:'에너지설비 교재' };
export const textbookWorkedExamples=workedExamples.entries;
const auditedPages=new Map(pageAudit.pages.map(row=>[row.page,row]));
export const textbookAuditPages=pageAudit.pages;
export function textbookPageAudit(book:TextbookKey,page:string){return book==='hansol'?auditedPages.get(normalizeBookPage(page)):undefined;}
export function textbookAssetUrl(path:string,native=typeof document!=='undefined'&&document.documentElement.dataset.nativeApp==='true'):string {
 return native&&path.startsWith('assets/')?`https://tk6871.github.io/cbt/${path}`:path;
}
// Visually checked scan pages: these contain only an answer table or the
// previous question's explanation, not a missing selectable question.
export function textbookReferencePage(book:TextbookKey,page:string):string|undefined {
 if(book!=='energy')return;
 return ({'394':'정답표만 있는 쪽입니다. 앞쪽 문제의 정답은 풀이 후 해설에서 확인하세요.','489':'앞 문제의 이어지는 해설과 정답표가 있는 쪽입니다. 새로 풀 문제는 없습니다.','520':'정답표만 있는 쪽입니다. 앞쪽 문제의 정답은 풀이 후 해설에서 확인하세요.','599':'정답표만 있는 쪽입니다. 앞쪽 문제의 정답은 풀이 후 해설에서 확인하세요.'} as Record<string,string>)[normalizeBookPage(page)];
}
export const textbookSourceKeys = (book: TextbookKey) => book === 'hansol' ? ['hvac','hvac-hansol'] : ['energy','energy-midterm'];
// Book-only scans must not duplicate the existing ordinary exam rounds or
// expand a midterm selection. Load them only for the book reader/resume.
let earlierLoad:Promise<QuestionItem[]>|undefined;
export function loadTextbookSupplement(book:TextbookKey):Promise<QuestionItem[]> {
 if(book!=='energy')return Promise.resolve([]);
 const items=()=> (window.CBT_DATA_ENERGY_BOOK_EARLIER?.rounds||[]).flatMap(round=>round.questions.map(question=>({round,question,subject:subjectFor(round,question),id:questionId(round,question)})));
 if(window.CBT_DATA_ENERGY_BOOK_EARLIER)return Promise.resolve(items());
 return earlierLoad ||= new Promise<void>((resolve,reject)=>{
  const script=document.createElement('script');script.src=new URL('data/energy-book-earlier.js?v=621',document.baseURI).href;
  script.onload=()=>window.CBT_DATA_ENERGY_BOOK_EARLIER?resolve():reject(new Error('교재 자료를 읽지 못했습니다.'));
  script.onerror=()=>reject(new Error('교재 자료에 연결하지 못했습니다.'));
  document.head.appendChild(script);
 }).then(items).catch(error=>{earlierLoad=undefined;throw error;});
}
export function normalizeBookPage(value: string): string {
 return value.normalize('NFKC').trim().replace(/쪽|페이지|\s/g,'').replace(/[–—−]/g,'-').replace(/^p\.?/i,'');
}
export function compareBookPages(a:string,b:string):number {return a.localeCompare(b,'ko',{numeric:true});}
export function adjacentBookPage(book:TextbookKey,page:string,delta:number):string|undefined {
 const m=(book==='hansol'?/^(\d+)-(\d+)$/:/^(\d+)$/).exec(normalizeBookPage(page));if(!m)return;
 const n=Number(m.at(-1))+delta;if(n<1||book==='energy'&&n>645)return;
 return book==='hansol'?`${Number(m[1])}-${n}`:String(n);
}
export function textbookStudyId(e:TextbookEntry):string {return `book-study::${e.book}::${e.page}::${e.number}::${e.sourceId}`;}
// Same source question can have book-specific changed values/answers. Keep
// those variants when combining pages, instead of deduplicating by source ID.
export function textbookSelectionKey(e:TextbookEntry):string {return JSON.stringify([e.sourceId,e.correction?.text,e.correction?.choices,e.correction?.answer]);}
export function bookForStudyId(id:string):TextbookKey|undefined {
 const m=/^book-study::(hansol|energy)::/.exec(id);return m?.[1] as TextbookKey|undefined;
}
export function textbookStudyItems(items:QuestionItem[],entries:TextbookEntry[]=textbookEntries):QuestionItem[]{
 const map=new Map(items.map(i=>[i.id,i]));
 return entries.flatMap(e=>{
  if(e.reviewHold)return [];
  const original=e.sourceId?map.get(e.sourceId):undefined;
  if(!original||coolingBookFingerprint(original.question)!==e.fingerprint)return [];
  const roundId=`textbook-${e.book}-${e.page}`;
  const location=`${textbookNames[e.book as TextbookKey]} ${e.page}쪽 · ${e.number}번`;
  const enhanced=e.book==='energy'?withEnergyTextbookComcbt(original.question,e.sourceId!,map.get(energyTextbookComcbtSource(e.sourceId!)||'')?.question):original.question;
  const correction=e.correction;
  const question={...enhanced,...(correction?{text:correction.text,html:'',ocrText:undefined,imageOnly:true,answer:correction.answer??enhanced.answer,sourceImage:textbookAssetUrl(correction.asset),answerHotspots:correction.hotspots,
   choices:correction.choices.map(text=>({text,html:'',images:[]})),bookCorrection:{note:correction.note,originalImage:correction.sourceImage?textbookAssetUrl(correction.sourceImage):undefined}}:{}),sourceImageSize:e.imageSize||enhanced.sourceImageSize,number:e.number,_originRoundId:roundId,_originalNumber:e.number,
   _subject:original.subject,sourcePage:location};
  if(correction?.explanation){
   question.additionalExplanations=[...(enhanced.additionalExplanations||[]),...(enhanced.explanation?[{label:'수정 전 기존 CBT 해설',source:'기존 문제 보존본',text:enhanced.explanation}]:[])];
   question.explanation=correction.explanation;question.explanationHtml='';question.explanationType='editorial-supplement';question.explanationProvenance='book-verified-correction';
   question.explanationBasis='교재 지문·보기·정답표를 직접 대조하고, 원문과의 조건·정답 차이를 구분한 학습 설명입니다.';question.originalExplanationImagesFolded=true;
  }
  return [{id:textbookStudyId(e),subject:original.subject,question,
   round:{...original.round,id:roundId,title:location,kind:'textbook-pages',questions:[question]}}];
 });
}
