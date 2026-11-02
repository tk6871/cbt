import crypto from 'node:crypto';

export const riskNames={changed:'확정 후 원본 변경',answer:'정답 확인',values:'숫자·단위 차이 후보',figure:'그림·수식 대조',wording:'보기·문장 차이',search:'다른 원문 찾기',hold:'기존 보류'};
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function normalized(value){return String(value??'').normalize('NFKC').replace(/[–—−]/g,'-').replace(/\s+/g,'').replace(/[.?!。！？]+$/g,'').toLowerCase();}
export function valuesIn(value){
 // These are OCR warning signals, not a verdict that the printed numbers differ.
 const text=String(value??'').replace(/[①②③④]/g,'').normalize('NFKC').replace(/[–—−]/g,'-').replace(/\s+/g,'');
 return text.match(/[-+]?\d+(?:[.,]\d+)*(?:\s*(?:kcal|kJ|MPa|kPa|Pa|kWh|kW|mmAq|kg|cm|mm|m|RT|Hz|W|J|%|℃|°C|K)(?:[²³23]|\/[a-zA-Z°℃0-9·]+)?)?/g)||[];
}
const negative=value=>/아닌|옳지|틀린|틀리[는고]|잘못|적절하지|맞지/.test(String(value));
export function classify(row){
 const source=row.source||{},candidate=row.candidates?.[0]||{};
 const fields=[['지문',row.stem,source.text],...[0,1,2,3].map(i=>[`${i+1}번 보기`,row.choices?.[i],source.choices?.[i]])];
 const valueDifferences=fields.filter(([,a,b])=>JSON.stringify(valuesIn(a))!==JSON.stringify(valuesIn(b))).map(([label,a,b])=>({label,book:valuesIn(a),source:valuesIn(b)}));
 const answerConflict=!!row.printedAnswerConflict||(row.printedAnswer!=null&&source.answer!=null&&row.printedAnswer!==source.answer);
 const polarityDifference=negative(row.stem)!==negative(source.text);
 const figure=!!row.requiresImageComparison||!!source.images?.length||!!source.choiceImages?.some(a=>a.length)||/[=×÷√∑Δ∆]|그림|도면|회로|선도|그래프|특성곡선/.test([row.stem,source.text,...row.choices||[],...source.choices||[]].join(' '));
 const flags=[...(answerConflict?['인쇄 정답 충돌']:[]),...(row.printedAnswer==null?['책 정답 미확인']:[]),...(polarityDifference?['부정 지문 차이']:[]),...(valueDifferences.length?['숫자·단위 OCR 차이']:[]),...(figure?['그림·수식 직접 확인']:[])];
 let risk=row.kind==='reviewed-unresolved'?'hold':!row.source||candidate.stemScore<.6?'search':answerConflict||polarityDifference?'answer':valueDifferences.length?'values':figure?'figure':'wording';
 if(row.changedConfirmed)risk='changed';
 // Never move a low-match/held row into an automatic acceptance bucket.
 const priority={changed:0,answer:1,values:2,figure:3,wording:4,search:5,hold:6}[risk];
 return {risk,priority,flags,valueDifferences,figure,polarityDifference,fields:fields.map(([label,book,source])=>({label,book:book||'',source:source||'',same:normalized(book)===normalized(source)}))};
}
export function topicFor(row){
 const text=`${row.stem} ${row.source?.text||''}`;
 for(const [pattern,name] of [[/브라인|냉매|냉동유/,'냉매·브라인'],[/성적계수|성능계수|냉동.*사이클|엔탈피/,'냉동 사이클·선도'],[/압축기|응축기|증발기|팽창밸브/,'냉동 기기'],[/공기.*선도|습도|현열|잠열|혼합공기/,'공기 상태·부하'],[/송풍기|덕트|팬/,'송풍기·덕트'],[/배관|트랩|관경|급수|급탕/,'배관·급배수'],[/전류|전압|회로|시퀀스|전동기/,'전기·제어'],[/보일러|연소|연료/,'보일러·연소']])if(pattern.test(text))return name;
 return '기타';
}
function tokens(text){return String(text??'').match(/[\p{L}]+|\d+(?:[.,]\d+)*|\s+|[^\p{L}\p{N}\s]/gu)||[];}
export function differenceMarkup(left,right){
 const a=tokens(left),b=tokens(right);
 if(a.length*b.length>160000)return {book:escapeHtml(left),source:escapeHtml(right)};
 const table=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
 for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)table[i][j]=a[i]===b[j]?table[i+1][j+1]+1:Math.max(table[i+1][j],table[i][j+1]);
 let i=0,j=0,book='',source='';
 while(i<a.length||j<b.length){
  if(i<a.length&&j<b.length&&a[i]===b[j]){book+=escapeHtml(a[i++]);source+=escapeHtml(b[j++]);}
  else if(i<a.length&&(j===b.length||table[i+1][j]>=table[i][j+1]))book+=`<mark>${escapeHtml(a[i++])}</mark>`;
  else source+=`<mark>${escapeHtml(b[j++])}</mark>`;
 }
 return {book,source};
}
export function validateDecision(row,decision){
 if(!decision||decision.key!==row.key||decision.fingerprint!==row.fingerprint)return '원본이 바뀌었거나 다른 문항의 결과입니다.';
 if(decision.sourceId!==(row.source?.id||null))return '비교한 기존 CBT 후보가 다릅니다.';
 if(!['same','different','hold'].includes(decision.result))return '알 수 없는 검수 결과입니다.';
 if(typeof decision.note!=='string'||decision.note.length>2000)return '메모 형식이 맞지 않습니다.';
 if(decision.result!=='hold'){
  if(decision.checked!==true)return '지문·네 보기·정답표 직접 확인 표시가 필요합니다.';
  if(!Number.isInteger(decision.actualNumber)||decision.actualNumber<1)return '실제 책 문제 번호를 확인하세요.';
  if(![1,2,3,4].includes(decision.bookAnswer))return '실제 책 정답을 확인하세요.';
 }
 if(decision.result==='same'&&(decision.bookAnswer!==row.source?.answer||decision.actualNumber!==row.number))return '번호/정답 차이가 있어 동일 원문으로 확정할 수 없습니다.';
 if(decision.result==='same'&&row.risk==='search')return '유사도가 낮은 후보입니다. 다른 원문을 찾거나 보류하세요.';
 if(decision.result==='different'&&!decision.note.trim())return '교재와 다른 부분을 메모해 주세요.';
 return '';
}
