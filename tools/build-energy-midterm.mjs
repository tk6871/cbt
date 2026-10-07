import fs from 'node:fs';
import vm from 'node:vm';
import { energyMidtermAdditions } from './energy-midterm-additions.mjs';
import { energyMidtermBookChecks, energyMidtermDirectChecks, energyMidtermLectureReferences } from './energy-midterm-references.mjs';
import { reviewedPdfQuestions } from './energy-midterm-pdf-reviewed.mjs';
import { selections as pdfSelections } from './energy-midterm-pdf-selection.mjs';

// Manual selections from the two lecture-note lists, checked against the
// supplied professor slides/textbook. This is not an official exam paper.
const topics = [
  ['집진장치', '', [
    ['20180428', 1, 4, '전기식은 전기력으로 미세먼지를 모으므로 집진효율이 높고 압력손실은 작습니다. 고전압 설비는 필요하지만, 압력손실이 크다는 설명은 틀립니다.'],
    ['20180428', 2, 3, '사이클론은 기체를 회전시켜 먼지를 바깥쪽으로 보내는 원심력식 집진장치입니다.'],
    ['20190427', 9, 3, '벤투리 스크러버는 물을 이용하는 습식 집진장치입니다. 물 없이 먼지를 모으는 건식에 포함되지 않습니다.'],
  ]],
  ['내부에너지·열역학 제1법칙', '', [
    ['20180428', 5, 1, '받은 열에서 밖으로 한 일을 빼면 안에 남은 에너지입니다. 내부에너지 변화 = 40 − 30 = 10 kJ 증가. 여기서 일은 가스가 바깥으로 내보낸 에너지라 빼는 것입니다.'],
    ['20180428', 7, 1, '열역학 제1법칙은 에너지 보존 법칙입니다. 에너지는 없어지는 것이 아니라 열·일·내부에너지 등으로 형태가 바뀝니다.'],
    ['20170507', 17, 4, '밖으로 한 일 = 압력 × 부피 증가 = 200 × (0.6 − 0.4) = 40 kJ. 받은 열 = 내부에너지 증가 80 + 밖으로 한 일 40 = 120 kJ입니다. kPa × m³는 kJ이므로 이 단위 조합에서는 별도 환산이 필요 없습니다.'],
  ]],
  ['급수처리·탈기·철과 망간 제거', '', [
    ['20180428', 9, 3, '탈기는 물에 녹아 있는 산소·이산화탄소 같은 기체를 빼내는 처리입니다. 기체가 남으면 보일러의 부식을 일으킬 수 있습니다.'],
    ['20180428', 75, 1, '철 제거는 폭기법과 연결합니다. 물을 공기와 접촉시켜 철을 산화시키고 분리하기 쉬운 형태로 바꿉니다. 탈기는 용존기체 제거이므로 둘을 구분하세요.'],
    ['20190427', 68, 3, '폭기는 공기와 물을 접촉시키는 처리입니다. 산소를 제거하는 방법으로 고르지 않습니다. 산소 제거는 탈기와 연결합니다.'],
  ]],
  ['연료의 종류와 특징', '고체·액체·기체의 비교를 함께 확인하세요. 대표 기출은 기체연료의 저장 단점을 묻습니다.', [
    ['20180428', 13, 3, '기체연료는 연소 조절과 완전연소가 쉽지만, 저장용 설비가 필요합니다. 저장이 용이하고 설비비가 싸다는 설명은 장점으로 보기 어렵습니다.'],
    ['20200822', 4, 1, '기체연료는 배관으로 공급하거나 별도 저장 설비를 사용합니다. 수송·저장이 쉽다는 설명을 일반적인 장점으로 고르지 않습니다.'],
    ['20190921', 2, 3, '액체연료도 착화 지연 등으로 미연소 연료가 쌓이면 역화 위험이 있습니다. 역화 위험이 전혀 없다는 설명은 틀립니다.'],
    ['20120304', 17, 1, '이 기출에서 고체연료의 장점은 설비비·유지비가 저렴하다는 것입니다. 공급량과 공기량을 빠르게 조절하기 쉬운 특징은 기체연료와 구분하세요.'],
  ]],
  ['연소실 온도에 영향을 주는 인자', '', [
    ['20180428', 20, 4, '산소 농도·연료 발열량·공기비는 연소 온도와 직접 연결됩니다. 연료의 단위 중량은 이 문제에서 가장 거리가 먼 항목입니다. 공기가 지나치게 많으면 남는 공기를 데우는 데 열이 쓰여 온도가 낮아질 수 있습니다.'],
    ['20200822', 8, 4, '공기 과잉은 배기가스로 빠지는 열을 늘립니다. 공기 부족 때문에 생기는 불완전연소와 공기 과잉을 구분해야 합니다.'],
  ]],
  ['상당증발량 공식과 계산', 'kJ/kg이면 약2257, kcal/kg이면539를 사용합니다. 2256/2257의 반올림 차이는 문제의 기준을 따르세요.', [
    ['20180428', 22, 2, '상당증발량 = 실제증발량 × (증기 엔탈피 − 급수 엔탈피) ÷ 표준 증발잠열. 급수에 더해 준 열만 계산하므로 증기에서 급수를 뺍니다. 분모2256 kJ/kg은 100℃ 물1 kg을 같은 온도의 증기로 만드는 데 필요한 기준 열량이며, PPT는 반올림값2257을 씁니다.'],
    ['20180428', 57, 2, '상당증발량 = 2000 × (600 − 30) ÷ 539 ≈ 2115 kg/h. 600은 증기의 엔탈피, 30은 급수의 엔탈피입니다. 539 kcal/kg은 100℃ 물1 kg을 증기로 바꾸는 기준 열량이므로 분모에 들어갑니다.'],
    ['20190427', 25, 3, '식의 방향을 바꾸면 실제증발량 = 상당증발량 × 539 ÷ (증기 엔탈피 − 급수 엔탈피)입니다. 300 × 539 ÷ (730 − 30) = 231 kg/h. 539는 엔탈피 단위가 kcal/kg일 때 쓰는 표준 증발잠열입니다.'],
  ]],
  ['보일러 자동제어 약호', '', [
    ['20180915', 26, 4, 'STC는 증기온도제어입니다. ABC는 보일러 자동제어, ACC는 연소제어, FWC는 급수제어로 구분합니다. 증기의 압력과 온도는 서로 다른 제어 대상입니다.'],
    ['20170923', 23, 4, 'STC는 증기온도제어이지 증기압력제어가 아닙니다. 약호와 제어 대상을 연결해서 확인하세요.'],
  ]],
  ['보염장치·스테빌라이저·윈드박스', '메모의 장치명이 불명확합니다. 보염장치의 목적을 우선 연습하고 윈드박스와 같은 장치라고 단정하지 않습니다.', [
    ['20180428', 45, 4, '보염장치는 불꽃이 꺼지거나 흔들리지 않도록 안정시킵니다. 착화와 화염을 안정시키는 것이 목적이지 연소가스 체류시간을 짧게 하는 것이 목적은 아닙니다.'],
    ['20150919', 54, 3, '스테빌라이저는 화염을 안정시키는 보염장치입니다. 이 기출에서 대류식은 스테빌라이저 형식에 포함되지 않습니다. 윈드박스는 연소용 공기를 공급·분배하는 쪽과 구분하세요.'],
  ]],
  ['가용전·용융마개', '', [
    ['20180428', 48, 3, '가용전은 낮은 온도에서 녹는 납·주석 합금을 쓰는 안전마개입니다. 저수위 등으로 과열되면 합금이 녹아 위험을 알리도록 한 장치입니다.'],
  ]],
  ['신축이음 네 종류', '루프(신축곡관)·벨로즈·슬리브·스위블을 구분하세요.', [
    ['20180428', 52, 3, '2개 이상 엘보와 나사맞춤부의 회전으로 신축을 흡수하는 것은 스위블입니다. 루프는 굽힌 관, 벨로즈는 주름관, 슬리브는 미끄러지는 구조로 구분합니다.'],
    ['20150308', 43, 4, '아코디언처럼 주름진 부분이 늘고 줄어드는 이음은 벨로즈입니다. 관의 열팽창을 주름 부분에서 흡수합니다.'],
    ['20020908', 78, 2, '온도가 바뀌면 관이 늘거나 줄어듭니다. 신축이음은 이 길이 변화를 흡수하여 배관 손상을 막습니다.'],
  ]],
  ['스케줄번호 공식과 계산', '공식의 계수는 압력·응력의 단위 조합에 따라 달라지므로 이 기출의 단위를 함께 확인하세요.', [
    ['20180428', 53, 2, '허용응력 = 인장강도 ÷ 안전율 = 24 ÷ 4 = 6 kg/mm². 이 기출의 단위에서 스케줄번호 = 10 × 사용압력 ÷ 허용응력이므로 사용압력 = 120 × 6 ÷ 10 = 72 kgf/cm²입니다. 10은 이 식의 단위 조합을 포함한 계수이며, 다른 단위의 식에 무조건 붙이는 숫자는 아닙니다.'],
    ['20160508', 49, 2, '이 기출의 식은 스케줄번호 = 10 × P ÷ S입니다. P는 사용최고압력, S는 허용응력입니다. 허용응력 대신 인장강도가 주어지면 먼저 안전율로 나눕니다.'],
  ]],
  ['인터록 안전제어', '', [
    ['20180428', 62, 2, '인터록은 위험 조건이 생기면 연소를 막거나 정지시키는 안전 조건입니다. 저수위·불착화·프리퍼지는 이에 해당하지만 미분은 제어동작 용어이므로 인터록 종류로 고르지 않습니다.'],
    ['20190303', 39, 1, 'ON-OFF는 켜고 끄는 제어동작입니다. 인터록은 안전 조건이 맞지 않으면 운전을 허용하지 않는 기능이므로 같은 분류가 아닙니다.'],
  ]],
  ['수트블로워·매연취출장치', '메모의 CO₂는 별도 가스분석 내용일 수 있습니다. CO₂와 수트블로워를 하나의 장치명으로 합치지 않았습니다.', [
    ['20180428', 59, 1, '수트블로워는 전열면의 그을음을 제거합니다. 이 기출의 분사형식은 증기·공기·물이며 모래분사는 해당하지 않습니다.'],
    ['20180428', 64, 1, '그을음을 날릴 때는 떨어져 나온 그을음이 배출되도록 통풍을 확보합니다. 댐퍼를 줄여 통풍을 약하게 한다는 설명은 틀립니다.'],
    ['20200822', 55, 3, '분사관이 정해진 위치에서 회전하면서 그을음을 제거하는 것은 정치회전식입니다. 관을 빼고 넣는 이동식과 구분합니다.'],
  ]],
  ['증기트랩', '', [
    ['20190303', 62, 1, '증기트랩은 증기는 가급적 남기고 응축수를 배출하는 장치입니다. 응축수가 관에 쌓여 충격을 만드는 수격작용을 막는 데 도움이 됩니다.'],
    ['20180428', 65, 3, '이 기출에서 옳은 설치 조건은 관말부에 냉각래그를1.5 m 이상 두는 것입니다. 응축수가 많으면 기계식 트랩을 고려하고, 고장 시를 위한 바이패스관도 필요합니다.'],
  ]],
  ['수압시험', '기출·교재의 시험 기준을 연습합니다. 현행 법규를 전수 확인한 자료는 아닙니다.', [
    ['20180428', 67, 4, '물을 채우고 천천히 압력을 올린 뒤 규정 압력에서30분 유지합니다. 교재의 풀이에서는 규정 압력의6% 이상 초과하지 않도록 제어하므로, 보기④의10% 제한이 틀립니다. 이 수치는 제공 교재·과거 기출 기준입니다.'],
    ['20200606', 73, 4, '이 기출·교재의 수압시험 유지 시간은30분입니다. 실제 검사는 적용되는 설비와 검사 기준을 별도로 확인해야 합니다.'],
  ]],
  ['증기난방 응축수 환수방법', '보일러 자체의 형식 분류가 아니라 증기난방에서 응축수를 되돌리는 방법입니다.', [
    ['20180428', 68, 3, '진공환수식은 진공펌프를 이용해 응축수를 되돌립니다. 이 기출에서 응축수 환수와 증기 순환이 가장 빠른 방식은 진공환수식입니다. 자연·중력환수는 높이 차, 기계환수는 펌프를 이용합니다.'],
    ['20190427', 64, 2, '환수와 증기 순환이 빠른 방식은 진공환수식입니다. 동일한 핵심이어도 보기 순서가 달라 정답 번호는 달라집니다.'],
  ]],
  ['급수·관수 pH와 처리약품', '메모의 pH6.92와 첨가제 이름은 확정하지 않았습니다. 수업PPT는 급수6~9(적정8.5), 관수11~11.8입니다. 교재260쪽은 급수6.5~9·관수10.5~11.5로 달라 함께 암기하지 말고 수업 기준을 우선 확인하세요. 아래는 관수 약품 분류의 관련 연습입니다.', [
    ['20180428', 69, 1, '인산나트륨·탄산나트륨·수산화나트륨은 이 기출의 pH·알칼리도 조정 약품입니다. 탄닌은 슬러지 및 가성취화 방지와 연결하므로 답은 탄닌입니다. 급수의 pH 범위와 관수 약품 분류를 같은 문제로 섞지 마세요.'],
    ['20200822', 61, 4, '이 기출에서 수산화나트륨은 슬러지 조정제로 고르지 않습니다. pH·알칼리도 조정 약품과 슬러지 조정 약품의 용도를 구분합니다.'],
  ]],
  ['가성취화', '', [
    ['20180428', 71, 3, '진한 알칼리와 응력이 함께 작용하면 보일러 금속에 균열이 생길 수 있는데 이를 가성취화라고 합니다. 반드시 수면 위에서만 생긴다는 설명은 틀립니다.'],
    ['20140525', 79, 4, '이 기출에서 가성취화 방지에 쓰는 약품은 인산나트륨입니다. 교수PPT의 인산염 처리 내용과 연결합니다.'],
  ]],
  ['역화·백파이어', '', [
    ['20180428', 74, 3, '프리퍼지 부족·착화 지연·급격한 연료 공급은 미연소 연료가 쌓이게 해 역화 위험을 높입니다. 정상적으로 점화원을 사용하는 것은 역화 원인으로 고르지 않습니다.'],
    ['20150919', 71, 4, '불이 꺼진 뒤 바로 연료를 넣어 재점화하면 남은 미연소 가스 때문에 위험합니다. 먼저 충분히 환기하여 가스를 제거해야 합니다.'],
  ]],
  ['도시가스 배관 표시·고정', '표시는 가스명·최고사용압력·흐름방향입니다. 고정 간격은 교재309쪽/PPT에13 미만1 m,13~33은2 m,33 이상3 m로 적혀 있습니다. 33의 경계 중복과 mm/A 표기 차이는 교수님 확인 전 정답 문항으로 만들지 않았습니다.', [
    ['20180428', 70, 2, '배관에 표시하는 것은 사용 가스명·최고사용압력·가스 흐름방향입니다. 가스 제조일자는 이 기출의 표시 항목이 아닙니다.'],
    ['20161001', 64, 4, '최고사용압력과 최고사용온도를 구분하세요. 이 기출의 표시 항목에 없는 것은 최고사용온도입니다.'],
  ]],
];

