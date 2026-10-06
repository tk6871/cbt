import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const file = 'data/hvac-practical-restored.json';
const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
const manifest = JSON.parse(fs.readFileSync('data/hvac-practical-october-scans.json', 'utf8'));
const before = new Map(rows.map(row => [row.id, structuredClone(row)]));
const historyPath = 'data/hvac-practical-october-repair-history.json';
const existingHistory = fs.existsSync(historyPath) ? JSON.parse(fs.readFileSync(historyPath,'utf8')) : null;
const baselineCommit = existingHistory?.baselineCommit || execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if (fs.existsSync(historyPath)) {
  for (const entry of existingHistory.changes) before.set(entry.id,entry.previous);
}
const byId = new Map(rows.map(row => [row.id, row]));
const set = (round, n, changes) => {
  const id = `hvac-practical-restored-${round}-${String(n).padStart(2,'0')}`;
  if (!byId.has(id)) throw new Error(`Unknown question: ${id}`);
  Object.assign(byId.get(id), changes);
};

for (const crop of manifest.crops) {
  const key = crop.role === 'answer' ? 'answerImages' : 'images';
  set(crop.round, crop.number, { [key]: [crop.output] });
}
for (const mapping of manifest.sourceMapping.filter(row => row.targetId)) {
  const row = byId.get(mapping.targetId);
  const note = `사용자 제공 해설 스캔의 인쇄 ${mapping.sourceQuestion}번과 내용 대조(2026-10-06). 문항 ID는 기존 번호 유지.`;
  if (!row.sourceNote.includes(note)) row.sourceNote += ` | ${note}`;
}

set('2021-3',2,{
  question:'다음 회로에서 차단기를 올리면 RL이 점등된다. 녹색 운전 버튼을 눌렀을 때 알맞은 동작을 고르시오. [보기] 가: RL 점등 유지·GL 점등 / 나: RL 소등·GL 점등',
  answer:'나 — 녹색 운전 버튼을 누르면 RL은 소등, GL은 점등한다.',
  explanation:'녹색 버튼을 누르면 MC 코일이 여자되어 자기유지한다. GL 쪽 MC a접점은 닫히므로 GL이 켜지고, RL 쪽 MC b접점은 열리므로 RL이 꺼진다.',
  keyPoints:['나','RL 소등','GL 점등','MC 여자'],
});
set('2021-3',3,{answer:'나 — 노즐형 취출구',explanation:'노즐형은 좁은 출구에서 공기를 한 방향으로 멀리 보내는 취출구다. 도달거리가 길고 소음이 작아 음악실·극장 등에 사용한다.',keyPoints:['나','노즐형 취출구']});
set('2021-3',8,{question:'다음 사진의 배관 부품 명칭을 왼쪽부터 차례대로 쓰시오. (부품 규격은 무시한다.)',keyPoints:['90도 엘보','부싱','캡','45도 엘보']});

