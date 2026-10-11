import fs from 'node:fs';
import vm from 'node:vm';

// Independent review only: never mutate the question bank, IDs or saved answers.
const context = { window: {} };
vm.runInNewContext(fs.readFileSync('data/energy-midterm.js', 'utf8'), context);
const plain = s => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const normalize = s => plain(s).normalize('NFKC').toLowerCase().replace(/벤튜리|벤츄리/g, '벤투리').replace(/스크레버/g, '스크러버').replace(/[^가-힣a-z0-9]/g, '');
const grams = s => new Set(Array.from({ length: Math.max(0, s.length - 1) }, (_, i) => s.slice(i, i + 2)));
function similarity(a, b) {
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const v of a.size < b.size ? a : b) if ((a.size < b.size ? b : a).has(v)) common++;
  return 2 * common / (a.size + b.size);
}
const rows = [];
function row(q, id, label, midterm = false, topic = '') {
  const choices = q.choices.map(c => ({ text: plain(c.text || c.html), images: c.images || [] }));
  return { id, label, midterm, topic, text: plain(q.text || q.html), choices, answer: q.answer,
    sourceImage: q.sourceImage || null, images: q.images || [], source: q.source || '', ocr: false };
}
const hotspots = JSON.parse(fs.readFileSync('data/energy-midterm-hotspots.json', 'utf8'));
for (const round of context.window.CBT_DATA_ENERGY_MIDTERM.rounds) for (const q of round.questions) {
  const origin = `${q._originRoundId.replace(/^school-energy-/, '')}:${q._originalNumber}`;
  const r = row(q, `midterm:${origin}`, q.sourceImage ? q.sourcePage.split(' · ')[0] + ' · 교재 PDF' : q.sourceQualification, true, round.title);
  if (q.sourceImage) {
    const stem = q.sourceImage.split('/').pop().replace(/\.webp$/, '');
    const cache = `work/energy-answer-geometry/ocr/${stem}.json`;
    if (!fs.existsSync(cache)) throw new Error(`Missing local OCR geometry cache: ${cache}`);
    const ocr = JSON.parse(fs.readFileSync(cache, 'utf8')), boxes = hotspots[q.sourceImage];
    // Even populated imported text may have reordered choices; compare actual printed content.
    const top = Math.min(...boxes.map(b => b.y)) / 100;
    const recognized = ocr.rows.filter(x => x.box[3] < top + .02).map(x => x.text).join(' ').replace(/^\d+\s*/, '');
    const options = boxes.map(b => ocr.rows.filter(x => {
      const cx = (x.box[0] + x.box[2]) * 50, cy = (x.box[1] + x.box[3]) * 50;
      return cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height;
    }).map(x => x.text).join(' ').replace(/^[①②③④1-4l!@?)]\s*/, ''));
    if (recognized.length > 8 && options.every(Boolean)) {
      r.text = recognized; r.choices = options.map(text => ({ text, images: [] })); r.ocr = true;
    }
  }
  rows.push(r);
}
const prepared = rows.map(r => {
  const stem = normalize(r.text), options = r.choices.map(c => normalize(c.text));
  return { stem, grams: grams(stem), options, choiceGrams: options.map(grams),
    optionSet: options.every(Boolean) ? [...options].sort().join('|') : '',
    ordered: options.join('|'), numbers: (plain(r.text).normalize('NFKC').match(/\d+(?:[.,]\d+)?/g) || []).sort().join('|'),
    negative: /아닌|않은|않는|틀린|잘못|적합하지|옳지/.test(stem) };
});
const manualPairs = JSON.parse(fs.readFileSync('work/energy-answer-geometry/duplicate-candidates.json', 'utf8'));
const manual = new Map(manualPairs.map((p, i) => [[p.a.id.replace(/^school-energy-/, ''), p.b.id.replace(/^school-energy-/, '')].sort().join('|'), i]));
const repeatIndexes = new Set([0, 1, 2, 3, 4, 5, 7, 12]);
// Semantic pass over all 179 stems/correct contents: collect pairs missed by wording/OCR.
// Resolve by readable source labels, not mutable display positions.
const semanticSpecs = [
  [['2023년1회 26번','2002년 4회 에너지관리산업기사 61번','2025년3회 33번'],'건식이 아닌 집진장치: 사이크론/사이클론·멀티크론/멀티클론 등 표기와 보기 순서가 다릅니다.'],
  [['2018년 4회 에너지관리산업기사 3번','2023년4회 29번','2024년2회 34번'],'집진효율 비교지만 선택지에 여과식/전기식이 있는지 다릅니다. 같은 제목만 보고 정답을 복사하면 안 됩니다.'],
  [['2025년3회 17번','2002년 1회 에너지관리산업기사 39번','2013년 1회 에너지관리산업기사 34번','2021년1회 10번'],'일정 압력 팽창에서 Q=ΔU+PΔV를 쓰는 계산 유형입니다. 압력·체적·내부에너지 수치와 단위가 달라 정답도 다릅니다.'],
  [['2002년 1회 에너지관리산업기사 21번','2005년 1회 추가시험 에너지관리산업기사 33번','2014년 1회 에너지관리산업기사 14번','2021년1회 1번'],'제1법칙=에너지 보존을 묻지만 오답 보기의 내용이 다릅니다. 같은 개념의 변형인지 확인하세요.'],
  [['2002년 4회 에너지관리산업기사 21번','2004년 4회 에너지관리산업기사 27번'],'이상기체 내부에너지가 온도의 함수라는 같은 원리를 묻는 후보입니다. 질문 형식과 보기가 다릅니다.'],
  [['2003년 2회 에너지관리산업기사 21번','2020년 1·2회 통합 에너지관리산업기사 18번'],'등온과정 ΔU=0. O/0 표기와 오답 보기의 절댓값 기호 차이를 직접 비교하세요.'],
  [['2004년 4회 에너지관리산업기사 32번','2017년 1회 에너지관리산업기사 6번'],'초기 온도150℃·체적0.248→0.496·비열비1.4가 같은 단열팽창 계산입니다. 정적비열 및 정답 단위 kcal/kg↔kJ/kg 차이가 있습니다.'],
  [['2019년 2회 에너지관리산업기사 68번','2021년2회 65번'],'기폭법에서 제거하지 않는 산소를 묻는 같은 원리. 황화수소/망간 등 오답이 달라 완전 동일 문제는 아닙니다.'],
  [['2018년 2회 에너지관리산업기사 13번','2025년3회 2번','2024년2회 8번','2020년 1·2회 통합 에너지관리산업기사 10번'],'기체연료의 저장이 쉽다는 틀린 설명을 고릅니다. 운송·설비비·취급 등 정답 문장과 오답 보기가 다릅니다.'],
  [['2002년 2회 에너지관리산업기사 5번','2022년1회 12번'],'이론연소온도=저위발열량÷(연소가스량×비열). 분수 OCR과 기호·보기 순서 차이 때문에 원문 수식을 확인해야 합니다.'],
  [['2024년1회 50번','2013년 1회 에너지관리산업기사 64번','2014년 1회 에너지관리산업기사 50번'],'엘보·나사 회전으로 신축을 흡수하는 스위블 이음. 질문 표현·영어 병기·보기 순서를 비교하세요.'],
  [['2018년 2회 에너지관리산업기사 62번','2019년 1회 에너지관리산업기사 39번','2017년 2회 에너지관리산업기사 69번','2023년2회 52번','2024년2회 57번'],'인터록이 아닌 종류를 묻는 관련 후보. 미분/온오프/고수위/온도초과/고온도 등 정답 내용과 다른 선택지가 다릅니다.'],
  [['2022년2회 47번','2021년2회 60번'],'롱 레트랙터(장발형)와 고온가스 통로의 대응. 하나는 사용 장소, 하나는 장치 이름을 묻는 역방향 질문입니다.'],
  [['2003년 1회 에너지관리산업기사 78번','2015년 4회 에너지관리산업기사 49번','2024년1회 25번'],'열역학식 디스크 트랩이라는 공통 원리. 설명의 길이와 오답 트랩 종류가 다릅니다.'],
  [['2021년1회 55번','2022년1회 43번'],'최고사용압력0.5MPa로 비슷하지만 강제압력용기와 강철제 증기보일러가 다릅니다. 등록 정답0.75/0.95MPa를 임의 통일하지 마세요.'],
  [['2018년 2회 에너지관리산업기사 68번','2024년1회 62번','2023년4회 40번','2017년 1회 에너지관리산업기사 78번'],'진공환수식이 가장 빠르다는 공통 내용. 진공펌프 설명이 추가되거나 오답 환수 방식이 다릅니다.'],
  [['2025년3회 48번','2003년 2회 에너지관리산업기사 70번'],'pH·알칼리도 조정제가 아닌 탄닌을 고릅니다. NaOH/수산화나트륨·소다회/탄산나트륨 등 표기와 인산염/인산나트륨 범위를 확인하세요.'],
  [['2017년 1회 에너지관리산업기사 70번','2024년2회 58번'],'슬러지 조정제=전분이 같지만 다른 약품 선택지가 다릅니다.'],
  [['2018년 2회 에너지관리산업기사 71번','2021년1회 77번'],'가성취화가 반드시 수면 위에서 발생한다는 틀린 설명을 고릅니다. 정답 문장의 응력 표현과 오답 보기가 다릅니다.'],
  [['2025년2회 52번','2025년3회 60번'],'유류 역화 원인이 아닌 것을 묻지만 정답의 2차공기 과대예열/예열부족이 반대입니다. 원문·조건·해설 추가 대조가 필요한 후보이며 정답을 바꾸지 않았습니다.'],
];
const semantic = new Map();
for (const [labels, note] of semanticSpecs) {
  const indices = labels.map(label => { const found = rows.map((r,i) => r.label.split(' · ')[0] === label ? i : -1).filter(i=>i>=0); if(found.length!==1)throw Error('Ambiguous source label: '+label); return found[0]; });
  for (let i=0;i<indices.length;i++) for(let j=i+1;j<indices.length;j++) semantic.set([indices[i],indices[j]].sort((a,b)=>a-b).join(':'), note);
}
const candidates = [];
for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
  const a = prepared[i], b = prepared[j];
  const stem = similarity(a.grams, b.grams), sameOptions = a.optionSet && a.optionSet === b.optionSet;
  const x = rows[i], y = rows[j], m = manual.get([x.id.replace(/^midterm:/, ''), y.id.replace(/^midterm:/, '')].sort().join('|'));
  const semanticNote = semantic.get(`${i}:${j}`);
  if (stem < .28 && !sameOptions && m === undefined && !semanticNote) continue;
  // Symmetric best-match score: changed/duplicated distractors must not inflate the score.
  const score = (x, y) => x.reduce((sum, option) => sum + Math.max(...y.map(other => similarity(option, other))), 0) / 4;
  const options = (score(a.choiceGrams, b.choiceGrams) + score(b.choiceGrams, a.choiceGrams)) / 2;
  if (!(stem >= .55 && options >= .45 || stem >= .38 && options >= .70 || sameOptions && stem >= .28 || stem >= .90 || m !== undefined || semanticNote)) continue;
  const swivelRepeat = [x.label, y.label].some(s => s.startsWith('2024년1회 50번')) && [x.label, y.label].some(s => s.startsWith('2014년 1회 에너지관리산업기사 50번'));
  const state = swivelRepeat ? '확인된 반복' : m !== undefined ? repeatIndexes.has(m) ? '확인된 반복' : '확인된 변형' : a.stem === b.stem && sameOptions && !x.ocr && !y.ocr ? '문자 일치 후보' : stem >= .80 && options >= .80 ? '유사도 높은 후보' : '추가 의심 후보';
  const flags = [];
  if (a.numbers !== b.numbers) flags.push('본문 숫자 다름');
  if (a.negative !== b.negative) flags.push('부정 질문 차이');
  if (!sameOptions) flags.push('보기 내용 또는 OCR 차이');
  else if (a.ordered !== b.ordered) flags.push('보기 순서 다름');
  if (x.ocr || y.ocr) flags.push('이미지 OCR 보조 · 원문 확인 필요');
  const correctA = a.options[x.answer - 1], correctB = b.options[y.answer - 1];
  if (correctA && correctB && correctA !== correctB) flags.push(state === '확인된 반복' ? '정답 표기·OCR 차이 · 원문 대조 완료' : '정답 내용 또는 인식 차이 · 원문 확인');
  let note = swivelRepeat ? '원문 이미지 대조: 질문·보기 순서·정답③가 같고, 기존 보기의 영어 병기만 생략되었습니다.' : m !== undefined ? repeatIndexes.has(m) ? '기존 원문 대조에서 반복으로 확인했습니다. 보기 순서와 정답 번호는 다를 수 있습니다.' : '기존 원문 대조에서 수치·오답 보기·정답 내용이 다른 관련 변형으로 확인했습니다.' : '자동 유사도 후보입니다. 두 원문의 질문·조건·보기·정답 내용을 직접 확인해 주세요.';
  if (m === undefined && !swivelRepeat) {
    if (/건식/.test(x.text + y.text) && /원심력/.test(x.text + y.text)) note += ' 건식 전체 분류와 원심력식 분류는 범위가 다릅니다.';
    if (/상당증발량/.test(x.text + y.text) && a.numbers !== b.numbers) note += ' 증발량과 엔탈피 수치가 바뀐 계산 변형입니다.';
    if (/기체연료|액체연료/.test(x.text + y.text)) note += ' 연료 종류와 틀린 보기의 내용이 다릅니다. 본문만 같아도 같은 문제로 합치면 안 됩니다.';
    if (/인터록/.test(x.text + y.text)) note += ' 고수위/고온도와 프리퍼지/압력초과 등 보기가 다릅니다.';
    if (/슬러/.test(x.text + y.text)) note += ' 수산화나트륨과 탄산칼슘 등 오답 선택지가 다릅니다.';
    if (/환수/.test(x.text + y.text)) note += ' 빠른 순환 방식, 진공펌프 설명, 환수법이 아닌 것 등 질문 초점과 보기를 비교하세요.';
  }
  if (semanticNote && m === undefined && !swivelRepeat) note = '전체 본문·정답 내용 검토에서 보강한 관련 후보. ' + semanticNote;
  candidates.push({ id: `${x.id}__${y.id}`, a: i, b: j, state, note, stem: +stem.toFixed(3), options: +options.toFixed(3), sameOptions: !!sameOptions,
    sameNormalizedCorrectText: !!correctA && correctA === correctB, reviewedSameCorrectContent: state === '확인된 반복' ? true : null, flags });
}
const order = ['확인된 반복', '확인된 변형', '문자 일치 후보', '유사도 높은 후보', '추가 의심 후보'];
candidates.sort((a, b) => Number(rows[b.a].midterm && rows[b.b].midterm) - Number(rows[a.a].midterm && rows[a.b].midterm) || order.indexOf(a.state) - order.indexOf(b.state) || b.stem + b.options - a.stem - a.options);
const states = Object.fromEntries(order.map(state => [state, candidates.filter(p => p.state === state).length]));
const connected = new Map();
const root = i => connected.has(i) && connected.get(i) !== i ? root(connected.get(i)) : i;
for (const p of candidates.filter(p => p.state === '확인된 반복')) { connected.set(root(p.a), root(p.b)); if (!connected.has(p.b)) connected.set(p.b, p.b); }
const repeatGroups = new Set([...connected.keys()].map(root)).size;
const report = { date: '2026-10-11', scope: 'energy-midterm-only', midterm: 179, comparedSources: rows.length, comparisons: rows.length * (rows.length - 1) / 2,
  repeatGroups, repeatQuestions: connected.size,
  midtermSourceCount: rows.filter(r => r.midterm).length, candidates: candidates.length, midtermPairs: candidates.filter(p => rows[p.a].midterm && rows[p.b].midterm).length,
  states, limits: '중간고사 179문제만 비교했습니다. 일반 에너지 기출은 제외했습니다. 문자/유사도 후보는 의미 중복 확정이 아닙니다. 수식 이미지·OCR 오인식·다른 표현의 중복은 누락될 수 있습니다. 문제 삭제·통합·정답 변경은 하지 않았습니다.', rows, pairs: candidates };
fs.writeFileSync('docs/energy-duplicate-review-2026-10-11.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, rows: undefined, pairs: undefined }, null, 2));
