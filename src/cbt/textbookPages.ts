import links from '../../data/textbook-pages.json' with { type: 'json' };
import { coolingBookFingerprint } from './coolingBookScope';
import type { QuestionItem } from './types';
import {energyTextbookComcbtSource,withEnergyTextbookComcbt} from './energyTextbookExplanation';
export type TextbookKey = 'hansol' | 'energy';
export type TextbookEntry = { book: string; page: string; number: number; sourceId: string | null; fingerprint: string | null; column?:number; imageSize?:number[] };
export const textbookEntries: TextbookEntry[] = links.entries;
export const textbookNames = { hansol:'한솔 공조 교재', energy:'에너지설비 교재' };
export const textbookSourceKeys = (book: TextbookKey) => book === 'hansol' ? ['hvac','hvac-hansol'] : ['energy','energy-midterm'];
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
export function bookForStudyId(id:string):TextbookKey|undefined {
 const m=/^book-study::(hansol|energy)::/.exec(id);return m?.[1] as TextbookKey|undefined;
}
export function textbookStudyItems(items:QuestionItem[],entries:TextbookEntry[]=textbookEntries):QuestionItem[]{
 const map=new Map(items.map(i=>[i.id,i]));
 return entries.flatMap(e=>{
  const original=e.sourceId?map.get(e.sourceId):undefined;
  if(!original||coolingBookFingerprint(original.question)!==e.fingerprint)return [];
  const roundId=`textbook-${e.book}-${e.page}`;
  const location=`${textbookNames[e.book as TextbookKey]} ${e.page}쪽 · ${e.number}번`;
  const enhanced=e.book==='energy'?withEnergyTextbookComcbt(original.question,e.sourceId!,map.get(energyTextbookComcbtSource(e.sourceId!)||'')?.question):original.question;
  const question={...enhanced,sourceImageSize:e.imageSize,number:e.number,_originRoundId:roundId,_originalNumber:e.number,
   _subject:original.subject,sourcePage:location};
  return [{id:textbookStudyId(e),subject:original.subject,question,
   round:{...original.round,id:roundId,title:location,kind:'textbook-pages',questions:[question]}}];
 });
}