set('2023-2',1,{
  question:'아래 회로에서 PB1과 PB2를 눌렀을 때 MC1·MC2·MC3와 L1·L2의 동작을 설명하시오.',
  answer:'① PB1: MC1·MC2 여자, L1 점등으로 Y기동하며 MC1 a접점으로 자기유지한다. ② PB2: MC3가 여자되고 L2가 점등한다. MC3 b접점이 열려 MC2가 소자되고 L1은 소등하며 Δ운전으로 전환한다. MC3 a접점으로 자기유지한다.',
  explanation:'PB2는 MC3를 켜는 a접점이다. Y기동 회로를 끊는 것은 PB2의 b접점이 아니라 MC3의 b접점이다. MC2(Y)와 MC3(Δ)가 동시에 켜지지 않도록 인터록을 건다.',
  keyPoints:['PB1 MC1·MC2 여자','PB2 MC3 여자','MC3 b접점으로 MC2 소자','Y-Δ 전환'],
});
set('2023-2',4,{
  question:'아래 그림에서 ① 냉매 공급 방식에 따른 증발기의 명칭을 쓰시오. ② 저압수액기에서 액냉매는 증발기로, 냉매가스는 압축기로 보내어 무엇을 방지하는지 쓰시오.',
  answer:'① 액펌프식 증발기(액순환식 증발기) ② 액압축(리퀴드백) 방지',
  explanation:'그림의 냉매액 펌프가 저압수액기의 액냉매를 증발기로 순환시킨다. 저압수액기에서 액과 가스를 분리하고 가스만 압축기로 보내므로 액압축을 막는다. 장치 하나의 명칭인 액분리기와 냉매 공급 방식의 명칭을 구별한다.',
  keyPoints:['액펌프식 증발기','액순환식 증발기','액압축 방지'],
});
set('2023-2',9,{
  question:'그림 (1)~(4)의 열운반 매체에 따른 공기조화 방식을 보기에서 골라 쓰시오. [보기] ① 수공기방식 ② 전수방식 ③ 냉매방식 ④ 전공기방식',
  answer:'(1) ④ 전공기방식 / (2) ② 전수방식 / (3) ① 수공기방식 / (4) ③ 냉매방식',
  keyPoints:['(1) 전공기','(2) 전수','(3) 수공기','(4) 냉매'],
});
set('2024-1',1,{
  question:'아래 회로는 전원 투입 시 GL이 점등한다. 수동(MAN)에서 ① PBS1을 누를 때 ② PBS2를 누를 때, 자동(AUTO)에서 ③ LS를 누를 때 ④ 타이머 설정시간 경과 후 ⑤ THR 동작 시 상태를 설명하시오.',
  answer:'① MC 여자·자기유지, RL 점등·GL 소등. ② MC 소자, RL 소등·GL 점등. ③ RY와 T 여자, RY a접점으로 MC 여자, RL 점등·GL 소등. ④ T 한시 b접점이 열려 RY와 MC 소자, RL 소등·GL 점등. ⑤ THR b접점이 운전회로를 차단해 MC·RY·T 소자, RL·GL 소등. THR a접점으로 OL 점등.',
  explanation:'수동은 PBS1과 MC a접점으로 운전·자기유지한다. 자동은 LS와 RY를 통해 MC를 켜고 타이머가 RY 회로를 끊는다. LS를 계속 누르는 동안 T는 통전될 수 있으므로 시간 경과만으로 T도 소자한다고 단정하지 않는다. THR 동작 시에는 GL 전원도 끊겨 OL만 켜진다.',
  keyPoints:['수동 MC 자기유지','자동 RY·T 여자','타이머 RY·MC 소자','THR OL 점등','THR GL 소등'],
});
set('2024-1',5,{question:'그림의 계기 명칭과 측정할 수 있는 항목 3가지를 쓰시오.',answer:'명칭: 클램프미터(후크미터). 측정 항목: 전류·전압·저항.',keyPoints:['클램프미터','전류','전압','저항']});
set('2024-1',7,{question:'습공기선도에서 가·나·다·라의 상태변화를 보기에서 골라 쓰시오. [보기] 가열·감습·가습·냉각',answer:'가: 가습 / 나: 가열 / 다: 감습 / 라: 냉각',explanation:'위로 이동하면 절대습도가 늘어 가습, 아래로 이동하면 감습이다. 오른쪽은 건구온도가 올라 가열, 왼쪽은 내려가 냉각이다.',keyPoints:['가 가습','나 가열','다 감습','라 냉각']});
set('2024-2',5,{question:'가로 10 m, 세로 10 m인 지하실 바닥의 열관류율이 0.5 W/(m²·℃), 실내온도 20℃, 지중온도 8.2℃이다. 바닥 손실열량(W)을 구하시오.'});
set('2024-3',1,{question:'회로의 빈칸 ①~③에 접점 명칭을 쓰시오. PBS1을 누르면 X1이 자기유지되고, PBS2를 누르면 T가 작동하며 GL이 점등한다. 설정시간이 지나면 GL은 소등하며, PBS3를 누르면 초기 상태로 돌아간다.'});
set('2024-3',11,{answer:'가: 팬형 취출구 / 나: 아네모스탯형 취출구 / 다: 루버형 취출구',keyPoints:['가 팬형','나 아네모스탯형','다 루버형']});
set('2024-3',12,{question:'냉매 흐름이 팽창밸브 → 증발기 → (A) → 압축기인 장치에서, 사진에 해당하는 (A)의 명칭과 역할을 쓰시오.'});
set('2025-1',2,{
  question:'다음 회로는 전원 투입 시 EOCR 전원이 켜지고 GL·WL이 점등한다. ① PBS1을 누를 때 ② 타이머 설정시간 경과 후 ③ EOCR 동작 시 X·T·GL·RL·WL·BZ의 상태를 설명하시오.',
  answer:'① X·T 여자, T a접점으로 자기유지. GL 소등·RL 점등·WL 점등 유지. ② T 한시 b접점이 열려 X·T 소자. GL 점등·RL 소등·WL 점등 유지. ③ EOCR b접점이 열려 X·T 소자, GL·RL·WL 소등. EOCR a접점이 닫혀 BZ 작동.',
  explanation:'그림의 운전 코일 이름은 MC가 아니라 X다. 자기유지 접점은 T-a이며, 설정시간 후 T-b가 열려 X와 T의 전원을 끊는다. EOCR가 동작하면 운전·표시등 회로를 차단하고 별도 경보 회로를 켠다.',
  keyPoints:['X·T 여자','T a접점 자기유지','T 한시 b접점','EOCR BZ 작동'],
});
set('2025-1',3,{question:'입체 배관 그림 (가)를 위에서 본 평면도를 도시기호로 그리시오.',answer:'위에서 보면 양끝에 원형 입상관 표시가 있는 U자형 평면도다. 첨부 정답 그림의 두 표기 방식 중 하나로 그린다.',keyPoints:['가 그림','U자형 평면도','원형 입상관']});
set('2025-1',5,{question:'사진의 장치 명칭과 작동원리를 쓰시오.',answer:'명칭: 팬코일유닛(FCU). 팬으로 실내공기를 흡입하여 냉수·온수가 흐르는 코일을 통과시키고, 냉각·가열한 공기를 다시 실내로 보낸다.',keyPoints:['팬코일유닛','냉수·온수 코일','실내공기 순환']});
set('2025-1',10,{answer:'냉매 누설탐지기(가스 누설검지기)',explanation:'탐침을 배관 이음부나 밸브 주변에 대어 누설된 냉매를 감지하는 계기다. 이 사진만으로 감지 방식이 적외선식이라고 특정할 수는 없다.',keyPoints:['냉매 누설탐지기','가스 누설검지기']});
set('2025-1',12,{question:'표에서 NH₃-H₂O식과 H₂O-LiBr식 흡수식 냉동기를 비교하여 빈칸 ①~⑥을 채우시오.',answer:'① NH₃(암모니아) ② H₂O(물) ③ 있음 ④ H₂O(물) ⑤ LiBr(브롬화리튬) ⑥ 동(구리)',explanation:'암모니아-물식은 암모니아가 냉매, 물이 흡수제이며 동 대신 철계 전열관을 쓴다. 물-브롬화리튬식은 물이 냉매, LiBr이 흡수제이며 동 전열관을 사용할 수 있다. ③은 표의 냉매 독성 유무를 묻는다.',keyPoints:['NH3 냉매','H2O 흡수제','독성 있음','H2O 냉매','LiBr 흡수제','동 전열관']});
set('2025-2',1,{question:'Y-Δ 기동 회로의 빈칸 ①~③에 들어갈 기구 명칭을 쓰시오.',answer:'① MC1 ② MC2 ③ MC3',explanation:'①은 주회로 접촉기 MC1, ②는 Y 결선을 만드는 MC2, ③은 Δ 결선을 만드는 MC3 코일이다. EOCR는 이 회로 빈칸의 답이 아니다.',keyPoints:['MC1','MC2','MC3']});
set('2025-2',2,{question:'셀렉터 스위치를 MAN(수동)에 놓은 회로에서 ① PBS1을 누를 때 ② PBS2를 누를 때 MC·RY·RL·GL의 상태를 설명하시오.',answer:'① MC 여자·자기유지, RY 소자 유지, RL 점등·GL 소등. ② MC 소자, RY 소자 유지, RL 소등·GL 점등.',explanation:'수동에서는 PBS1과 MC a접점으로 MC 코일에 전원을 보낸다. RY 코일은 AUTO 쪽 회로에 있으므로 수동 운전에서 함께 여자되지 않는다.',keyPoints:['MC 여자','RY 소자','RL 점등','GL 소등','정지 시 RL 소등·GL 점등']});
set('2025-2',3,{question:'습공기선도에서 A → B로 상태가 변할 때 엔탈피·건구온도·절대습도·상대습도·습구온도가 각각 증가하는지 감소하는지 쓰시오.'});
set('2025-2',5,{answer:'유인유닛 방식(수공기방식). 특징: ① 실별 개별제어 가능 ② 고속 덕트를 사용하므로 덕트가 작다 ③ 유닛에 팬이 없어 별도의 전기동력이 필요 없다.',keyPoints:['유인유닛 방식','개별제어','작은 덕트','유닛에 팬 없음']});
set('2025-3',3,{question:'사진의 멀티테스터에서 다음 용도에 맞는 번호를 골라 쓰시오. 가: AAA 건전지 전압 / 나: 가정용 콘센트 전압 / 다: 도통시험 / 라: 모터 구동전류'});
set('2025-3',5,{answer:'① 환기(RA), ② 외기(OA), ③ 혼합공기, ④ 급기(SA). ①과 ②를 직선으로 연결해 그 사이에 ③을 잡고, ③에서 왼쪽 아래로 냉각·감습하여 ④로 이동한다. 실내에서 ④ → ①로 돌아온다.',explanation:'구성도의 ①은 실내에서 돌아오는 환기, ②는 외부에서 들어오는 외기다. 기존 답의 ①·② 표기가 뒤바뀌어 이를 고쳤다. 혼합점 ③은 두 공기 상태 사이에 있고, 냉각코일을 지나면 온도와 절대습도가 모두 내려간다.',keyPoints:['① 환기','② 외기','③ 혼합','④ 급기','냉각·감습']});
set('2025-3',7,{question:'표의 난방부하를 합산하여 보일러 정격출력을 구하시오. 예열부하계수와 배관부하계수는 각각 1.5이며, 인체·조명 난방부하는 0이다.',answer:'난방부하=9,000+10,000+2,000+1,000+4,000+2,500=28,500 W. 정격출력=28,500×1.5×1.5=64,125 W=64.125 kW.',explanation:'난방 열의 합 28,500 W에 예열 여유 1.5를 곱하고, 배관 여유 1.5를 한 번 더 곱한다. 조건은 두 계수를 합쳐서 1.5가 아니라 각각 1.5다. W를 kW로 바꿀 때는 1,000으로 나눈다.',keyPoints:['28,500 W','각각 1.5','64,125 W','64.125 kW']});
set('2025-3',8,{question:'산소·아세틸렌 가스용접기 사진에서 ① 녹색 호스 ② 적색 호스에 공급되는 가스를 쓰시오.',answer:'① 녹색 호스: 산소 / ② 적색 호스: 아세틸렌',keyPoints:['① 산소','② 아세틸렌']});
set('2025-3',11,{question:'사진의 신축이음쇠 명칭을 쓰시오. 큰 지름은 플랜지, 작은 지름은 나사이음으로 연결한다. 패킹을 사용하며 중·저압 온수·기름 배관에 쓰는 미끄럼형 이음쇠이다.',answer:'슬리브형 신축이음쇠(미끄럼형 신축이음쇠)',keyPoints:['슬리브형','미끄럼형','신축이음쇠']});

