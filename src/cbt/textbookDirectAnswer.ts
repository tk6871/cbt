import verifiedKeys from '../../data/textbook-direct-answers.json' with {type:'json'};
import fullReview from '../../data/textbook-direct-answer-review.json' with {type:'json'};
import type {TextbookDirectSource,TextbookDirectPage} from './textbookPages';

const pages:Record<string,{sha256:string;answers:Record<string,number[]>}>=verifiedKeys;
const entries=new Map(fullReview.entries.map(row=>[row.id,row]));
const geometry=(parts:TextbookDirectSource['questionParts'])=>JSON.stringify(parts.map(p=>[p.page,p.rect,p.asset||'',p.size||[]]));

// Values are read from the printed key next to the same four choices, not
// from OCR or a potentially different question in the CBT bank.
export function textbookDirectAnswer(source:TextbookDirectSource,page:TextbookDirectPage):number|undefined {
 const exact=entries.get(source.id);
 if(exact&&source.split&&source.page===page.page&&exact.page===page.page&&exact.number===source.number
  &&exact.pageSha256===page.sha256&&geometry(exact.questionParts)===geometry(source.questionParts)
  &&geometry(exact.solutionParts)===geometry(source.solutionParts)&&[1,2,3,4].includes(exact.answer))return exact.answer;
 if(exact)return; // A changed reviewed crop must not bypass the guard through a legacy key.
 const reviewed=pages[source.page];
 if(!source.split||source.page!==page.page||!page.answerKeyRect||reviewed?.sha256!==page.sha256)return;
 if(source.id!==`hansol-direct-${source.page}-${source.number}`||source.questionParts.length!==1)return;
 const row=reviewed.answers[String(source.number)];
 if(!row||row.length!==5)return;
 const [answer,...rect]=row;
 const part=source.questionParts[0]!;
 if(answer&&Number.isInteger(answer)&&answer>=1&&answer<=4&&part.page===page.page&&part.rect.length===rect.length&&rect.every((n,i)=>n===part.rect[i]))return answer;
}
