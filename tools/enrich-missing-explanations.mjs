#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogFiles = ['data/hvac.js', 'data/safety.js', 'data/energy.js', 'data/energy-engineer.js', 'data/maintenance.js'];
const requestedCatalogs = new Set(process.argv.slice(2).map((value) => value.replace(/^--catalog=/, '')).flatMap((value) => value.split(',')).filter(Boolean));

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
    [/상당증발량/i, '상당증발량은 실제 증발량을 표준 증발조건으로 바꾼 값입니다. 실제 증발량에 증기와 급수의 엔탈피 차를 곱하고 표준 증발잠열로 나눕니다.'],
    [/게이지s*압력/i, '게이지압력은 대기압을 0으로 보고 잰 압력입니다. 절대압력은 게이지압력에 대기압을 더한 값입니다.'],
    [/진공s*압력|진공도/i, '진공압은 대기압보다 얼마나 낮은지를 나타냅니다. 절대압력은 대기압에서 진공압을 빼서 구합니다.'],
    [/캐스?케이드s*제어/i, '캐스케이드 제어는 주 제어기의 출력이 보조 제어기의 설정값이 되는 2중 제어입니다. 빠른 보조 루프가 외란을 먼저 잡아 전체 응답을 개선합니다.'],
    [/부르동|부르돈/i, '부르동관 압력계는 압력이 커질수록 굽은 금속관이 펴지려는 변위를 바늘에 전달합니다. 구조가 단순하고 넓은 압력범위를 측정할 수 있습니다.'],
    [/다이아프램.*압력|다이어프램.*압력/i, '다이어프램 압력계는 얇은 막이 압력차에 따라 휘는 양을 이용하므로 비교적 낮은 압력과 차압 측정에 알맞습니다.'],
    [/경사관.*압력|경사.*마노미터/i, '경사관식 압력계는 액주 이동거리를 길게 보이게 해 작은 압력차를 정밀하게 읽는 장치입니다.'],
    [/사이폰관/i, '사이폰관은 압력계 앞에 응축수를 머물게 해 고온 증기가 압력계에 직접 닿는 것을 막습니다.'],
    [/열전대|열전s*온도/i, '열전대 온도계는 서로 다른 두 금속의 접점에 온도차가 생길 때 발생하는 열기전력을 이용합니다. 온도범위가 넓고 응답이 빠른 편입니다.'],
    [/측온s*저항|저항s*온도계|RTD/i, '측온저항체는 금속의 전기저항이 온도에 따라 변하는 성질을 이용합니다. 정확도와 재현성이 좋아 정밀 온도측정에 씁니다.'],
    [/광고온계|복사s*온도계/i, '광고온계는 뜨거운 물체가 내는 빛이나 복사에너지를 보고 온도를 재므로 물체에 접촉하지 않고 고온을 측정할 수 있습니다.'],
    [/면적식s*유량|로타미터/i, '면적식 유량계는 위로 갈수록 넓어지는 관 안에서 부자가 떠오르는 높이로 유량을 읽습니다. 보통 아래에서 위로 흐르게 설치합니다.'],
    [/전자(?:식)?\s*유량|전자기\s*유량/i, '전자유량계는 도전성 유체가 자기장을 지날 때 생기는 유도전압으로 유량을 잽니다. 압력손실이 작지만 전기가 통하지 않는 유체에는 쓸 수 없습니다.'],
    [/오리피스|플로우\s*노즐|벤[츄추]리/i, '차압식 유량계는 통로를 좁혀 생긴 압력차로 유량을 구합니다. 같은 조건의 영구 압력손실은 대체로 오리피스가 크고 벤투리관이 작습니다.'],
    [/수주.*경도|칼슘.*마그네슘|Ca.*Mg/i, '물의 경도는 주로 물속 칼슘 이온과 마그네슘 이온의 양을 나타냅니다. 경도가 높으면 보일러와 열교환기에 스케일이 생기기 쉽습니다.'],
    [/절탄기/i, '절탄기는 배기가스의 남은 열로 보일러 급수를 미리 데워 연료 소비와 굴뚝 손실을 줄입니다.'],
    [/공기예열기/i, '공기예열기는 배기가스 열로 연소용 공기를 데워 연소를 돕고 보일러 효율을 높입니다.'],
    [/평형통풍/i, '평형통풍은 압입송풍기와 흡입송풍기를 함께 사용해 노 안의 압력을 대기압에 가깝게 유지하는 방식입니다.'],
    [/압입통풍/i, '압입통풍은 송풍기로 공기를 밀어 넣어 노 내부가 양압이 되기 쉬운 방식입니다.'],
    [/흡입통풍/i, '흡입통풍은 배기가스를 빨아내 노 내부를 약한 음압으로 유지하므로 연소가스가 밖으로 새는 것을 줄입니다.'],
    [/무연탄/i, '무연탄은 탄화도가 높아 휘발분과 연기가 적고 고정탄소가 많지만 착화가 어렵고 연소속도가 느립니다.'],
    [/프로판/i, '프로판 C₃H₈은 상온에서 기체이며 압력을 가하면 쉽게 액화되어 LPG의 주성분으로 사용됩니다. 공기보다 무거워 누출 시 낮은 곳에 모일 수 있습니다.'],
    [/일산화탄소|\bCO\b/i, '일산화탄소는 산소가 부족한 불완전연소에서 생기며 색과 냄새가 거의 없고 독성이 강합니다. 충분한 공기공급과 환기가 중요합니다.'],
    [/증발잠열|잠열/i, '잠열은 온도 변화 없이 물질의 상태를 바꾸는 데 쓰이는 열입니다.'],
    [/현열|비열.*온도/i, '현열은 물질의 상태는 그대로 두고 온도만 바꾸는 열이며 Q=m·c·ΔT로 계산합니다.'],
    [/열전도율/i, '열전도율이 클수록 재료 내부로 열이 잘 전달되고, 단열재는 열전도율이 작아야 합니다.'],
    [/열관류율|열통과율/i, '열관류율은 벽 양쪽 표면과 재료층을 모두 통과하는 열의 쉬운 정도이며 전체 열저항의 역수입니다.'],
    [/완전연소|불완전연소|공기비/i, '공기가 부족하면 불완전연소와 일산화탄소가 늘고, 공기가 지나치게 많으면 배기가스 손실이 커집니다.'],
    [/이론공기량/i, '이론공기량은 연료를 완전연소시키는 데 화학적으로 꼭 필요한 최소 공기량입니다.'],
    [/엔탈피/i, '엔탈피는 내부에너지에 유체를 밀어내는 데 필요한 압력·체적 일을 더한 상태량입니다.'],
    [/엔트로피/i, '엔트로피는 에너지가 퍼진 정도를 나타내며, 실제 비가역 과정에서는 전체 엔트로피가 증가합니다.'],
    [/베어링/i, '베어링은 회전축을 지지하고 마찰을 줄이며 작용하는 하중의 방향에 맞게 선정합니다.'],
    [/예방보전/i, '예방보전은 고장이 나기 전에 정해진 주기나 상태점검에 따라 정비해 돌발고장을 줄이는 방식입니다.'],
    [/개량보전/i, '개량보전은 반복되는 고장의 원인을 없애도록 설비의 구조·재질·작업방법을 개선하는 활동입니다. 단순 복구보다 재발 방지가 목적입니다.'],
    [/설비보전표준/i, '설비보전표준은 설비를 어떤 방법과 기준으로 점검·정비할지 정한 문서입니다. 보전 작업의 품질과 안전을 일정하게 만드는 기준입니다.'],
    [/설비점검표준/i, '설비점검표준은 점검 위치·항목·주기·방법·판정기준을 정해 누가 점검해도 같은 판단을 하도록 만든 기준입니다.'],
    [/시퀀스\s*제어/i, '시퀀스 제어는 미리 정한 순서와 조건에 따라 각 동작을 차례로 진행하는 제어입니다. 릴레이 회로나 PLC로 구현합니다.'],
    [/인터록/i, '인터록은 서로 동시에 동작하면 위험한 장치 중 한쪽이 작동할 때 다른 쪽의 작동을 막는 안전 논리입니다.'],
    [/AND\s*회로|논리곱/i, 'AND 회로는 모든 입력 조건이 1일 때만 출력이 1이 됩니다. 직렬 접점으로 생각하면 쉽습니다.'],
    [/OR\s*회로|논리합/i, 'OR 회로는 입력 조건 중 하나라도 1이면 출력이 1이 됩니다. 병렬 접점으로 생각하면 쉽습니다.'],
    [/실효값/i, '교류의 실효값은 같은 저항에서 같은 열을 내는 직류값입니다. 정현파 전압의 실효값은 최댓값을 √2로 나눈 값입니다.'],
    [/제너\s*다이오드/i, '제너 다이오드는 역방향 전압이 제너전압에 도달하면 전류를 흘려 전압을 거의 일정하게 유지하므로 정전압 회로에 씁니다.'],
    [/서미스터/i, '서미스터는 온도에 따라 저항이 크게 변하는 반도체 온도센서입니다. NTC는 온도가 오르면 저항이 내려가고 PTC는 올라갑니다.'],
    [/메거|절연저항/i, '메거는 높은 직류 시험전압을 걸어 전선·전동기 등의 절연저항을 측정합니다. 측정 전 전원을 차단하고 잔류전하를 방전해야 합니다.'],
    [/다이얼\s*게이지/i, '다이얼 게이지는 측정자의 작은 직선 움직임을 기어로 확대해 흔들림·편심·평행도 같은 미세한 치수차를 비교 측정합니다.'],
    [/마이크로미터/i, '마이크로미터는 정밀 나사의 일정한 이동량을 이용해 두께나 바깥지름을 정밀하게 측정합니다.'],
    [/분해능/i, '분해능은 측정기가 구별해 낼 수 있는 가장 작은 변화량입니다. 값이 작을수록 더 미세한 차이를 구별합니다.'],
    [/차동\s*변압기|LVDT/i, '차동변압기(LVDT)는 철심의 직선 이동에 따라 두 2차 코일의 전압차가 달라지는 원리로 변위를 측정합니다.'],
    [/초음파.*유량/i, '초음파 유량계는 유체를 지나는 초음파의 전달시간 차나 도플러 변화를 이용합니다. 배관을 자르지 않고 바깥에서 측정할 수 있는 형식도 있습니다.'],
    [/패러데이.*전자유도/i, '패러데이 법칙은 코일을 지나는 자속이 변하면 그 변화를 방해하는 방향으로 유도기전력이 생긴다는 법칙입니다.'],
    [/아날로그\s*신호/i, '아날로그 신호는 시간에 따라 연속적으로 변하는 값입니다. 디지털 신호는 정해진 단계의 값으로 표현합니다.'],
    [/강제진동/i, '강제진동은 외부의 주기적인 힘 때문에 생기는 진동입니다. 가진주파수가 고유진동수와 가까우면 공진으로 진폭이 커집니다.'],
    [/언밸런스|불평형/i, '회전체 불평형은 질량중심이 회전축에서 벗어난 상태입니다. 회전수 1배 주파수의 반경방향 진동이 크게 나타나는 경우가 많습니다.'],
    [/가속도계/i, '가속도계는 진동 가속도를 측정하며 베어링 결함처럼 고주파 충격을 찾는 데 유리합니다.'],
    [/웜\s*기어/i, '웜기어는 서로 엇갈린 두 축 사이에서 큰 감속비를 한 단계로 얻기 좋지만 미끄럼이 커서 효율과 윤활을 확인해야 합니다.'],
    [/플랜지\s*커플링/i, '플랜지 커플링은 두 축 끝의 플랜지를 볼트로 단단히 연결하는 고정 축이음입니다. 정확한 축정렬이 중요합니다.'],
    [/플렉시블\s*커플링|플랙시블\s*커플링/i, '플렉시블 커플링은 두 축의 작은 편심·각도 오차와 충격·진동을 흡수하면서 회전을 전달합니다.'],
    [/체크\s*밸브/i, '체크밸브는 유체를 한 방향으로만 흐르게 하고 반대 방향의 역류를 자동으로 막습니다.'],
    [/슬루스\s*밸브|게이트\s*밸브/i, '슬루스밸브는 판 모양 디스크를 올리고 내려 통로를 완전히 열거나 닫습니다. 완전 개방 때 압력손실은 작지만 유량조절용으로는 알맞지 않습니다.'],
    [/다이어프램\s*밸브|다이아프램\s*밸브/i, '다이어프램 밸브는 탄성막으로 유로를 열고 닫아 작동부와 유체가 직접 닿지 않습니다. 부식성·오염 유체에 쓰기 좋습니다.'],
    [/나비형\s*밸브|버터플라이\s*밸브/i, '버터플라이밸브는 원판을 약 90도 돌려 유로를 열고 닫습니다. 가볍고 설치길이가 짧아 큰 지름 배관에 유리합니다.'],
    [/수격|워터\s*해머/i, '수격작용은 흐르던 유체를 급히 막을 때 압력파가 생겨 충격과 소음을 일으키는 현상입니다. 밸브를 천천히 닫고 서지탱크 등을 사용해 줄입니다.'],
    [/흡음률|흡음.*에너지/i, '흡음률은 입사한 소리에너지 중 재료가 흡수한 비율입니다. 흡수에너지를 입사에너지로 나눕니다.'],
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