// Old answer screenshots with now-corrected labels are retained on disk and
// in the history, but must not show a contradictory answer in the viewer.
for (const id of ['2024-1-01','2024-3-11','2025-1-02','2025-1-10','2025-2-01','2025-2-02','2025-2-05']) {
  delete byId.get(`hvac-practical-restored-${id}`).answerImages;
}

const videoPath = 'data/hvac-practical-2021-3-video-crops.json';
if (fs.existsSync(videoPath)) {
  const video = JSON.parse(fs.readFileSync(videoPath,'utf8'));
  for (const crop of video.crops) {
    const row = byId.get(crop.id);
    row.images = [crop.output];
    const note = `에듀강닷컴 2021년 3회 공개 복원 영상 ${crop.timestamp} 그림 대조: ${video.source.url}`;
    if (!row.sourceNote.includes(note)) row.sourceNote += ` | ${note}`;
  }
  if (video.crops.some(row=>row.id.endsWith('-05'))) {
    const row = byId.get('hvac-practical-restored-2021-3-05');
    row.answerImages = before.get(row.id).answerImages || before.get(row.id).images;
  }
  if (video.crops.some(row=>row.id.endsWith('-11'))) {
    set('2021-3',11,{question:'사진의 부품 명칭(가)과 화살표가 가리키는 부분(나)의 사용목적을 쓰시오.',keyPoints:['고저압 스위치','수동복귀 버튼','원인 제거 후 리셋']});
  }
  if (video.crops.some(row=>row.id.endsWith('-07'))) {
    set('2021-3',7,{question:'사진에서 빨간 화살표가 가리키는 장치의 명칭과 역할을 쓰시오.'});
  }
}

