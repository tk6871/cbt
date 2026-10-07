// Apply explicit human-reviewed crops and explanations; no model inference.
import fs from 'node:fs';
const file='data/hvac-practical-restored.json';
const historyFile='data/hvac-practical-remaining-review-history.json';
if(fs.existsSync(historyFile)) throw new Error('Already applied. Review history before another apply.');
const rows=JSON.parse(fs.readFileSync(file,'utf8'));
const before=structuredClone(rows);
const get=s=>rows.find(r=>r.id===`hvac-practical-restored-${s}`);
const manifest=JSON.parse(fs.readFileSync('data/hvac-practical-remaining-video-crops.json','utf8'));
for(const crop of manifest.crops){
  const row=rows.find(r=>r.id===crop.id); if(!row)throw new Error(crop.id);
  const field=crop.role==='answer'?'answerImages':'images';
  row[field]=[...(row[field]||row.sourceImages||[])];
  if(!row[field].includes(crop.output))row[field].push(crop.output);
  row.sourceNote='사용자 제공 복원 원문 + 에듀강 공개 원문 해당 문항 사진 대조(2026-10-07). 동작 문제는 원문 영상도 확인.';
}
const updates={
  '2018-3-03':['1번: 운전 버튼을 누르면 GL 점등·RL 소등, 정지 버튼을 누르면 GL 소등·RL 점등.','MC가 여자되면 자기유지 a접점과 GL 쪽 a접점이 닫히고, RL 쪽 b접점이 열린다. 정지 버튼은 MC 전원을 끊어 접점을 원위치로 되돌린다.',['1번','GL 점등','RL 소등']],
  '2018-3-08':['1번: 정지 방향을 기준으로 위에서 본 평면도.','평면도는 사진을 정면에서 베끼는 것이 아니라 같은 정지 방향에서 위로 시선을 옮겨 본 그림이다. 위쪽으로 열린 관 끝과 반대쪽 관 끝을 구분하면 1번 보기와 일치한다.',['1번','평면도','관 끝 방향']],
  '2019-1-01':['가: 녹색 버튼으로 GL 점등·RL 소등, 적색 버튼으로 GL 소등·RL 점등.','운전하면 MC-a는 GL을 켜고 MC-b는 RL을 끈다. MC 자기유지 접점 때문에 녹색 버튼에서 손을 떼도 운전이 이어진다. 정지하면 이 상태가 반대로 돌아온다.',['가','GL 점등','RL 소등']],
  '2019-1-02':['나: 녹색 버튼으로 부저와 GL이 켜지고 RL은 꺼진다. 적색 버튼으로 부저·GL은 꺼지고 RL은 켜진다.','가 보기에는 부저 BZ가 없다. 나 보기에서 MC1 자기유지 → MC2 여자 → MC2-b 개방으로 RL이 꺼지며, 부저와 GL에는 전원이 공급된다. 정지 버튼은 이 동작을 해제한다.',['나','부저','GL','RL']],
  '2019-1-03':['3번: 원문 영상의 정지 방향에서 위로 본 배관 평면도.','두 관 끝이 보는 쪽인지 반대쪽인지 먼저 구분한다. 그다음 엘보의 꺾임과 티의 분기 위치를 따라가면 3번 보기와 일치한다. 입체 사진의 화면 방향과 평면도 시선을 혼동하지 않는다.',['3번','평면도','분기 위치']],
  '2019-2-02':['나: 녹색 버튼 후 GL·RL 모두 점등. 적색 버튼 후 GL은 소등하지만 RL은 점등을 유지한다.','나 회로에는 MC-a가 MC-b를 우회하는 연결이 있다. MC가 여자되어 b접점이 열려도 RL에는 이 a접점 길로 전원이 들어온다. 정지 후에는 MC-b가 다시 닫혀 RL을 켠다.',['나','MC-a 우회','RL 점등 유지']],
  '2019-3-02':['나: 최초 RL 점등 → 녹색 버튼 후 RL 소등·GL 점등.','MC가 켜지면 GL 쪽 a접점은 닫히고 RL 쪽 b접점은 열린다. 적색 버튼으로 MC를 끄면 a접점은 열리고 b접점은 닫혀 최초 상태로 돌아온다.',['나','RL 소등','GL 점등']],
  '2020-1-02':['가: 녹색 버튼에서 손을 떼도 RL이 계속 켜지는 자기유지 동작.','운전 버튼과 병렬인 MC-a가 닫히면 버튼을 떼도 전기가 우회해 흐른다. 그래서 계속 켜진다. 누를 때만 켜지면 인칭, 켜짐·꺼짐을 반복하면 플리커다.',['가','자기유지','MC-a']],
  '2020-2A-02':['가: 녹색 버튼 후 GL 점등·RL 소등. 적색 버튼 후 GL 소등·RL 점등.','공개 원문의 운전·정지 동작을 기준으로 한다. GL은 MC-a, RL은 MC-b를 거치므로 운전하면 GL만 켜지고 정지하면 RL만 켜진다. 나 보기처럼 RL에 접점이 없는 회로는 RL이 계속 켜져 있어 영상과 다르다.',['가','GL 점등','RL 소등']],
  '2020-2B-02':['가: 녹색 버튼을 눌렀다 떼도 RL이 계속 점등하는 자기유지 회로.','R-a가 녹색 버튼과 병렬로 연결되어 있다. R이 켜지면 R-a도 닫혀 버튼 대신 전기를 보내므로 손을 떼도 R과 RL이 계속 켜진다. 적색 버튼은 그 길을 끊는다.',['가','R-a','자기유지']],
  '2020-3-02':['가: 토글 스위치 TG를 켜면 RL과 부저 BZ가 함께 동작한다.','TG를 켜면 MC와 RL에 전원이 들어온다. 가 보기의 MC-a가 닫히면서 BZ도 켜진다. 나 보기의 BZ는 MC-b를 거치므로 TG를 켜면 오히려 꺼져 영상과 다르다.',['가','TG','RL','BZ']],
  '2020-4-06':['A: 원문 정지 방향에서 위로 본 배관 평면도.','평면도는 정면에서 보던 배관을 위에서 본 모습이다. 꺾이는 방향과 관 끝이 위쪽으로 열렸는지를 구분한다. 원문 해설에서 위로 열린 오른쪽 관 끝을 표시한 그림이 A 보기와 일치한다.',['A','평면도','관 끝 방향']],
  '2022-1-02':['나: 녹색 버튼 후 GL·RL 모두 점등. 적색 버튼 후 GL 소등·RL 점등 유지.','MC-a의 우회 연결이 핵심이다. 운전 중 MC-b가 열려도 MC-a를 통해 RL 전원이 유지된다. 정지하면 MC-a는 열리지만 MC-b가 닫혀 RL을 계속 켠다.',['나','MC-a 우회','RL 점등 유지']],
  '2022-2-02':['나: 녹색 버튼에서 손을 떼도 GL·RL 모두 점등한다. 정지하면 GL만 꺼진다.','MC-a가 RL 쪽 b접점을 우회한다. 따라서 운전 중에는 a접점 길로, 정지 중에는 b접점 길로 RL에 전원이 들어간다. 가 보기에는 우회 길이 없어 운전하면 RL이 꺼진다.',['나','MC-a 우회','RL 점등 유지']],
  '2023-1-02':['나: RL은 전원 투입 때부터 계속 점등하며, 녹색 버튼으로 GL만 켜고 적색 버튼으로 GL만 끈다.','RL은 접점 없이 전원에 직접 연결되어 있어 운전·정지와 관계없이 켜진다. GL은 MC-a를 거쳐 운전 중에만 켜진다. 기존 저장 보기의 나 회로는 RL 쪽에 MC-a가 있어 원문 영상 설명과 달랐으므로, 공개 원문 동작과 설명에 맞춰 제어부 보기를 재작성했다. 원본 파일은 보존했다.',['나','RL 전원 직결','GL 운전 표시']],
};
for(const [id,[answer,explanation,keyPoints]] of Object.entries(updates))Object.assign(get(id),{answer,explanation,keyPoints,sourceNote:'사용자 제공 복원 원문·보기 + 에듀강 공개 해당 문항 동작 설명 대조(2026-10-07). 정답 글자는 유지하고 동작·접점 근거 보강.'});
get('2023-1-02').images=['assets/hvac-practical/restored/2023-1/hvac-practical-restored-2023-1-02-question-redrawn-v560.svg'];
get('2018-3-11').question='다음 영상에 나오는 장치의 이름을 쓰시오.';
get('2018-3-12').question='원문 동작 영상에서 화살표가 가리키는 장치의 이름을 쓰시오. 사진에 장치명이 인쇄되어 있어 참고 사진은 답안에서만 표시한다.';
get('2020-2A-04').question='원문 동작 영상에서 지시한 장치의 명칭과 사용목적을 쓰시오. 사진에 장치명이 인쇄되어 있어 참고 사진은 답안에서만 표시한다.';
for(const id of ['2019-1-04','2020-4-05'])get(id).question='헤더 그림에서 하부 배출 배관에 설치된 밸브 (가)의 역할을 쓰시오. 상부 우측 밸브가 아니라 헤더 아래쪽 배출 밸브를 대상으로 한다.';
get('2019-1-05').question='다음 영상을 보고 감온통의 역할을 쓰시오.';
get('2020-2A-03').question+=' 검은색 원통형 저장 용기를 대상으로 하며, 파란색 작은 부품이 아니다.';
get('2019-3-12').question='사진과 원문 동작 영상을 보고 ① 장치의 명칭 ② 설치 목적 ③ 두 개를 동시에 설치하는 이유를 쓰시오.';
get('2019-2-06').question='원문 동작 영상에서 드릴 작업자가 안전상 잘못한 점 두 가지를 쓰시오.';
get('2020-1-09').question='증발압력조정밸브(EPR)의 설치 목적과 설치 위치를 쓰시오. 하나의 압축기에 서로 다른 온도의 증발기 두 대가 연결된 경우를 기준으로 한다. 원문 (가)~(라) 위치 표시는 동작 영상에서 확인할 수 있다.';
get('2020-1-09').answer='① 증발압력이 설정값 이하로 내려가는 것을 방지한다. ② 고온 증발기의 출구측, 원문 보기 (나)에 설치한다.';
get('2020-1-09').explanation='압력과 증발온도는 함께 변한다. EPR은 고온 증발기 출구에서 냉매가 빠져나가는 양을 조절해 그 증발기의 압력이 너무 낮아지지 않게 한다. 따라서 저온 증발기와 같은 압축기를 써도 고온 쪽은 더 높은 증발온도를 유지할 수 있다.';
for(const row of rows)if(row.year<=2020&&row.question.includes('때'))row.question=row.question.replaceAll('손을 때','손을 떼').replaceAll('버튼을 눌렀다가 때','버튼을 눌렀다가 떼');
const changes=rows.flatMap((updated,i)=>JSON.stringify(updated)===JSON.stringify(before[i])?[]:[{id:updated.id,previous:before[i],updated,changedFields:Object.keys(updated).filter(k=>JSON.stringify(updated[k])!==JSON.stringify(before[i][k]))}]);
fs.writeFileSync(historyFile,JSON.stringify({date:'2026-10-07',baselineCommit:'4eeb5150',scope:'현재 미커밋 책 기준 보완 후에 추가 적용한 변경. 전체 정답 사실검증 완료 아님.',changes},null,2)+'\n');
fs.writeFileSync(file,JSON.stringify(rows,null,2)+'\n');
console.log(JSON.stringify({questionsChanged:changes.length,crops:manifest.crops.length,letterAnswersExpanded:Object.keys(updates).length}));
