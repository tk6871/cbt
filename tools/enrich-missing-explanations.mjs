#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogFiles = ['data/hvac.js', 'data/safety.js', 'data/energy.js', 'data/energy-engineer.js', 'data/maintenance.js'];

function readCatalog(filename) {
  const source = fs.readFileSync(path.join(root, filename), 'utf8');
  const equals = source.indexOf('=');
  return {
    filename,
    prefix: source.slice(0, equals + 1),
    data: JSON.parse(source.slice(equals + 1, source.lastIndexOf(';'))),
  };
}

function plain(value = '') {
  return String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:nbsp|amp|lt|gt);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalized(value = '') {
  return plain(value).normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
}

function answerText(question) {
  const choice = question.choices?.[Number(question.answer) - 1] || {};
  return plain(choice.text || choice.html || `${question.answer}번`);
}

function answerLabel(answer) {
  return ['①', '②', '③', '④'][Number(answer) - 1] || `${answer}번`;
}

function fullKey(question) {
  return normalized([question.text || question.html, ...(question.choices || []).map((choice) => choice.text || choice.html)].join(' '));
}

function usefulExplanation(question) {
  if (/^(?:concise-answer-guide|cross-catalog:)/.test(String(question.explanationProvenance || ''))) return false;
  const explanation = plain(question.explanation || question.explanationHtml || '');
  if (explanation.length < 20) return false;
  return !/^(?:문제|본문|보기).{0,25}(?:참고|확인|읽어)|해설\s*(?:없음|준비 중)|^정답은?\s*[①②③④1-4](?:번)?(?:입니다)?[.!]?$/i.test(explanation);
}

function baseExplanation(value = '') {
  return String(value)
    .split(/\n\n\[(?:COMCBT 동일 문제 추가 해설|한솔아카데미 동일 문제 보충 해설|정답·해설 대조 완료)\]\n/)[0]
    .trim();
}

function conciseSentences(value, maxSentences = 3, maxLength = 220) {
  const cleaned = plain(value)
    .replace(/\[해설작성자[^\]]*\]/g, '')
    .replace(/아래와 같은 오류 신고가 있었습니다.*$/s, '')
    .trim();
  const sentences = cleaned.match(/[^.!?]+[.!?]?/g) || [cleaned];
  const result = [];
  for (const sentence of sentences) {
    const next = sentence.trim();
    if (!next) continue;
    if (result.length && `${result.join(' ')} ${next}`.length > maxLength) break;
    result.push(next);
    if (result.length >= maxSentences) break;
  }
  return result.join(' ').trim();
}

function negativeQuestion(stem) {
  return /옳지\s*않|아닌|틀린|거리가\s*(?:가장\s*)?먼|관계가\s*(?:가장\s*)?적|해당(?:되)?지\s*않|관계\s*없는|잘못된|부적당|적절치\s*못|적합하지\s*않|필요하지\s*않|될\s*수\s*없는/i.test(stem);
}

function questionTopic(stem) {
  return plain(stem)
    .replace(/^\d+[.,]?\s*/, '')
    .replace(/^다음(?:\s*중|의)?\s*/, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\?$/, '')
    .replace(/\s*(?:것|설명|항목)(?:은|이|인가)?$/i, '')
    .replace(/\s*(?:가장\s*)?(?:옳은|알맞은|적절한|적당한|틀린|옳지\s*않(?:은|는)|아닌|거리가\s*(?:가장\s*)?먼|관계가\s*(?:가장\s*)?적은|해당\s*(?:되)?지\s*않는|관계\s*없는|잘못된|부적당한|적절치\s*못한|적합하지\s*않(?:은|는)|필요하지\s*않(?:은|는)|될\s*수\s*없는)$/i, '')
    .replace(/\s*(?:이|가|으로|로|에|와|과)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function describedConcept(stem) {
  const clean = plain(stem).replace(/^다음(?:\s*중|의)?\s*/, '').replace(/\?$/, '').trim();
  const patterns = [
    /^(.{12,180}?)(?:을|를|이|가)\s*(?:무엇이라|무엇이라고|무엇으로)\s*(?:하는가|하는지|부르는가|하는 것인가)?$/i,
    /^(.{12,180}?)(?:을|를)\s*(?:뜻하는|의미하는|나타내는)\s*(?:것은|용어는)?$/i,
  ];
  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match) return match[1].replace(/\s+/g, ' ').trim();
  }
  return '';
}