const video2022Path='data/hvac-practical-2022-1-video-crops.json';
if(fs.existsSync(video2022Path)){
  const video=JSON.parse(fs.readFileSync(video2022Path,'utf8'));
  for(const id of new Set(video.crops.map(c=>c.id))){
    const row=byId.get(id);if(!row)throw new Error(`Unknown video question: ${id}`);
    const crops=video.crops.filter(c=>c.id===id).sort((a,b)=>a.index-b.index);
    row.images=crops.map(c=>c.output);
    const note=`에듀강닷컴 2022년1회 공개 복원 영상 ${crops.map(c=>c.timestamp).join('/')} 실제 그림·질문 대조: ${video.source.url}`;
    if(!row.sourceNote.includes(note))row.sourceNote+=` | ${note}`;
    row.question=row.question.replace('다음 영상에서 보여준','다음 사진에서 보여준').replace('다음 영상에서 보여주는','다음 사진에서 보여주는').replace('다음 영상에서 나오는','다음 사진의').replace('다음 영상에 나오는','다음 사진에 나오는').replace('다음 영상의','다음 그림의');
  }
  set('2022-1',3,{explanation:'피스톤이 왕복하면서 공기를 빨아들이고 압축한다. 사진은 냉각핀과 팬으로 열을 식히는 공냉식 왕복동 장치다.'});
  set('2022-1',4,{keyPoints:['90도 엘보','부싱','캡','45도 엘보']});
  set('2022-1',6,{question:'사진의 빨간 화살표가 가리키는 장치의 명칭과 사용목적을 쓰시오.'});
  set('2022-1',7,{keyPoints:['디스크식 증기트랩','응축수 배출','증기 손실 방지']});
  set('2022-1',9,{question:'배관 입체도 (가)와 (나)를 보고 각 그림의 엘보와 티 개수를 각각 쓰시오.',keyPoints:['가: 엘보5개·티2개','나: 엘보4개·티3개']});
  set('2022-1',12,{question:'사진의 장치 명칭을 쓰고, 냉매 충전 시 각 호스의 연결 위치를 쓰시오. (가) 청색 (나) 적색 (다) 황색',keyPoints:['매니폴드 게이지','청색: 저압측','적색: 고압측','황색: 냉매용기']});
}