const context = { window: {} };
vm.runInNewContext(fs.readFileSync('data/energy.js', 'utf8'), context);
const original = context.window.CBT_DATA_ENERGY;
// Preserve the first-pass 47 identities; append only reviewed, complete variants.
// Exact duplicates of text/choices/answer/figures are not appended.
const signature = q => JSON.stringify({
  text: (q.html || q.text || '').replace(/\s+/g, '').replace(/[\uE000-\uF8FF]/g, ''),
  choices: q.choices.map(c => ({ text: (c.html || c.text || '').replace(/\s+/g, '').replace(/[\uE000-\uF8FF]/g, ''), images: c.images || [] })),
  answer: q.answer, images: q.images || [],
});
const selectedSignatures = new Set();
for (const [, , selections] of topics) for (const [date, number] of selections) {
  selectedSignatures.add(signature(original.rounds.find(r => r.date === date).questions.find(q => q.number === number)));
}
const skippedDuplicates = [];
for (const [topic, date, number, answer, explanation] of energyMidtermAdditions) {
  const q = original.rounds.find(r => r.date === date)?.questions.find(q => q.number === number);
  if (!q || q.answer !== answer || q.choices.length !== 4 || explanation.length < 35) throw new Error(`추가문항 검증 실패: ${date}/${number}`);
  const key = signature(q);
  if (selectedSignatures.has(key)) { skippedDuplicates.push({ topic, date, number }); continue; }
  selectedSignatures.add(key);
  topics[topic - 1][2].push([date, number, answer, explanation]);
}
const used = new Set();
const rows = [];
const bookChecks = new Map(energyMidtermBookChecks.map(check => [`${check.date}:${check.number}`, check]));
const directChecks = new Map(energyMidtermDirectChecks.map(check => [check.key, check.topic]));
const consumedDirectChecks = new Set();
const rounds = topics.map(([title, note, selections], index) => ({
  id: `school-energy-topic-${index + 1}`,
  year: 2026, session: `출제주제 ${index + 1}`, date: '20261007',
  sortKey: String(100 - index), title: `${String(index + 1).padStart(2, '0')}. ${title}`,
  kind: 'school-midterm', subjects: ['에너지설비'],
  questions: selections.map(([date, number, answer, explanation], i) => {
    const round = original.rounds.find(r => r.date === date);
    const q = round?.questions.find(q => q.number === number);
    if (!q || q.answer !== answer) throw new Error(`원문/정답 불일치: ${date}/${number}`);
    const id = `school-energy-${round.id}:${number}`;
    if (used.has(id)) throw new Error(`중복 문제: ${id}`);
    used.add(id);
    const images = [...(q.images || []), ...q.choices.flatMap(c => c.images || [])];
    for (const image of images) if (!fs.existsSync(image)) throw new Error(`누락 이미지: ${image}`);
    const bookCheck = bookChecks.get(`${date}:${number}`);
    if (bookCheck && bookCheck.answer !== answer) throw new Error(`교재 정답 불일치: ${date}/${number}`);
    const lectureReference = energyMidtermLectureReferences[index];
    const directTopic = directChecks.get(`${date}:${number}`);
    if (directTopic && directTopic !== index + 1) throw new Error(`출제 메모 주제 불일치: ${date}/${number}`);
    if (directTopic) consumedDirectChecks.add(`${date}:${number}`);
    const midtermMatch = directTopic ? 'direct' : 'related';
    rows.push({ topic: index + 1, title, note, midtermMatch, lectureReference, bookCheck, sourceRound: round.title, date, number, answer, source: q.source, images });
    const clean = value => typeof value === 'string' ? value.replace(/[\uE000-\uF8FF]/g, '') : value;
    return {
      ...q, number: i + 1,
      text: clean(q.text), html: clean(q.html),
      choices: q.choices.map(choice => ({ ...choice, text: clean(choice.text), html: clean(choice.html) })),
      // Stable, school-only identity shared by topic drills and 20-question tests.
      _originRoundId: `school-energy-${round.id}`, _originalNumber: number,
      _subject: '에너지설비', sourceQualification: `${round.year}년 ${round.session} 에너지관리산업기사 ${number}번`,
      sourcePage: `${round.year}년 ${round.session} · 원문 ${number}번 · ${directTopic ? '시험범위' : '주제 관련 추가 예상'}${bookCheck ? ` · 교재${bookCheck.printedPage}쪽 대응 확인` : ''}`,
      bookVerified: Boolean(bookCheck),
      midtermMatch,
      teacherHint: [note, lectureReference].filter(Boolean).join('\n\n'),
      explanation, explanationHtml: '', additionalExplanations: [],
      explanationType: 'teacher-material-reference',
      explanationProvenance: 'lecture-notes-ppt-textbook-selection',
      explanationBasis: `${bookCheck ? `교재${bookCheck.printedPage}쪽의 질문·보기·정답을 대조했습니다. ` : '기존 CBT의 관련 유형 연습입니다. '}${lectureReference} 확정 시험문제 예측은 아닙니다.`,
    };
  }),
}));
const catalog = { key: 'energy-midterm', name: '에너지설비 중간고사', shortName: '에너지 중간고사', rounds };
if (consumedDirectChecks.size !== directChecks.size) throw new Error('직접 대응 목록에 선별되지 않은 문항이 있습니다.');
// Only the human-reviewed subset is published; never copy OCR review rows.
const pdfSelectionMap = new Map(pdfSelections.map(s => [s.key, s]));
const existingQuestions = new Map(rounds.flatMap(r => r.questions).map(q => [q._originRoundId.replace('school-energy-energy-industrial-', '') + ':' + q._originalNumber, q]));
const pdfDuplicateRepresentatives = new Map();
const pdfLedger = [];
for (const [key, text, answer, explanation, prior, matchKind] of reviewedPdfQuestions) {
  const sel = pdfSelectionMap.get(key);
  if (!sel || ![1,2,3,4].includes(answer) || explanation.length < 35) throw new Error(`PDF 검토 항목 오류: ${key}`);
  const asset = `assets/energy-midterm/questions/${key}.webp`;
  if (!fs.existsSync(asset)) throw new Error(`PDF 업스케일 이미지 없음: ${key}`);
  let priorQuestion;
  if (prior) {
    const [date, number] = prior.split(':');
    priorQuestion = original.rounds.find(r => r.date === date)?.questions.find(q => q.number === Number(number));
    if (!priorQuestion) throw new Error(`반복 근거 원문 없음: ${key}/${prior}`);
  }
  const exactKey = matchKind === 'exact' ? prior : undefined;
  let q = exactKey && (existingQuestions.get(exactKey) || pdfDuplicateRepresentatives.get(exactKey));
  let disposition = q ? 'merged-existing-or-repeat' : 'new-variant';
  if (q && q.answer !== answer) throw new Error(`동일보기 정답 불일치: ${key}`);
  if (!q) {
    const r = rounds[sel.topic - 1];
    const midtermMatch = [5,13,17].includes(sel.topic) || key === '2021-1-55' ? 'related' : 'direct';
    q = {
      number: r.questions.length + 1, text, html: '', images: [],
      // Answers are selected by the four buttons below the original image.
      // No unverified OCR choice strings or guessed image hitboxes.
      choices: Array.from({length:4}, () => ({text:'',html:'',images:[]})), answer,
      _originRoundId: `school-energy-pdf-${sel.year}-${sel.session}`,
      _originalNumber: sel.number, _subject:'에너지설비',
      sourceQualification:`${sel.year}년 ${sel.session}회 에너지 교재 복원 ${sel.number}번`,
      midtermMatch, teacherHint:[topics[sel.topic-1][1], energyMidtermLectureReferences[sel.topic-1]].filter(Boolean).join('\n\n'),
      explanation, explanationHtml:'', additionalExplanations:[],
      explanationType:'teacher-material-reference', explanationProvenance:'visually-reviewed-textbook-pdf',
      explanationBasis:`교재${sel.page + 11}쪽의 원문·보기와 교재 정답표를 대조한 연습 해설입니다. 현행 법규 전수 검증이나 확정 시험문제 예측은 아닙니다.`,
    };
    r.questions.push(q);
    used.add(`${q._originRoundId}:${q._originalNumber}`);
    if (exactKey) pdfDuplicateRepresentatives.set(exactKey, q);
  }
  q.midtermPdfSources ||= [];
  q.midtermPdfSources.push({year:sel.year,session:sel.session,number:sel.number,pdfPage:sel.page,printedPage:sel.page+11});
  q.sourceImage = asset; q.imageOnly = true; q.bookVerified = true;
  if (prior) {
    q.midtermPriorSource = `${prior.slice(0,4)}년 CBT ${prior.split(':')[1]}번`;
    q.midtermRepetitionKind = matchKind;
    q.midtermPriorKey = prior;
  }
  q.midtermPriority = q.midtermMatch === 'related' ? 'related' : prior ? 'repeat' : 'recent';
  const label=q.midtermPriority === 'repeat' ? '교재·CBT 반복 예상' : q.midtermPriority === 'recent' ? '교재2021~2025년 예상' : '추가 예상·질문 취지 미확정';
  q.sourcePage=`${sel.year}년${sel.session}회 ${sel.number}번 · 교재${sel.page+11}쪽 대응 확인 · ${q.midtermMatch==='direct'?'시험범위':'추가 예상'} · ${label}`;
  if (q.midtermPriorSource) q.sourcePage += ` · ${q.midtermPriorSource}${matchKind==='reordered'?'(보기 순서 다름)':matchKind==='variant'?'(보기·조건 변형)':''}`;
  pdfLedger.push({key,topic:sel.topic,pdfPage:sel.page,printedPage:sel.page+11,answer,prior,matchKind,disposition,questionId:`${q._originRoundId}:${q._originalNumber}`,asset});
}
// Keep the selection ledger in sync with the actual unique question bank.
const finalQuestions = rounds.flatMap(r=>r.questions);
// Read and classified numerical questions; never guess from digits/OCR alone.
// Other numerical types remain available in full/topic practice, but the mock
// takes calculations only from the two topics specified by the user (6 and 11).
const calculationIds = new Set([
  '20180428:5','20170507:17','20020310:39','20020908:30','20020908:39',
  '20030316:38','20040905:32','20120304:27','20130310:34','20170305:6',
  '20180428:57','20190427:25','20160306:23','20160508:26','20160508:51','20180428:53',
]);
const calculationPdfIds = new Set(['2022-1:2','2021-1:10','2021-2:62','2021-1:55','2022-1:43','2022-2:69']);
for (const q of finalQuestions) {
  const legacyId=q._originRoundId.replace('school-energy-energy-industrial-','')+':'+q._originalNumber;
  const pdfId=q._originRoundId.replace('school-energy-pdf-','')+':'+q._originalNumber;
  q.midtermCalculation=calculationIds.has(legacyId)||calculationPdfIds.has(pdfId);
}
for (const q of finalQuestions) q.midtermPriority ||= q.midtermMatch === 'direct' ? 'note' : 'related';
const priorityCounts = Object.fromEntries(['repeat','recent','note','related'].map(k=>[k,finalQuestions.filter(q=>q.midtermPriority===k).length]));
const pendingPdf = pdfSelections.filter(s => !reviewedPdfQuestions.some(r=>r[0]===s.key));
fs.writeFileSync('data/energy-midterm.js', `// Generated by tools/build-energy-midterm.mjs. Source bank is unchanged.\nwindow.CBT_DATA_ENERGY_MIDTERM = ${JSON.stringify(catalog, null, 2)};\n`);
fs.writeFileSync('data/energy-midterm-selection.json', JSON.stringify({ date: '2026-10-07', scope: 'practice-not-official-exam', actualExamSize: 20, topics: topics.length, questions: finalQuestions.length, directQuestions: finalQuestions.filter(q=>q.midtermMatch==='direct').length, relatedQuestions: finalQuestions.filter(q=>q.midtermMatch==='related').length, bookVerifiedQuestions: finalQuestions.filter(q=>q.bookVerified).length, pdfImageQuestions:finalQuestions.filter(q=>q.sourceImage).length, pdfOccurrences:pdfLedger.length, priorityCounts, pendingPdf, skippedDuplicates, selections: rows, pdfSelections:pdfLedger }, null, 2) + '\n');
console.log(`에너지설비 중간고사: ${topics.length}주제 / ${finalQuestions.length}고유 기출 / PDF원문${finalQuestions.filter(q=>q.sourceImage).length} / 후기출처${pdfLedger.length} / 우선분류${JSON.stringify(priorityCounts)}`);