function conceptGuide(source) {
  const rules = [
    [/호손|Hawthorne/i, '호손실험은 작업조건 자체뿐 아니라 “관심을 받고 있다”는 인식도 생산성에 영향을 준다는 사실을 보여 준 실험입니다.'],
    [/\bETA\b/i, 'ETA는 시작사건에서 출발해 안전장치의 성공·실패 결과를 앞으로 뻗어 가는 귀납적 분석기법입니다.'],
    [/\bPHA\b/i, 'PHA는 설계 초기 단계에서 큰 위험요인을 먼저 찾아내는 예비위험분석입니다.'],
    [/Fail\s*safe|페일\s*세이프/i, 'Fail safe는 부품이 고장 나더라도 시스템이 위험한 쪽이 아니라 안전한 상태가 되도록 설계하는 원칙입니다.'],
    [/크리[이프]+|creep/i, '크리프는 높은 온도에서 일정한 하중을 오래 받을 때 변형이 시간에 따라 계속 커지는 현상입니다.'],
    [/분할날/i, '분할날은 둥근톱 뒤쪽에서 절단된 재료가 톱날을 조이지 않게 벌어진 틈을 유지해 줍니다.'],
    [/열동계전기|THR/i, '열동계전기는 과전류가 일정 시간 흐를 때 생기는 열로 접점을 동작시켜 전동기의 과부하를 막습니다.'],
    [/Y\s*[-–]?\s*△|와이.*델타|스타.*델타/i, 'Y-△ 기동은 처음에 Y결선으로 기동전류를 줄이고, 속도가 오른 뒤 △결선으로 바꾸는 유도전동기 기동법입니다.'],
    [/타이\s*로드/i, '타이로드는 실린더의 앞·뒤 커버와 튜브를 단단히 묶어 내부 압력과 왕복 충격을 견디게 합니다.'],
    [/흡음/i, '흡음재에 들어간 소리에너지의 일부는 내부 마찰로 열에너지로 바뀌어 반사되는 소리가 줄어듭니다.'],
    [/자연\s*통풍|연돌.*통풍/i, '자연통풍은 뜨거운 배기가스와 차가운 외기의 밀도차로 연돌 안에 압력차를 만들어 배기가스를 내보냅니다.'],
    [/열역학.*제\s*1법칙|에너지\s*보존/i, '열역학 제1법칙은 에너지가 새로 생기거나 사라지지 않고 열과 일의 형태로 바뀔 뿐이라는 에너지 보존법칙입니다.'],
    [/고위발열량|저위발열량/i, '고위발열량은 연소 후 수증기가 응축할 때 나오는 열까지 포함하고, 저위발열량은 그 응축열을 제외합니다.'],
    [/Rankine|랭킨.*온도/i, '랭킨온도는 화씨 눈금을 쓰는 절대온도입니다. 화씨온도에 약 459.67을 더해 °R로 바꿉니다.'],
    [/기체.*비중.*프로판|프로판.*비중/i, '같은 온도와 압력에서 기체 비중은 분자량이 클수록 큽니다. 보기의 대표 기체 중 프로판은 분자량이 커 비중도 큽니다.'],
    [/스트레이너/i, '스트레이너는 배관 속 녹·찌꺼기를 걸러 밸브와 펌프를 보호하므로 보호할 기기의 앞쪽에 설치합니다.'],
    [/하트포드|Hartford/i, '하트포드 접속은 보일러 수면 아래에서 급수·환수관을 연결해 환수관이 파손되어도 보일러수가 한꺼번에 빠지는 것을 막습니다.'],
    [/4관식|사관식/i, '4관식 팬코일은 냉수 공급·환수와 온수 공급·환수를 각각 분리해 냉수와 온수가 섞이지 않고 동시에 냉난방할 수 있습니다.'],
    [/줄.*톰슨|Joule.*Thomson/i, '줄-톰슨 효과는 실제 기체를 밸브나 작은 구멍으로 교축할 때 엔탈피는 거의 일정하지만 온도가 변하는 현상이며 기체 액화에 이용합니다.'],
    [/안전율/i, '안전율은 재료가 견디는 강도를 실제 사용하는 응력으로 나눈 값입니다.'],
    [/도수율/i, '도수율은 연근로시간 100만 시간당 재해 발생 건수입니다.'],
    [/강도율/i, '강도율은 연근로시간 1,000시간당 근로손실일수입니다.'],
    [/연천인율/i, '연천인율은 근로자 1,000명당 1년 동안 발생한 재해자 수입니다.'],
    [/위험도|리스크/i, '위험도는 사고가 일어날 가능성과 피해의 크기를 함께 평가한 값입니다.'],
    [/하인리히|버드.*법칙/i, '재해비율 법칙은 큰 사고 전에 작은 사고와 아차사고가 훨씬 많이 나타난다는 뜻입니다.'],
    [/불안전.*행동|불안전.*상태/i, '불안전한 행동은 사람의 잘못된 동작이고, 불안전한 상태는 설비·작업환경의 위험한 조건입니다.'],
    [/보호구|안전모|안전화|방진마스크|방독마스크/i, '보호구는 위험요인을 먼저 제거하기 어려울 때 신체에 착용하는 마지막 방호수단입니다.'],
    [/감전|누전|접지/i, '접지는 누설전류를 땅으로 흘리고 차단기를 빠르게 동작시켜 감전위험을 줄입니다.'],
    [/소음|데시벨|dB/i, '소음은 발생원에서 줄이고, 전달경로를 차단한 뒤, 마지막으로 귀마개 같은 보호구를 사용합니다.'],
    [/화재.*종류|A급|B급|C급|D급/i, 'A급은 일반 가연물, B급은 유류, C급은 전기, D급은 금속 화재입니다.'],
    [/폭발.*하한|폭발.*상한|연소범위/i, '가연성 가스는 농도가 폭발하한과 폭발상한 사이일 때 연소·폭발할 수 있습니다.'],
    [/인간공학|인체.*측정|작업대.*높이/i, '인간공학은 작업과 설비를 사람의 신체·인지 특성에 맞춰 피로와 실수를 줄이는 분야입니다.'],
    [/FTA|결함수|Fault Tree/i, 'FTA는 사고를 정상사상으로 두고 원인이 되는 사건을 논리기호로 거슬러 분석합니다.'],
    [/FMEA/i, 'FMEA는 부품별 고장형태가 시스템에 미치는 영향을 아래에서 위로 분석합니다.'],
    [/보일러.*효율|열효율/i, '보일러 효율은 연료가 낸 열량 중 물이나 증기가 실제로 얻은 열량의 비율입니다.'],
    [/증발잠열|잠열/i, '잠열은 온도 변화 없이 물질의 상태를 바꾸는 데 쓰이는 열입니다.'],
    [/현열|비열.*온도/i, '현열은 물질의 상태는 그대로 두고 온도만 바꾸는 열이며 Q=m·c·ΔT로 계산합니다.'],
    [/열전도율/i, '열전도율이 클수록 재료 내부로 열이 잘 전달되고, 단열재는 열전도율이 작아야 합니다.'],
    [/열관류율|열통과율/i, '열관류율은 벽 양쪽 표면과 재료층을 모두 통과하는 열의 쉬운 정도이며 전체 열저항의 역수입니다.'],
    [/완전연소|불완전연소|공기비/i, '공기가 부족하면 불완전연소와 일산화탄소가 늘고, 공기가 지나치게 많으면 배기가스 손실이 커집니다.'],
    [/이론공기량/i, '이론공기량은 연료를 완전연소시키는 데 화학적으로 꼭 필요한 최소 공기량입니다.'],
    [/엔탈피/i, '엔탈피는 내부에너지에 유체를 밀어내는 데 필요한 압력·체적 일을 더한 상태량입니다.'],
    [/엔트로피/i, '엔트로피는 에너지가 퍼진 정도를 나타내며, 실제 비가역 과정에서는 전체 엔트로피가 증가합니다.'],
    [/베어링/i, '베어링은 회전축을 지지하고 마찰을 줄이며 작용하는 하중의 방향에 맞게 선정합니다.'],
    [/기어.*모듈|모듈.*기어/i, '기어의 모듈은 피치원 지름을 잇수로 나눈 값이며 서로 맞물리는 기어는 모듈이 같아야 합니다.'],
    [/윤활|점도/i, '윤활유는 마찰·마모와 발열을 줄이며, 운전 온도와 하중에 맞는 점도가 필요합니다.'],
    [/캐비테이션/i, '캐비테이션은 압력이 증기압 아래로 내려가 생긴 기포가 터지며 소음·진동·침식을 일으키는 현상입니다.'],
    [/공진|고유진동수/i, '가진주파수가 고유진동수와 가까워지면 공진으로 진폭이 크게 증가합니다.'],
    [/진동.*속도|진동.*가속도|진동.*변위/i, '저주파 진동은 변위, 중간 주파수는 속도, 고주파 충격은 가속도 측정이 유리합니다.'],
    [/유압/i, '유압장치는 거의 압축되지 않는 기름으로 큰 힘을 전달하고 속도를 부드럽게 제어합니다.'],
    [/공압/i, '공압장치는 압축공기를 사용해 빠르고 깨끗하지만 공기의 압축성 때문에 정밀 위치제어에는 불리합니다.'],
    [/PLC/i, 'PLC는 입력을 읽고 저장된 논리 프로그램을 실행해 출력을 제어하는 산업용 제어기입니다.'],
    [/용접.*결함|언더컷|오버랩|기공/i, '용접결함은 전류·속도·각도·모재 상태가 맞지 않을 때 생기므로 결함 모양과 발생 원인을 함께 구분합니다.'],
    [/비파괴검사|초음파.*검사|방사선.*검사|자분.*검사|침투.*검사/i, '비파괴검사는 제품을 손상시키지 않고 표면이나 내부의 균열·결함을 찾는 검사입니다.'],
    [/공차|끼워맞춤/i, '끼워맞춤은 구멍과 축의 허용치수 관계에 따라 틈새·중간·억지 끼워맞춤으로 나뉩니다.'],
    [/응력.*변형률|후크.*법칙/i, '탄성범위에서는 응력과 변형률이 비례하며 그 비가 탄성계수입니다.'],
  ];
  return rules.find(([pattern]) => pattern.test(source))?.[1] || '';
}

