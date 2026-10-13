// Book-first inventory: never loads a CBT question bank. OCR is a locator only.
// Full question text stays in ignored work/. Public output contains references.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root='work/energy-book-scope';
const source=JSON.parse(fs.readFileSync(`${root}/ocr/_source.json`));
assert.equal(source.sha256,'840565d198cbbfe871b25a08e2bcb9b2d3dbdcbbadead2b2ca031308caed767d');
assert.equal(source.pages,634);
const ranges=[
 [2018,1,310,324],[2018,2,325,338],[2018,4,339,353],
 [2019,1,354,368],[2019,2,369,383],[2019,4,384,399],
 [2020,'1·2통합',400,415],[2020,3,416,430],
 [2021,1,431,446],[2021,2,447,462],[2022,1,463,478],
 [2022,2,479,493],[2022,4,494,509],[2023,1,510,525],
 [2023,2,526,541],[2023,4,542,558],[2024,1,559,573],
 [2024,2,574,588],[2025,1,589,603],[2025,2,604,618],[2025,3,619,633],
];
const pages=Array.from({length:634},(_,i)=>JSON.parse(fs.readFileSync(`${root}/ocr/page-${i+1}.json`)));
const units=[];
for(const [year,session,first,last] of ranges){
 const stream=[];
 for(let page=first;page<=last;page++)for(const side of [0,1]){
  let ordered=pages[page-1].rows.filter(r=>(r.box[0]>=.44?1:0)===side)
   .sort((a,b)=>b.box[1]+b.box[3]-a.box[1]-a.box[3]);
  const answerStart=ordered.findIndex(r=>/^정답.*회.*년/.test(r.text));
  if(answerStart>=0)ordered=ordered.slice(0,answerStart);
  stream.push(...ordered.map(r=>({...r,page,side})));
 }
 const anchors=stream.flatMap((r,i)=>{
  // The first label on PDF339 is OCR'd as '이1'. Correct only this observed
  // locator, without changing the actual scanned question or app data.
  const locator=year===2018&&session===4&&r.page===339&&r.side===0?r.text.replace(/^이1\s/,'01 '):r.text;
  const m=locator.match(/^0?(\d{1,2})(?!\d)(?:\s+|\.\s+)([가-힣a-zA-Z(Δ△0-9])/);
  return m&&+m[1]>=1&&+m[1]<=80&&r.text.length>=10&&(r.side===0?r.box[0]<.12:r.box[0]<.55)
   ?[{i,number:+m[1]}]:[];
 });
 let cursor=-1;
 for(let number=1;number<=80;number++){
  const anchor=anchors.find(a=>a.i>cursor&&a.number===number);
  if(!anchor){units.push({year,session,number,missing:true});continue;}
  cursor=anchor.i;
  const next=anchors.find(a=>a.i>cursor&&a.number===number+1);
  const rows=stream.slice(cursor,next?.i??Math.min(stream.length,cursor+100));
  // Use the first choice as the stem boundary. Merged OCR rows and formulas
  // need visual correction; counts below are not an extraction-completeness claim.
  let end=rows.findIndex((r,i)=>i>0&&/^[①②③④]/.test(r.text));
  if(end<0)end=rows.findIndex((r,i)=>i>0&&/^해[설실]/.test(r.text));
  if(end<0)end=Math.min(6,rows.length);
  units.push({year,session,number,pdfPage:rows[0].page,side:rows[0].side,
   stem:rows.slice(0,end).map(r=>r.text).join(' ').replace(/^0?\d{1,2}[ .]*/,''),rows});
 }
}
const report={date:'2026-10-13',source:{name:'에너지설비.pdf',...source},
 structure:[{kind:'theory',firstPdfPage:1,lastPdfPage:307,printedPages:'12~318'},
  {kind:'divider',firstPdfPage:308,lastPdfPage:309},
  {kind:'exam',firstPdfPage:310,lastPdfPage:633,rounds:21,questionSlots:1680},
  {kind:'colophon',firstPdfPage:634,lastPdfPage:634}],
 rounds:ranges.map(([year,session,first,last])=>({year,session,
  type:year<=2020?'기출문제':'CBT 복원문제',firstPdfPage:first,answerPdfPage:last,
  slots:80,located:units.filter(q=>q.year===year&&q.session===session&&!q.missing).length,
  missing:units.filter(q=>q.year===year&&q.session===session&&q.missing).map(q=>q.number)})),
 rows:units.map(q=>({year:q.year,session:q.session,number:q.number,pdfPage:q.pdfPage??null,
  located:!q.missing})),
 limitations:['1680은 교재에 제시된 회차별80문제 슬롯 합계이며 중복 제거/시험범위 선별 전 수량이다.',
  'OCR 위치 미확인은 교재에 문제가 없다는 뜻이 아니다. 각 문제의 정답·보기·그림 전수검증은 별도다.',
  '이 도구는 기존 CBT 데이터나 기존 중간고사179개를 읽지 않는다.',
  '앞307쪽에서 별도의 단원별 객관식 문제 모음은 확인하지 못했다. 모든 이론 예제를 객관식으로 센 수량이 아니다.']};
assert.equal(units.length,1680);
fs.writeFileSync(`${root}/book-first-questions.json`,JSON.stringify({source,rows:units},null,2)+'\n');
fs.writeFileSync('docs/energy-textbook-inventory-2026-10-13.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({rounds:report.rounds,located:report.rows.filter(q=>q.located).length},null,2));