const followupPath='data/hvac-practical-2022-2023-video-crops.json';
if(fs.existsSync(followupPath)){
  const video=JSON.parse(fs.readFileSync(followupPath,'utf8'));
  for(const id of new Set(video.crops.map(c=>c.id))){
    const row=byId.get(id);if(!row)throw new Error(`Unknown video question: ${id}`);
    const crops=video.crops.filter(c=>c.id===id).sort((a,b)=>a.index-b.index);
    row.images=crops.map(c=>c.output);
    const note=`에듀강닷컴 ${row.year}년${row.session}회 공개 복원 영상 ${crops.map(c=>c.timestamp).join('/')} 실제 그림·질문 대조: ${crops[0].sourceUrl}`;
    if(!row.sourceNote.includes(note))row.sourceNote+=` | ${note}`;
    row.question=row.question.replace('다음 영상에서 보여주는','다음 사진에서 보여주는').replace('다음 영상에서 보여준','다음 사진에서 보여준').replace('다음 영상에서 나오는','다음 사진의');
  }
  set('2022-2',4,{question:'사진의 배관 부품 명칭을 왼쪽부터 차례대로 쓰시오. (부품 규격은 무시한다.)',keyPoints:['부싱','45도 엘보','레듀샤','캡']});
  set('2022-2',5,{question:'사진의 빨간 화살표가 가리키는 부품의 명칭과 역할을 쓰시오.'});
  set('2022-2',8,{question:'사진의 냉동장치 명칭을 쓰고, 내부에 설치된 장치를 보기에서 모두 고르시오. [보기] 압축기·응축기·팽창밸브·증발기'});
  set('2022-2',11,{question:'사진의 빨간 화살표가 가리키는 장치의 명칭과 사용목적을 쓰시오.'});
  set('2022-2',12,{question:'사진의 ① 장치 명칭을 쓰시오. ② 오른쪽 압력게이지가 고압용인지 저압용인지 쓰시오.',keyPoints:['매니폴드 게이지','오른쪽: 고압용']});
  set('2022-3',5,{question:'사진처럼 계기의 두 리드선을 제어반의 두 지점에 대고 있다. 작업자가 어떤 측정 작업을 하는지 쓰시오.'});
  set('2022-3',6,{question:'사진의 배관 부품 명칭을 왼쪽부터 차례대로 쓰시오.',keyPoints:['부싱','캡','45도 엘보','레듀샤']});
  set('2022-3',7,{question:'사진의 빨간 화살표가 가리키는 부품의 명칭과 설치위치를 쓰시오.'});
  set('2022-3',9,{question:'사진의 빨간 화살표가 가리키는 장치의 명칭과 사용목적을 쓰시오.'});
  set('2022-3',12,{question:'사진의 전동식 2위치 밸브의 작동원리를 쓰시오.',explanation:'사진의 구동부 안에 있는 전동기가 밸브 축을 위아래로 움직여 완전 열림·완전 닫힘 두 상태를 만든다. 코일이 플런저를 직접 당기는 전자밸브와 구별한다.',keyPoints:['전자기 유도작용','전동기 구동','밸브 상하 이동','ON/OFF']});
  set('2023-1',3,{question:'사진의 부품 명칭과 사용목적을 쓰시오.'});
  set('2023-1',5,{question:'그림 (가)·(나)·(다)의 장치 명칭을 각각 쓰시오.'});
  set('2023-1',6,{question:'사진의 배관 상부에 연결된 백색 캡 부품 명칭을 쓰시오.'});
  set('2023-1',7,{question:'그림 오른쪽 끝에서 헤더 아래로 연결된 밸브 (가)의 역할을 쓰시오.'});
  set('2023-1',8,{question:'사진의 펌프 상부 배관에 설치된 주름관 이음쇠의 명칭과 설치목적을 쓰시오.'});
  set('2023-1',9,{question:'사진에서 팽창밸브와 가는 관으로 연결된 감온통(오른쪽 세로 원통)의 역할을 쓰시오.'});
  set('2023-1',11,{question:'사진의 입체 배관을 위에서 본 평면도를 그리시오. 완성 도식은 정답·채점 기준에서 확인한다.'});
}

