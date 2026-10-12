import fs from 'node:fs';
import crypto from 'node:crypto';

const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const inventoryBytes=fs.readFileSync('work/cooling-duplicate-review/inventory.json');
if(hash(inventoryBytes)!=='44725ae5768ac551aee617b7824ee8ff85753ec6fa839bd6b07bdb340f4f5614') throw Error('Exact reviewed inventory changed; do not reuse index-based decisions.');
const input=JSON.parse(inventoryBytes);
if(input.raw!==1180||input.active!==1037||input.pairs.length!==2900) throw Error('Review inventory changed; repeat the content review before applying decisions.');
const keep=new Set([47,53,65,79,81,83,103,104,112,136,145,146,147,161,165,171,177,180,181,193,209,213,219,220,221,227,234,251,256,266,267,269,271,273,278,279,281,285,286,287,288,290,294,298,299,300,302,303,304,315,317,321,324,326,330,331,333,336,337,338,339,341,343,344,345,348,349,350,353,355,356,357,359]);
const merges=new Set([...Array(360).keys()].filter(i=>!keep.has(i)));
for(const i of [365,372,377,381,382,385,398,404,418,424,452,453,464,465,501,503,527,548,552,632,658]) merges.add(i);
// Final cluster-level review also rejects indirect/transitive unsafe links.
for(const i of [...merges]) if([578,469,1011].some(n=>input.pairs[i].a===n||input.pairs[i].b===n)) merges.delete(i);
// These were found while reading the complete inventory (not by the score filter).
const extraPairs=[[518,753],[80,484],[453,850],[69,516],[94,767]];
// Direct source inspection: 123 source views on 31 sheets. Numerical conditions,
// formula glyphs, arrows, labels and the content of the registered answer were compared.
const visual=new Set([2,9,16,41,46,49,56,58,69,76,98,99,107,124,153,176,178,179,189,191,197,237,244,245,258,265,296,306,316,452,453,548,632,658]);
const issues=new Map([
 [53,'열교환기 원문의 물 흐름 화살표가 서로 다름. 같은 문장·등록 정답이어도 그림 조건 확인 전 통합 금지.'],
 [180,'2021년1회22번 원문의 물 흐름 화살표가 다른 원문과 다름. 그림 조건 확인 필요.'],
 [181,'한솔2019년3회25번 원문 분모가27로 인쇄되어427인 원문과 다름. OCR 문제만이 아니므로 보존.'],
 [213,'같은 증발압력 유지 질문에 등록 정답이 온도 작동식/정압식으로 다름. 정답 출처 대조 필요, 임의 교정하지 않음.'],
 [304,'같은 인쇄 조건에 등록 정답81.4kW/83kW가 다름. 사용 상수·해설 대조 필요, 통합하지 않음.'],
 [329,'같은 사이클 계산 계열이지만 원문 엔탈피 수치와 등록 정답4.9/4.8이 다름. 2016년2회22번은109.4/135.9/141.3이며 다른 계산 변형으로 보존. 간접 통합도 차단.'],
 [346,'같은 사이클 계산 계열이지만 원문 엔탈피 수치와 등록 정답4.9/4.8이 다름. 수치가 다른 변형이므로 통합하지 않음.'],
 [384,'같은 속도→압력 변환 질문에 등록 정답 디퓨저/임펠러가 다름. 정답 출처 대조 필요, 임의 교정하지 않음.'],
]);
const parent=input.rows.map((_,i)=>i);
function find(x){while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x]}return x}
function union(a,b){a=find(a);b=find(b);if(a!==b)parent[b]=a}
for(const i of merges){const p=input.pairs[i];if(input.rows[p.a].safety!==input.rows[p.b].safety)throw Error('Safety boundary crossed');union(p.a,p.b)}
for(const [a,b] of extraPairs) union(a,b);
const grouped=new Map();
for(const row of input.rows){const k=find(row.index);if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(row)}
const clusters=[...grouped.values()].filter(g=>g.length>1).map(g=>{
 const group='reviewed-cooling-repeat:'+g.map(r=>r.id).sort()[0];
 return {group,reason:'질문 대상·조건·등록 정답 내용이 같은 반복. 표현/띄어쓰기/보기 순서 차이만 허용.',members:g.map(r=>({ids:r.members,key:r.key})),reviewPairs:[...merges].filter(i=>g.some(r=>r.index===input.pairs[i].a)&&g.some(r=>r.index===input.pairs[i].b))};
});
const fingerprint=Object.fromEntries(['hvac','hvac-hansol'].map(key=>[key,hash(fs.readFileSync(`data/${key}.js`))]));
if(fingerprint.hvac!=='ec4e84e705901c76eea7337b2ce377b8663c5aa76909b16509ada6936db822a1'||fingerprint['hvac-hansol']!=='787e0debf32b7bbad793518d79963a97fd9e95b2398f1b358041de476939da5d')throw Error('Source bank changed: repeat review.');
const views=JSON.parse(fs.readFileSync('work/cooling-duplicate-review/sheets/index.json','utf8'));
const sourceViews=views.map(([index,path])=>({id:input.rows[index].id,path,sha256:hash(fs.readFileSync(path))}));
if(hash(JSON.stringify(sourceViews))!=='d3d4e6b4e96687f10beaba5723c10c68811e495c3b084bdd17b7f8bdd606ec1a')throw Error('Reviewed image bytes changed: inspect sources before reusing decisions.');
const reviewed={date:'2026-10-12',scope:'cooling-midterm-only',baselineCommit:'b067c6fc',inventorySha256:hash(inventoryBytes),sourceSha256:fingerprint,raw:1180,baselineActive:1037,comparedPairs:1037*1036/2,candidatePairs:2900,contentRowsReviewed:1037,manualCandidatePairsReviewed:712,sourceViewsReviewed:sourceViews.length,sourceViews,
 limits:'전체 범위 문항 목록과 질문·등록 정답을 확인하고 모든 쌍을 문자 비교했습니다. 상위712후보는 개별 내용 검토, 그림/수식/선도 언급 문항의123원문은 직접 시각 대조했습니다. 나머지 낮은 유사도 후보는 통합 근거 부족으로 보존합니다. 모든 정답 사실·현행 법규 검증이나 의미 중복 누락0의 보장은 아닙니다.',
 clusters,inventoryExtraPairs:extraPairs.map(([a,b])=>({ids:[input.rows[a].id,input.rows[b].id],reason:'전체 문항 목록에서 추가 발견. 동/동관, 과열도/흡입온도차,1일/24시간 등 같은 조건·질문·정답의 표현 차이를 개별 확인.'})),issues:[...issues].map(([i,reason])=>({pair:i,ids:[input.rows[input.pairs[i].a].id,input.rows[input.pairs[i].b].id],reason})),
 pairs:input.pairs.map((p,i)=>({index:i,a:input.rows[p.a].id,b:input.rows[p.b].id,decision:merges.has(i)?'merge':issues.has(i)?'source-review':i<712?'retain':'retain-unconfirmed',reason:issues.get(i)||(merges.has(i)?visual.has(i)?'원문 그림·수식·조건·정답 대조 후 같은 반복 확인.':'질문·조건·등록 정답 내용이 같은 반복 확인.':i<712?'수치·단위·조건·질문 대상·등록 정답 내용 차이가 있거나 동일성 확정 근거가 부족해 유지.':'낮은 유사도: 같은 학습 주제만으로 합치지 않음. 원문 유지.'),score:p.score})),
 rows:input.rows.map(r=>({id:r.id,members:r.members,index:r.index,year:r.year,session:r.session,number:r.number,text:r.text,choices:r.choices,answer:r.answer,correct:r.correct,sourceImage:r.sourceImage,images:r.images,safety:r.safety,calculation:r.calculation,chapter:r.chapter,section:r.section,group:clusters.find(g=>g.members.some(m=>m.ids.includes(r.id)))?.group||'',candidateCount:input.pairs.filter(p=>p.a===r.index||p.b===r.index).length}))};
fs.writeFileSync('data/cooling-midterm-reviewed-duplicates.json',JSON.stringify({date:reviewed.date,sourceSha256:fingerprint,clusters:clusters.map(({reviewPairs,...c})=>c)},null,2)+'\n');
fs.writeFileSync('docs/cooling-midterm-duplicate-review-2026-10-12.json',JSON.stringify(reviewed,null,2)+'\n');
console.log(JSON.stringify({clusters:clusters.length,additionalRemoved:clusters.reduce((n,g)=>n+g.members.length-1,0),approvedPairs:merges.size,issues:issues.size}));
