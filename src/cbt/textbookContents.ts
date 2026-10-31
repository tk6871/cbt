import type {TextbookEntry,TextbookKey} from './textbookPages';
import {compareBookPages,textbookWorkedExamples} from './textbookPages';
export type BookContentsNode={id:string;book:TextbookKey;title:string;from?:string;to?:string;prefix?:string;pages?:string[];keywords?:string[];children?:BookContentsNode[];note?:string};
type Chapter=[string,Array<[string,number,number?]>,number?];
const keywords=(title:string):string[]=>{
 const rules:Array<[RegExp,string[]]>=[
  [/제빙|동결/,['급속동결','급속냉동','급랭','대용량','동결장치','동결시간','에어블라스트','브라인동결','식품냉동']],
  [/압축기/,['대용량','대형','터보','원심','스크루','왕복동','컴프레서']],
  [/냉매선도/,['몰리에르','모리엘','몰리엘','p-h','압력엔탈피','건조도']],
  [/냉동 사이클/,['COP','성적계수','성능계수','카르노','다단압축','냉동효과']],
  [/공기의 성질/,['습공기','습공기선도','절대습도','상대습도','엔탈피']],
  [/냉매와 브라인/,['냉동유','암모니아','프레온','2차냉매','냉매조건']],
  [/부하/,['현열','잠열','열관류','침입열','저장품','열량']],
  [/배관|공작/,['스케줄번호','신축이음','익스팬션','트랩','관경']],
  [/연소/,['집진장치','연료','매연','보염기','윈드박스','역화']],
  [/수질/,['급수처리','탈기','철분','망간','가성취화','pH']],
  [/자동제어|제어계|시퀀스/,['인터록','STC','증기온도제어','압력제어','자기유지']],
  [/에너지 관리/,['상당증발량','환산증발량','효율','열정산']],
 ];return rules.filter(([r])=>r.test(title)).flatMap(([,words])=>words);
};
function hansolPart(volume:number,title:string,chapters:Chapter[]):BookContentsNode{
 const p=(n:number)=>`${volume}-${n}`;
 return {id:`hansol-part-${volume}`,book:'hansol',title:`${volume}과목 · ${title}`,prefix:`${volume}-`,children:chapters.map(([name,sections,practice],i)=>{
  const end=chapters[i+1]?.[1][0][1];const chapterTo=end?p(end-1):undefined;
  const children:BookContentsNode[]=sections.map(([section,from,core],j)=>{
   const next=sections[j+1]?.[1]??practice??end;const to=next?p(next-1):undefined;
   return {id:`hansol-${volume}-${i+1}-${j+1}`,book:'hansol',title:section,from:p(from),to,prefix:`${volume}-`,keywords:keywords(section),children:[
    {id:`hansol-${volume}-${i+1}-${j+1}-body`,book:'hansol',title:'본문·예제',from:p(from),to:core?p(core-1):to,prefix:`${volume}-`},
    ...(core?[{id:`hansol-${volume}-${i+1}-${j+1}-core`,book:'hansol' as const,title:'핵심예상문제',from:p(core),to,prefix:`${volume}-`}]:[]),
   ]};
  });
  if(practice)children.push({id:`hansol-${volume}-${i+1}-practice`,book:'hansol',title:'실전예상문제',from:p(practice),to:chapterTo,prefix:`${volume}-`});
  return {id:`hansol-chapter-${volume}-${i+1}`,book:'hansol',title:`${String(i+1).padStart(2,'0')} ${name}`,from:p(sections[0][1]),to:chapterTo,prefix:`${volume}-`,keywords:keywords(name),children};
 })};
}
// Page labels read from the user's book contents, not inferred exam subjects.
// An unknown last page stays unknown; it is never invented from an exam year.
export const bookContents:Record<TextbookKey,BookContentsNode[]>={
 hansol:[
  hansolPart(1,'공기조화 설비',[
   ['공기조화 이론',[['공기조화 기초',10,15],['공기의 성질',17,25]],29],
   ['공기조화 계획',[['공기조화 방식',40,58],['공기조화 부하',63,70],['난방설비',76,90],['클린룸설비',95,100]],101],
   ['공조기기 및 덕트',[['공기조화기기',128,135],['열원기기',144,152],['덕트 및 부속설비',156,164]],169],
   ['공조프로세스 분석',[['공조프로세스 분석',198,207]],210],
   ['공조설비운영 관리',[['공조설비운영 관리',214,224]],225],
   ['보일러설비 운영',[['보일러설비 시운전',228,237]],239],
  ]),
  hansolPart(2,'냉동냉장 설비',[
   ['냉동이론',[['냉동의 기초와 원리',10,18],['냉매와 브라인',22,32],['냉매선도와 냉동 사이클',37,44],['각종 냉동 사이클',48,60],['기초열역학',64,74],['열역학의 법칙',76,84]],87],
   ['냉동장치의 구조',[['압축기 구성 기기와 특징',112,127],['응축기 구성 기기와 특징',132,142],['증발기 구성 기기와 특징',147,158],['냉동장치 구성 기기(팽창밸브)',162,168],['냉동장치 구성 기기(부속기기)',172,178],['냉동장치 구성 기기(제어기기)',185,190]],192],
   ['냉동장치의 응용과 안전관리',[['냉동장치의 응용(제빙 및 동결장치)',218,222],['냉동장치의 응용(열펌프 및 축열장치)',224,230],['냉동장치의 응용(흡수식 냉동장치)',232,234],['운영 안전관리(관련법규 발췌)',237,256]],258],
   ['냉동냉장 부하계산',[['냉동냉장부하 계산',270,272]],273],
   ['냉동설비의 설치',[['냉동설비의 설치',276,279]]],
   ['냉방설비운영',[['냉방설비의 설치',282]],286],
  ]),
  hansolPart(3,'공조냉동 설치·운영',[
   ['배관재료 및 공작',[['배관재료',12,25],['배관공작',35,43],['배관제도',46,57]],60],
   ['배관관련설비',[['급수설비',76,89],['급탕설비',93,102],['배수통기설비',106,118],['난방설비',122,130],['공기조화설비',137,142],['가스설비',147,159],['냉동 및 냉각설비',162,167],['압축공기설비',170,175]],176],
   ['설비적산',[['설비적산',206,207]],208],
   ['공조급배수설비 설계도면작성',[['공조급배수설비 설계도면작성',212,221]],222],
   ['공조설비점검 관리',[['공조설비점검 관리',226]]],
   ['유지보수공사 안전관리',[['유지보수공사 안전관리',230,241]]],
   ['교류회로',[['교류회로',244,258]]],
   ['전기계측',[['전기계측',274,279]]],
   ['전기기기',[['전기기기',286,317]]],
   ['제어계의 구성과 분류',[['제어계의 구성과 분류',336,344]]],
   ['제어용 기기',[['제어용기기',358,363]]],
   ['시퀀스 제어',[['시퀀스 제어',368,376]]],
  ]),
  {id:'hansol-mock',book:'hansol',title:'부록 · 핵심 모의고사',prefix:'4-',note:'정상 열람한 교재 목차의 15회 쪽번호를 사용합니다. 문제 연결 수는 별도로 표시합니다.',children:[7,20,33,46,58,71,84,96,109,122,134,147,160,172,184].map((from,i,starts)=>({id:`hansol-mock-${i+1}`,book:'hansol',title:`제${i+1}회 핵심 모의고사`,from:`4-${from}`,to:`4-${(starts[i+1]||196)-1}`,prefix:'4-'}))},
  {id:'hansol-latest',book:'hansol',title:'부록 · 최신경향문제',prefix:'5-',note:'정상 열람한 교재 목차의 2023~2025년 회차별 쪽번호입니다.',children:[4,16,27,39,51,64,75,86,98].map((from,i,starts)=>({id:`hansol-latest-${2023+Math.floor(i/3)}-${i%3+1}`,book:'hansol',title:`${2023+Math.floor(i/3)}년 ${i%3+1}회`,from:`5-${from}`,to:`5-${(starts[i+1]||109)-1}`,prefix:'5-'}))},
 ],
 energy:[
  {id:'energy-theory',book:'energy',title:'이론편 · 제공 PDF 본문 순서',note:'스캔에 앞쪽 목차가 없어 본문의 확인된 장 제목으로 구성했습니다. 객관식과 본문 풀이 예제를 구분합니다.',children:[
   ['열의 기초',12,39],['보일러 연소설비 관리',40,81],['보일러 에너지 관리',82,99],['냉동설비 운영',100,103],['요로',104,114],['보일러 배관설비',115,141],['보일러 부속설비',142,178],['보일러 부대설비',179,211],['보일러 설비운영',212,229],['보일러 운전',230,247],['보일러 수질 관리',248,261],['보일러 자동제어 관리',262,273],['보일러 안전관리',274,287],['보일러 안전장치 정비',288,291],['에너지 관계 법규',292,318],
  ].map(([title,from,to],i)=>({id:`energy-theory-${i}`,book:'energy',title:String(title),from:String(from),to:String(to),keywords:keywords(String(title))}))},
  {id:'energy-exams',book:'energy',title:'기출·CBT 복원문제',children:[
   [2018,'1',321,335],[2018,'2',336,349],[2018,'4',350,364],[2019,'1',365,379],[2019,'2',380,394],[2019,'4',395,410],[2020,'1·2통합',411,426],[2020,'3',427,441],
   [2021,'1',442,457],[2021,'2',458,473],[2022,'1',474,489],[2022,'2',490,504],[2022,'4',505,520],[2023,'1',521,536],[2023,'2',537,552],[2023,'4',553,569],[2024,'1',570,584],[2024,'2',585,599],[2025,'1',600,614],[2025,'2',615,629],[2025,'3',630,644],
  ].map(([year,session,from,to])=>({id:`energy-exam-${year}-${session}`,book:'energy',title:`${year}년 ${session}회${Number(year)>=2021?' CBT 복원문제':' 기출문제'}`,from:String(from),to:String(to)}))},
 ],
};
export function contentsEntries(node:BookContentsNode,entries:TextbookEntry[]):TextbookEntry[]{
 if(node.pages)return entries.filter(e=>e.book===node.book&&node.pages!.includes(e.page));
 if(!node.from){if(node.prefix)return entries.filter(e=>e.book===node.book&&e.page.startsWith(node.prefix!));return [...new Map((node.children||[]).flatMap(child=>contentsEntries(child,entries)).map(e=>[`${e.page}:${e.number}`,e])).values()];}
 return entries.filter(e=>e.book===node.book&&(!node.prefix||e.page.startsWith(node.prefix))&&compareBookPages(e.page,node.from!)>=0&&(!node.to||compareBookPages(e.page,node.to)<=0));
}
export function contentsExamples(node:BookContentsNode):typeof textbookWorkedExamples {
 if(!node.from)return [...new Map((node.children||[]).flatMap(contentsExamples).map(e=>[e.id,e])).values()];
 return textbookWorkedExamples.filter(e=>e.book===node.book&&e.pages.some(page=>compareBookPages(page,node.from!)>=0&&(!node.to||compareBookPages(page,node.to)<=0)));
}
export type ContentsRow={node:BookContentsNode;path:string[];entries:TextbookEntry[];text:string;terms:string[]};
const normalize=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/<[^>]*>/g,' ').replace(/[^\p{L}\p{N}]/gu,'');
export function contentsRows(nodes:BookContentsNode[],entries:TextbookEntry[],questionText:Record<string,string>):ContentsRow[]{
 const rows:ContentsRow[]=[];
 function walk(node:BookContentsNode,path:string[],inherited:string[]){
  const loc=contentsEntries(node,entries);const words=[...inherited,...(node.keywords||[])];
  const titles=[...path,node.title];
  rows.push({node,path,entries:loc,text:normalize([...titles,...words,...new Set(loc.map(e=>questionText[e.sourceId||'']||''))].join(' ')),terms:[...titles,...words].flatMap(s=>s.split(/[\s·()／/]+/)).map(normalize).filter(Boolean)});
  node.children?.forEach(child=>walk(child,titles,words));
 }nodes.forEach(node=>walk(node,[],[]));return rows;
}
function near(a:string,b:string):boolean{
 if(a.length<3||Math.abs(a.length-b.length)>1)return false;
 if(a.length===b.length){const dif=[...a].flatMap((ch,i)=>ch===b[i]?[]:[i]);return dif.length===1||dif.length===2&&dif[1]===dif[0]+1&&a[dif[0]]===b[dif[1]]&&a[dif[1]]===b[dif[0]];}
 const [short,long]=a.length<b.length?[a,b]:[b,a];let i=0,j=0,skipped=false;
 while(i<short.length&&j<long.length){if(short[i]===long[j]){i++;j++;}else{if(skipped)return false;skipped=true;j++;}}return true;
}
export function searchContents(rows:ContentsRow[],query:string){
 const vocabulary=[...new Set(['냉동','냉장','대용량','급속동결','선도',...rows.flatMap(r=>r.terms)])].filter(w=>w.length>=2).sort((a,b)=>b.length-a.length);
 function splitWord(word:string):string[]{
  if(word.length<4||vocabulary.includes(word))return [word];
  const pieces:string[]=[];let rest=word;
  while(rest){const part=vocabulary.find(w=>rest.startsWith(w));if(!part)return [word];pieces.push(part);rest=rest.slice(part.length);}return pieces;
 }
 const input=query.trim().split(/\s+/).map(normalize).filter(Boolean);
 const terms=[...new Set((input.length>1&&input.every(w=>w.length===1)?[input.join('')]:input).flatMap(splitWord))].slice(0,12);
 if(!terms.length)return [];
 const candidates=rows.filter(r=>r.node.from||!r.node.children?.length);
 const weights=terms.map(term=>1+Math.log(1+candidates.length/(1+candidates.filter(r=>r.text.includes(term)).length)));
 return candidates.flatMap(row=>{
  const matched=terms.flatMap((term,i)=>row.text.includes(term)?[{term,kind:'부분 일치',weight:weights[i]*2}]:row.terms.some(word=>near(term,word))?[{term,kind:'비슷한 단어',weight:weights[i]}]:[]);
  if(!matched.length)return [];
  const title=normalize([...row.path,row.node.title].join(' '));
  return [{...row,matched,score:matched.reduce((n,m)=>n+m.weight,0)+matched.filter(m=>row.terms.some(word=>word.includes(m.term))).length+matched.filter(m=>title.includes(m.term)).length*.2}];
 }).sort((a,b)=>b.matched.length-a.matched.length||b.score-a.score||a.node.id.localeCompare(b.node.id,'ko',{numeric:true}));
}
