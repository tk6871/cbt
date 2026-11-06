import verifiedKeys from '../../data/textbook-direct-answers.json' with {type:'json'};
import type {TextbookDirectSource,TextbookDirectPage} from './textbookPages';

const pages:Record<string,{sha256:string;answers:Record<string,number[]>}>=verifiedKeys;

// Values are read from the printed key next to the same four choices, not
// from OCR or a potentially different question in the CBT bank.
export function textbookDirectAnswer(source:TextbookDirectSource,page:TextbookDirectPage):number|undefined {
 const reviewed=pages[source.page];
 if(!source.split||source.page!==page.page||!page.answerKeyRect||reviewed?.sha256!==page.sha256)return;
 if(source.id!==`hansol-direct-${source.page}-${source.number}`||source.questionParts.length!==1)return;
 const row=reviewed.answers[String(source.number)];
 if(!row||row.length!==5)return;
 const [answer,...rect]=row;
 const part=source.questionParts[0]!;
 if(answer&&Number.isInteger(answer)&&answer>=1&&answer<=4&&part.page===page.page&&part.rect.length===rect.length&&rect.every((n,i)=>n===part.rect[i]))return answer;
}