const early2021Path='data/hvac-practical-2021-video-crops.json';
if(fs.existsSync(early2021Path)){
  const video=JSON.parse(fs.readFileSync(early2021Path,'utf8'));
  for(const id of new Set(video.crops.map(c=>c.id))){
    const row=byId.get(id);if(!row)throw new Error(`Unknown video question: ${id}`);
    const crops=video.crops.filter(c=>c.id===id).sort((a,b)=>a.index-b.index);
    row.images=crops.map(c=>c.output);
    const note=`에듀강닷컴 ${row.year}년${row.session}회 공개 복원 영상 ${crops.map(c=>c.timestamp).join('/')} 실제 그림·질문 대조: ${crops[0].sourceUrl}`;
    if(!row.sourceNote.includes(note))row.sourceNote+=` | ${note}`;
    row.question=row.question.replace('다음 영상에서 보여주는','다음 사진의').replace('다음 영상에서 보여준','다음 사진의').replace('다음 영상을 보고','다음 사진을 보고').replace('다음 영상의','다음 사진의');
  }
  set('2021-1',3,{explanation:'피스톤이 왕복하며 기체를 압축한다. 사진의 냉각핀과 팬이 열을 식히는 공냉식 왕복동 장치다.'});
  set('2021-1',5,{question:'그림 오른쪽 끝에서 헤더 아래로 연결된 밸브 (가)의 역할을 쓰시오.'});
  set('2021-1',7,{question:'사진의 ① 장치 명칭을 쓰시오. ② 냉매 충전 시 각 호스의 연결 위치를 쓰시오. (가) 청색 (나) 적색 (다) 황색',keyPoints:['매니폴드 게이지','청색: 저압측','적색: 고압측','황색: 냉매용기']});
  set('2021-1',8,{keyPoints:['릴레이','11핀','계전기','전자기력','ON/OFF']});
  set('2021-1',9,{question:'사진에서 보일러 앞에 나란히 설치된 두 장치의 ① 명칭 ② 설치목적 ③ 두 개를 동시에 설치하는 이유를 쓰시오.',explanation:'유리창으로 보일러 안의 물 높이를 확인한다. 두 수면계의 표시를 비교하면 한쪽이 막히거나 고장 나 잘못 표시되는 것을 알아낼 수 있다.',keyPoints:['수면계','보일러 내부 수위 측정','수위 오판 방지','점검 시기 확인']});
  set('2021-1',10,{question:'사진 (가)·(나)·(다)의 장치 명칭을 각각 쓰시오.'});
  set('2021-1',11,{keyPoints:['리머','관내 거스러미 제거','버 제거']});
  set('2021-2',3,{question:'사진의 빨간 사각형으로 표시된 부품의 명칭과 사용목적을 쓰시오.',explanation:'용기 안의 압력이 너무 높아지면 판이 먼저 파열되어 압력을 배출한다. 용기 자체가 터지는 위험을 줄이는 안전장치다.',keyPoints:['파열판','이상 고압','파열하여 압력 배출','위해 방지']});
  set('2021-2',4,{explanation:'A는 뒤쪽 압력을 낮춰 유지하는 감압밸브다. B는 압력이 설정값보다 높아지면 스프링 힘을 이기고 열려 압력을 배출하는 안전밸브다.',keyPoints:['A: 감압밸브','B: 스프링식 안전밸브']});
  set('2021-2',6,{question:'그림의 화살표 (가)가 가리키는 헤더 하부 밸브의 역할을 쓰시오.'});
  set('2021-2',7,{keyPoints:['릴레이','11핀','계전기','전자기력','ON/OFF']});
  set('2021-2',8,{explanation:'필터 섬유가 공기 중의 작은 입자를 걸러낸다. 고성능 여과 필터에는 HEPA(헤파)와 ULPA(울파)가 있다. ULPA는 HEPA보다 더 미세한 입자를 걸러내는 데 사용한다.'});
  set('2021-2',11,{question:'사진의 냉동장치 명칭을 쓰고, 내부에 설치된 장치를 보기에서 모두 고르시오. [보기] 압축기·응축기·팽창밸브·증발기',keyPoints:['수냉식 콘덴싱유닛','스크류식','압축기','응축기']});
}

const changes=rows.filter(row=>JSON.stringify(row)!==JSON.stringify(before.get(row.id))).map(row=>({id:row.id,changedFields:[...new Set([...Object.keys(row),...Object.keys(before.get(row.id))])].filter(key=>JSON.stringify(row[key])!==JSON.stringify(before.get(row.id)[key])),previous:before.get(row.id)}));
fs.writeFileSync(file,JSON.stringify(rows,null,2)+'\n');
fs.writeFileSync('data/hvac-practical-october-repair-history.json',JSON.stringify({date:'2026-10-06',version:'5.5',baselineCommit,note:'원문·이전 답안 보존용. 자동 사실 검증 결과가 아니라 개별 원문 대조 후의 교정 기록.',changes},null,2)+'\n');
console.log(JSON.stringify({changedQuestions:changes.length,figureCrops:manifest.crops.length}));