function generatedExplanation(question) {
  const stem = plain(question.text || question.html || '');
  const choice = answerText(question);
  const label = answerLabel(question.answer);
  if (question.imageOnly && /^(?:[①②③④1-4]\s*){1,2}$/.test(choice)) {
    return '원문 이미지형 문항이라 현재 텍스트만으로는 문제와 보기를 정확히 판독할 수 없습니다. 잘못된 해설을 추측해 넣지 않고 원문 대조가 끝날 때까지 해설을 보류합니다.';
  }
  const guide = conceptGuide(`${stem} ${choice}`);
  const negative = negativeQuestion(stem);
  if (guide) {
    return `${guide} ${negative
      ? `${label} ‘${choice}’만 이 원리와 맞지 않습니다.`
      : `따라서 정답은 ${label} ‘${choice}’입니다.`}`;
  }
  const topic = questionTopic(stem).slice(0, 100);
  if (negative && topic) {
    const others = [1, 2, 3, 4].filter((value) => value !== Number(question.answer)).map(answerLabel).join('·');
    return `${others} 보기는 모두 ${topic}에 해당합니다. ${label} ‘${choice}’만 해당하지 않습니다.`;
  }
  const described = describedConcept(stem);
  if (described) {
    return `문제에서 설명한 ‘${described.slice(0, 150)}’의 명칭이 ${label} ‘${choice}’입니다.`;
  }
  if (/무엇|명칭|용어|기호|뜻|의미/i.test(stem)) {
    return `문제에서 설명한 개념은 ${label} ‘${choice}’입니다.`;
  }
  if (/얼마|몇\s*(?:개|배|%|℃|도|kW|W|kg|m|Pa|V|A|rpm)?|계산|구하|값은/i.test(stem)) {
    return `주어진 조건을 계산하면 ${label} ‘${choice}’입니다.`;
  }
  return `정답은 ${label} ‘${choice}’입니다.`;
}