function calculationGuide(stem) {
  if (!/얼마|몇\s*(?:개|배|%|℃|도|kW|W|kg|m|Pa|V|A|rpm)?|계산|구하|값은/i.test(stem)) return '';
  const rules = [
    [/보일러.*효율|효율.*보일러/i, '보일러 효율 η=유효하게 얻은 열÷연료가 공급한 열입니다. 연료량을 구할 때는 필요한 열량을 발열량×η로 나눕니다.'],
    [/상당증발/i, '상당증발량=실제증발량×(증기 엔탈피-급수 엔탈피)÷표준 증발잠열입니다. 문제에서 준 539 kcal/kg 또는 약 2257 kJ/kg을 우선 사용합니다.'],
    [/연돌|통풍력/i, '이론 통풍력은 연돌 높이×(외기 비중량-배기가스 비중량)으로 구합니다. 배기가스 비중량은 절대온도에 반비례하므로 주어진 온도로 먼저 보정합니다.'],
    [/이론공기량|연소.*공기/i, '연료 성분별로 완전연소에 필요한 산소량을 구해 더한 뒤, 공기 중 산소의 비율로 나누면 이론공기량이 됩니다. 연료 자체의 산소는 필요한 산소량에서 뺍니다.'],
    [/저위발열량|고위발열량/i, '저위발열량은 고위발열량에서 연료의 수소와 수분 때문에 생긴 수증기의 응축잠열을 뺀 값입니다. 문제에 주어진 잠열과 성분값을 그대로 대입합니다.'],
    [/열량|비열|온도.*상승|온도.*변화/i, '상태변화가 없는 열량은 Q=m·c·ΔT입니다. 질량×비열×온도차를 곱하고, 시간당 열량이면 시간 단위까지 맞춥니다.'],
    [/열전도|열관류|벽.*열/i, '평판의 전도열량은 Q=λAΔT/L입니다. 여러 층이면 각 층의 열저항 L/(λA)을 더한 뒤 전체 온도차를 총 열저항으로 나눕니다.'],
    [/카르노|Carnot/i, '카르노 열기관 효율은 η=1-T저/T고입니다. 온도는 ℃가 아니라 273을 더한 절대온도 K로 넣습니다.'],
    [/게이지.*압력|절대.*압력|진공.*압력/i, '절대압력=대기압+게이지압력이고, 진공압이 주어지면 절대압력=대기압-진공압입니다. 서로 다른 압력 단위는 같은 기준으로 환산합니다.'],
    [/펌프.*동력|수동력|축동력/i, '펌프가 물에 주는 동력은 ρgQH이고, 필요한 축동력은 이를 효율 η로 나눈 값입니다. 효율 80%는 0.80으로 넣습니다.'],
    [/실린더.*(?:힘|추력)|유압.*(?:힘|추력)/i, '실린더 힘은 F=P·A입니다. 전진은 피스톤 전체 면적, 복귀는 피스톤 면적에서 로드 면적을 뺀 유효면적을 사용합니다.'],
    [/유량.*속도|속도.*유량/i, '연속방정식 Q=A·v를 사용합니다. 같은 유량이면 단면적이 작아질수록 유속은 빨라집니다.'],
    [/베어링.*압력/i, '미끄럼베어링 압력은 하중 W를 투영면적 d·L로 나눈 p=W/(dL)입니다. 지름과 길이의 단위를 먼저 같게 맞춥니다.'],
    [/스프링/i, '병렬 스프링의 합성상수는 K를 더하고, 직렬은 1/K를 더합니다. 합성상수를 구한 뒤 하중 P=K·δ를 사용합니다.'],
    [/기어.*(?:회전수|속도비|감속비)|회전수.*기어/i, '맞물린 기어는 회전수×잇수가 서로 같습니다. 따라서 N₁Z₁=N₂Z₂로 놓고 모르는 회전수나 잇수를 구합니다.'],
    [/벨트.*(?:속도|회전수)|풀리.*회전수/i, '미끄럼을 무시하면 두 풀리의 원주속도가 같으므로 D₁N₁=D₂N₂를 사용합니다.'],
    [/가동률|MTBF|MTTR/i, '가동률은 MTBF÷(MTBF+MTTR)입니다. 고장 사이 평균시간은 길수록, 평균수리시간은 짧을수록 가동률이 높아집니다.'],
    [/신뢰도|고장률/i, '고장률이 일정한 구간의 신뢰도는 R(t)=e^(-λt)입니다. 직렬 시스템은 각 부품 신뢰도를 곱합니다.'],
    [/옴.*법칙|전압.*전류.*저항|저항.*전류/i, '옴의 법칙 V=IR을 사용합니다. 전류는 I=V/R, 저항은 R=V/I로 식을 바꿉니다.'],
    [/전력|소비전력/i, '직류 전력은 P=VI이고, 저항 부하는 P=I²R 또는 V²/R로도 구할 수 있습니다. 교류는 역률과 상수 조건을 함께 확인합니다.'],
  ];
  return rules.find(([pattern]) => pattern.test(stem))?.[1] || '';
}

function generatedExplanation(question) {
  const stem = plain(question.text || question.html || '');
  const choice = answerText(question);
  const label = answerLabel(question.answer);
  if (question.imageOnly && /^(?:[①②③④1-4]\s*){1,2}$/.test(choice)) {
    return '원문 이미지형 문항이라 현재 텍스트만으로는 문제와 보기를 정확히 판독할 수 없습니다. 잘못된 해설을 추측해 넣지 않고 원문 대조가 끝날 때까지 해설을 보류합니다.';
  }
  const calculation = calculationGuide(stem);
  if (calculation) return `${calculation} 계산 결과와 맞는 보기는 ${label} ‘${choice}’입니다.`;
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
for (const catalog of catalogs.filter((entry) => !requestedCatalogs.size || requestedCatalogs.has(entry.data.key))) {
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
