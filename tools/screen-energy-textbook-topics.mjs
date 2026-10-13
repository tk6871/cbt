// Initial screening from the book-first index, NOT the existing CBT/midterm bank.
// These are search candidates, never approval to publish or delete questions.
import fs from 'node:fs';
const input=JSON.parse(fs.readFileSync('work/energy-book-scope/book-first-questions.json'));
const topics=[
 [1,'집진장치',/집진|사이클론|스크러버|백\s*필터/],
 [2,'열역학 제1법칙·내부에너지',/내부에너지|제\s*1\s*법칙|에너지\s*보존|열량.*외부.*일|외부.*일.*열량/],
 [3,'급수처리·탈기·철·망간 제거',/탈기|폭기|기폭법|철.*망간|망간.*철|급수.*가스|용존산소|탄산가스.*제거/],
 [4,'고체·액체·기체 연료의 특징',/(기체연료|기체\s*연료|고체연료|고체\s*연료|액체연료|액체\s*연료|가스버너|가스\s*버너).*(장점|단점|특징|설명|연소방법)/],
 [5,'연소실 온도 영향',/연소실.*온도|연소온도.*(영향|요인|높|낮)|연소\s*온도.*(영향|요인|높|낮)/],
 [6,'상당증발량·관련 계산',/상당증발|증발계수|보일러.*마력|보일러.*1\s*마력/],
 [7,'자동제어 약호',/약호|약어|자동제어.*기호|STC|ACC|FWC|FDC/],
 [8,'보염장치·윈드박스',/보염|스테빌|윈드박스|윈드\s*박스|에어레지스터|에어\s*레지스터/],
 [9,'가용전',/가용전|가용마개/],
 [10,'신축이음',/신축이음|신축\s*이음|스위블|벨로즈.*이음|슬리브.*이음|루프.*이음/],
 [11,'스케줄 번호',/스케[줄쥴]/],
 [12,'인터록',/인터록|인터로크|인터락|InterLock/i],
 [13,'매연 취출·CO₂ 분석 관련',/매연|수트\s*블로|슈트\s*블로|그을음|soot|가스분석|가스\s*분석|오르자트/i],
 [14,'증기트랩',/트랩/],
 [15,'수압시험',/수압시험|수압\s*시험/],
 [16,'증기난방 응축수 환수방식',/진공환수|기계환수|중력환수|자연환수|응축수.*환수|환수.*응축수/],
 [17,'급수 pH·청관제·약품',/pH|p\s*H|청관제|알칼리처리|알칼리\s*처리|인산염|수산화나트륨|가성소다|약품.*급수|급수.*약품/],
 [18,'가성취화',/가성취화|가성\s*취화/],
 [19,'역화',/역화|백파이어|백\s*파이어/],
 [20,'도시가스 배관 표시·고정',/(가스|연료).*배관.*(표시|고정|지지)|배관.*(가스명|최고사용압력|흐름방향)/],
];
const rows=input.rows.map(q=>{
 const stem=String(q.stem??'').replaceAll(' ', '');
 const matches=topics.filter(([,title,re])=>re.test(q.stem??'')||re.test(stem)).map(([id])=>id);
 return{...q,topicCandidates:matches};
});
fs.writeFileSync('work/energy-book-scope/book-first-topic-candidates.json',JSON.stringify({source:input.source,rows},null,2)+'\n');
const result={date:'2026-10-13',source:input.source,method:'교재1680슬롯의 OCR 질문부만20주제 탐색어로 1차 검색. 기존 CBT/179문항/정답으로 제한하지 않음. 후보는 포함 확정이 아님.',
 counts:{slots:rows.length,located:rows.filter(q=>!q.missing).length,missing:rows.filter(q=>q.missing).length,
 candidateSlots:rows.filter(q=>q.topicCandidates.length).length},
 topics:topics.map(([topic,title])=>({topic,title,candidates:rows.filter(q=>q.topicCandidates.includes(topic)).map(q=>({year:q.year,session:q.session,number:q.number,pdfPage:q.pdfPage}))})),
 limits:['탐색어만으로 최종 포함/제외하거나 정확한 예상문제 수를 확정하지 않음.',
 '같은 문제가 여러 주제 후보에 들어갈 수 있어 주제별 합계와 고유 후보 수는 다름.',
 '숫자/수식/그림/OCR 누락·본문/보기 혼합을 원문으로 확인해야 함.',
 '2번은 내부에너지뿐 아니라 터빈 등 관련 유형도 검색되어 실제 메모 범위와 추가 구분해야 함.',
 '13번 CO₂/매연 메모는 의도가 불명확하여 가스분석 후보까지 넓게 검색했으며 확정 출제 범위가 아님.',
 '중복 제거·보기/정답 검증·PPT 대조 후 최종 선별은 미완료. 기존 앱 구성 변경 없음.']};
fs.writeFileSync('docs/energy-textbook-topic-screening-2026-10-13.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({counts:result.counts,topics:result.topics.map(t=>({topic:t.topic,title:t.title,candidates:t.candidates.length}))},null,2));