const catalogs = catalogFiles.map(readCatalog);
const reviewedExplanationConflicts = new Map([
  ['safety:safety-20040307:72', '설정 정답 ③을 유지합니다. 폭발범위 폭은 아세틸렌이 가장 넓고, 그다음 수소·일산화탄소·프로판 순입니다. 아래의 ② 주장은 이용자 오류 신고 기록입니다.'],
  ['safety:safety-20100509:10', '설정 정답 ④를 유지합니다. 안전점검은 결함 제거·안전성 확보·성능 유지와 재해예방을 위한 활동이지, 불필요 시설을 중단해 가동률을 높이는 활동이 아닙니다.'],
  ['safety:safety-20100509:33', '설정 정답 ④를 유지합니다. 위험처리의 대표 방법은 회피·감축·보유(보류)·전가이며 “계속”은 이 네 분류에 들지 않습니다.'],
  ['safety:safety-20190804:78', '공개 문제지의 설정 정답 ②를 유지합니다. 출제 답안은 3을 압력비로 보고 (20+273)×3^((1.4-1)/1.4)-273≈128℃로 계산합니다. 다만 문장의 “압축비”를 체적비로 읽으면 ③ 약 182℃가 되어 표현에 논란이 있는 문항입니다.'],
  ['maintenance:maintenance-20200606:79', '설정 정답 ③을 유지합니다. 그리스 과충전은 교반저항과 마찰열을 늘려 베어링 과열 원인이 될 수 있지만, 임펠러 부식은 주로 불평형·진동 문제로 연결되어 베어링 과열의 직접 원인과 거리가 있습니다.'],
  ['maintenance:maintenance-20150308:72', '설정 정답 ③을 유지합니다. 펌프는 물 없이 공운전하면 씰과 베어링이 손상될 수 있으므로 시운전 전에 물을 채우고, 회전방향·밸브·압력·회전수를 확인합니다.'],
  ['maintenance:maintenance-20030810:76', '설정 정답 ①을 유지합니다. 탄소공구강 STC는 번호가 작을수록 탄소량이 많은 계열이므로 STC1의 탄소 함유량이 가장 많습니다. 아래의 “번호가 클수록 많다”는 이용자 해설은 반대입니다.'],
]);

