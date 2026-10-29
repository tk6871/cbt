import matches from '../../data/energy-textbook-comcbt-links.json' with {type:'json'};
import {coolingBookFingerprint} from './coolingBookScope';
import type {Question} from './types';
type Link={sourceId:string;sourceFingerprint:string;targetFingerprint:string;answer:number};
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
