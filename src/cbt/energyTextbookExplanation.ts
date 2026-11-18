import editorial from '../../data/energy-reviewed-explanations.json' with {type:'json'};
import matches from '../../data/energy-textbook-comcbt-links.json' with {type:'json'};
import {coolingBookFingerprint} from './coolingBookScope';
import type {Question} from './types';
type Link={sourceId:string;sourceFingerprint:string;targetFingerprint:string;answer:number};
type ReviewedExplanation = {fingerprint:string; text:string; basis:string; originalLabel?:string; formula?:Question['explanationFormula']};
const reviewed: Record<string,ReviewedExplanation> = editorial;
const links=matches.links as Record<string,Link>;
export function energyTextbookComcbtSource(id:string):string|undefined{return links[id]?.sourceId;}
export function withEnergyTextbookComcbt(question:Question,id:string,source?:Question):Question{
 const link=links[id];
 if(!source||!link||source.answer!==question.answer||question.answer!==link.answer
  ||source.explanationType==='ai-reference'||source.explanationProvenance==='concise-answer-guide'
  ||!/^https:\/\/www\.comcbt\.com\/cbt\/problem\//.test(source.source||'')
  ||coolingBookFingerprint(source)!==link.sourceFingerprint
  ||coolingBookFingerprint(question)!==link.targetFingerprint)return question;
 const text=(source.explanation||source.explanationHtml?.replace(/<[^>]+>/g,' ')||'').trim();
 if(!text)return question;
 if(question.explanationProvenance==='comcbt-matched-textbook')return question;
 return {...question,explanation:text,explanationHtml:source.explanationHtml||'',explanationType:'comcbt-registered',explanationProvenance:'comcbt-matched-textbook',
  explanationBasis:'기존에 수집된 COMCBT 등록 해설입니다. 교재 지문·보기4개 순서·정답을 대조했습니다. 새 실시간 수집이나 공식 채점 기준은 아닙니다.',
  source:source.source,originalExplanationImagesFolded:true,
  additionalExplanations:[...(question.additionalExplanations||[]),
   ...(question.explanation&&question.explanation!==text?[{label:'기존 학습용 설명',source:'기존 설명 보존',text:question.explanation}]:[])],
 };
}

/** Preserve the matched user comment alongside a separately attributed editorial explanation. */
export function energyExplanation(question: Question, id: string, source?: Question): Question {
 if (question.explanationProvenance === 'energy-content-reviewed') return question;
 const linked = withEnergyTextbookComcbt(question, id, source);
 const matched = linked.explanationProvenance === 'comcbt-matched-textbook';
 const sourceId = energyTextbookComcbtSource(id);
 const own = reviewed[id];
 const inherited = matched && sourceId ? reviewed[sourceId] : undefined;
 const entry = own && coolingBookFingerprint(question) === own.fingerprint ? own
  : inherited && source && coolingBookFingerprint(source) === inherited.fingerprint ? inherited : undefined;
 if (!entry) return linked;

 // The book reader can pass an already prepared source from the regular bank.
 const original = source?.explanationProvenance === 'energy-content-reviewed' && matched
  ? source.additionalExplanations?.find(section => section.source === source.source)?.text
  : linked.explanation;
 const sections = [...(linked.additionalExplanations || [])];
 const generated = linked.explanationType === 'ai-reference' || linked.explanationProvenance === 'concise-answer-guide';
 if (!generated && original && linked.source?.startsWith('https://www.comcbt.com/cbt/problem/')
   && !sections.some(section => section.source === linked.source && section.text === original)) {
  sections.push({label:entry.originalLabel || inherited?.originalLabel || '기존 COMCBT 이용자 해설', source:linked.source, text:original});
 }
 return {...linked, explanation:entry.text, explanationHtml:'', explanationFormula:entry.formula,
  explanationProvenance:'energy-content-reviewed', explanationBasis:entry.basis,
  originalExplanationImagesFolded:false, additionalExplanations:sections};
}