function applyConflictReview(catalogKey, round, question) {
  const review = reviewedExplanationConflicts.get(`${catalogKey}:${round.id}:${question.number}`);
  if (!review) return;
  const marker = '\n\n[정답·해설 대조 완료]\n';
  const base = String(question.explanation || question.explanationHtml || '').split(marker)[0].trim();
  question.explanation = `${base}${marker}${review}`;
  question.explanationHtml = question.explanation;
  question.explanationAnswerReviewed = true;
}

const explainedByFull = new Map();
for (const catalog of catalogs) {
  for (const round of catalog.data.rounds || []) {
    for (const question of round.questions || []) {
      if (!usefulExplanation(question)) continue;
      const key = `${answerText(question)}:${fullKey(question)}`;
      const explanation = conciseSentences(baseExplanation(question.explanation || question.explanationHtml));
      if (fullKey(question) && explanation.length >= 20) {
        const current = explainedByFull.get(key);
        if (!current || explanation.length < current.explanation.length) {
          explainedByFull.set(key, { explanation, source: `${catalog.data.key || catalog.filename}:${round.id}:${question.number}` });
        }
      }
    }
  }
}

const report = [];
for (const catalog of catalogs) {
  let linked = 0;
  let authored = 0;
  let preserved = 0;
  for (const round of catalog.data.rounds || []) {
    for (const question of round.questions || []) {
      if (usefulExplanation(question)) {
        applyConflictReview(catalog.data.key || catalog.filename, round, question);
        preserved += 1;
        continue;
      }
      const match = explainedByFull.get(`${answerText(question)}:${fullKey(question)}`);
      const explanation = match?.explanation || generatedExplanation(question);
      question.explanation = explanation;
      question.explanationHtml = explanation;
      question.explanationType = 'ai-reference';
      question.explanationConfidence = match ? 'high' : 'medium';
      question.explanationProvenance = match ? `cross-catalog:${match.source}` : 'concise-answer-guide';
      applyConflictReview(catalog.data.key || catalog.filename, round, question);
      if (match) linked += 1;
      else authored += 1;
    }
  }
  fs.writeFileSync(path.join(root, catalog.filename), `${catalog.prefix}${JSON.stringify(catalog.data)};\n`);
  report.push({ catalog: catalog.data.key || catalog.filename, preserved, linked, authored });
}

console.log(JSON.stringify(report, null, 2));
