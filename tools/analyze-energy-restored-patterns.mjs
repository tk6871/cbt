// Private OCR is a search aid, not proof of novelty or an automatic duplicate rule.
// Emits references/scores publicly; scanned question text stays in ignored work/.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root='work/energy-book-scope';
const source=JSON.parse(fs.readFileSync(`${root}/ocr/_source.json`));
assert.equal(source.sha256,'840565d198cbbfe871b25a08e2bcb9b2d3dbdcbbadead2b2ca031308caed767d');
const bankBytes=fs.readFileSync('data/energy.js');
assert.equal(crypto.createHash('sha256').update(bankBytes).digest('hex'),'3f0331ce8b779715ea96c8c5a0b6e723b345b45c539265a1eb6317f037dd3577','기존 문제은행이 바뀌어 수동 사례를 재검토해야 합니다.');
const context={window:{}};vm.runInNewContext(bankBytes.toString(),context);
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/<[^>]*>|&[^;]+;/g,' ').replace(/[^가-힣a-z0-9]/g,'');
const grams=s=>new Set(Array.from({length:Math.max(0,s.length-2)},(_,i)=>s.slice(i,i+3)));
const dice=(a,b)=>{let n=0;for(const g of a)if(b.has(g))n++;return 2*n/(a.size+b.size||1);};
const originals=context.window.CBT_DATA_ENERGY.rounds.flatMap(r=>r.questions.map(q=>({date:r.date,number:q.number,text:q.text,choices:q.choices.map(c=>c.text||c.html||''),answer:q.answer})));
assert.equal(originals.length,2640);
const old=originals.map(q=>({...q,g:grams(norm(q.text)),cg:q.choices.map(c=>grams(norm(c)))}));
const ranges=[[2021,1,431,446],[2021,2,447,462],[2022,1,463,478],[2022,2,479,493],[2022,4,494,509],[2023,1,510,525],[2023,2,526,541],[2023,4,542,558],[2024,1,559,573],[2024,2,574,588],[2025,1,589,603],[2025,2,604,618],[2025,3,619,633]];
const privateRows=[];
for(const [year,session,first,last] of ranges){
 const stream=[];
 for(let page=first;page<=last;page++){
  const p=JSON.parse(fs.readFileSync(`${root}/ocr/page-${page}.json`));
  // Scanned right-column anchors can start at x=.466, not always >=.48.
  for(const side of [0,1])for(const row of p.rows.filter(r=>(r.box[0]>=.44?1:0)===side).sort((a,b)=>b.box[1]+b.box[3]-a.box[1]-a.box[3]))stream.push({...row,page,side});
 }
 const anchors=stream.flatMap((r,i)=>{
  const m=r.text.match(/^0?(\d{1,2})(?!\d)(?:\s+|\.\s+)([가-힣a-zA-Z(Δ△0-9])/);
  const x=r.box[0];return m&&+m[1]>=1&&+m[1]<=80&&r.text.length>=10&&(r.side===0?x<.12:x<.55)?[{i,number:+m[1]}]:[];
 });
 let cursor=-1;
 for(let number=1;number<=80;number++){
  const anchor=anchors.find(a=>a.i>cursor&&a.number===number);
  if(!anchor){privateRows.push({year,session,number,missing:true});continue;}
  cursor=anchor.i;
  const next=anchors.find(a=>a.i>cursor&&a.number===number+1);
  const rows=stream.slice(cursor,next?.i??Math.min(stream.length,cursor+80));
  // Stem stops at first circled choice. Question marks are not required because
  // some stems contain a diagram/formula followed by conditions.
  let end=rows.findIndex((r,i)=>i>0&&/^[①②③④]/.test(r.text));
  if(end<0)end=rows.findIndex((r,i)=>i>0&&/^해[설실]/.test(r.text));
  if(end<0)end=Math.min(6,rows.length);
  const text=rows.slice(0,end).map(r=>r.text).join(' ').replace(/^0?\d{1,2}[ .]*/,'');
  const cg=grams(norm(text));
  const candidates=old.map(q=>({date:q.date,number:q.number,text:q.text,choices:q.choices,answer:q.answer,stemScore:dice(cg,q.g)})).sort((a,b)=>b.stemScore-a.stemScore).slice(0,3);
  privateRows.push({year,session,number,pdfPage:rows[0].page,side:rows[0].side,text,ocrRows:rows.map(r=>({text:r.text,page:r.page,box:r.box})),candidates});
 }
}
fs.writeFileSync(`${root}/restored-pattern-candidates.json`,JSON.stringify({source,rows:privateRows},null,2)+'\n');
const groups={strong:'질문 문장 강한 반복 후보',related:'관련·변형 후보',unmatched:'낮은 문자 유사도 - 신문제 미확정',missing:'OCR 질문 경계 확인 필요'};
const rows=privateRows.map(r=>({year:r.year,session:r.session,number:r.number,pdfPage:r.pdfPage??null,group:r.missing?'missing':r.candidates[0].stemScore>=.8?'strong':r.candidates[0].stemScore>=.45?'related':'unmatched',candidates:(r.candidates||[]).map(c=>({date:c.date,number:c.number,stemScore:+c.stemScore.toFixed(3)}))}));
assert.equal(rows.length,1040);
const totals=Object.fromEntries(Object.keys(groups).map(g=>[g,rows.filter(r=>r.group===g).length]));
const report={date:'2026-10-12',source:{name:'에너지설비.pdf',sha256:source.sha256,pages:634},oldBankSha256:crypto.createHash('sha256').update(bankBytes).digest('hex'),oldQuestions:old.length,restoredQuestions:1040,method:'2021~2025년13회80문제 슬롯 각각을 기존2020년 이전2640문제와 질문 문자3그램으로 비교. 0.8/0.45는 탐색 구간일 뿐 동일 수록·중복·신문제 판정이 아님. 보기는 자동 동일 판정에 사용하지 않았으며 수식/그림/OCR 오류는 점수를 낮추거나 높일 수 있음.',limits:'전체1040문항의 질문·네 보기·그림 시각 검수나 정답 검증을 완료한 통계가 아님. 낮은 유사도는 미검색/변형/오인식 가능성이 있어 신문제 수 또는 비율로 해석하지 말 것. 문제·기록·출제 필터 변경0.',groups,totals,rounds:ranges.map(([year,session,first,last])=>({year,session,firstPdfPage:first,lastPdfPage:last,...Object.fromEntries(Object.keys(groups).map(g=>[g,rows.filter(r=>r.year===year&&r.session===session&&r.group===g).length]))})),rows};
// The following 18 examples were read against the rendered book question and
// the existing bank's stem/all four choices. They are not 1,040 approvals.
const manual=[
 [2021,1,3,'repeat','질문·네 보기 일치: 석탄 공업분석'],
 [2021,2,5,'repeat','질문·네 보기 일치: 완전연소 조건'],
 [2022,1,1,'repeat','질문·네 보기 내용 일치, 보기 순서만 다름: 열과 일'],
 [2022,2,6,'repeat','질문·네 보기 내용 일치, 타아르/타르 표기 차이: 매연'],
 [2022,4,3,'repeat','질문·네 보기 일치: 증기 건도'],
 [2023,1,2,'repeat','질문·네 보기 일치: 기체연료 장점'],
 [2023,2,1,'repeat','질문·네 보기와 수치 일치: 온도 환산'],
 [2023,4,4,'repeat','질문·네 보기와 수치 일치: 중유 저위발열량'],
 [2024,1,2,'repeat','질문·네 보기 일치: SI 기본단위'],
 [2024,2,1,'repeat','질문·네 보기와 수치 일치: 오토 사이클'],
 [2025,1,1,'repeat','질문·네 보기 일치: 습증기 건도'],
 [2025,2,3,'repeat','질문·네 보기 내용 일치, 보기 순서만 다름: 제2법칙'],
 [2025,3,2,'repeat','질문·네 보기 일치: 기체연료 장점. 2023년1회2번에도 반복'],
 [2021,2,1,'variant','같은 정적가열 유형이지만 6→7kgf/cm²·kcal 조건이 600→700kPa·kJ 조건으로 바뀜. 동일 수치 문제 아님'],
 [2022,1,2,'not-found','종합 집진율 계산. 기존2640개에서 질문 유사도 및 집진율 용어로 동일 문항 미확인. 상위 자동 후보인 발전효율 계산은 다른 문제'],
 [2023,1,59,'not-found','가셋트스테이 하단부·노통 사이 최소거리. 기존2019년2회44번은 이음방법 질문으로 다름. 동일 문항 미확인'],
 [2024,1,19,'not-found','전기기기 화재 소화기 선택. 기존 소화기/화재 관련 질문을 추가 검색했으나 해당 네 보기 문항 미확인. 상위 자동 후보 온도계는 무관'],
 [2025,1,72,'not-found','유류화재의 등급. 기존2014년2회72번은 유류화재 소화설비 질문으로 다름. 해당 등급 객관식 미확인'],
];
report.manualExamples=manual.map(([year,session,number,verdict,note])=>{
 const r=rows.find(q=>q.year===year&&q.session===session&&q.number===number);
 assert.ok(r&&r.pdfPage&&r.candidates.length);
 return{year,session,number,pdfPage:r.pdfPage,verdict,note,oldCandidate:r.candidates[0]};
});
report.conclusion='옛 기출의 질문·네 보기 그대로 반복과 단위/조건 변형이 함께 확인됨. 기존2640개에 동일 문항을 못 찾은 후기 문항도 있지만 시험 역사 전체의 신문제로 확정할 수 없음. 13회차 각1개 반복 사례와 변형1·미확인4 등18개만 수동 시각 판정했고 나머지 후보 집계는 탐색용임.';
fs.writeFileSync('docs/energy-restored-patterns-2026-10-12.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({totals,rounds:report.rounds},null,2));
