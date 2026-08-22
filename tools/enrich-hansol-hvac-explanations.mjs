#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readCatalog(filename) {
  const source = fs.readFileSync(path.join(root, filename), 'utf8');
  return JSON.parse(source.slice(source.indexOf('=') + 1, source.lastIndexOf(';')));
}

function plain(value = '') {
  return String(value).replace(/<[^>]+>/g, ' ').replace(/&(?:nbsp|amp|lt|gt);/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalized(value = '') {
  return plain(value).normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
}

function correctChoice(question) {
  const choice = question.choices?.[Number(question.answer || 1) - 1] || {};
  return plain(choice.text || choice.html || '');
}

function bigrams(value) {
  const source = normalized(value);
  const result = new Map();
  for (let index = 0; index < source.length - 1; index += 1) {
    const gram = source.slice(index, index + 2);
    result.set(gram, (result.get(gram) || 0) + 1);
  }
  return result;
}

function diceSimilarity(left, right) {
  const a = normalized(left);
  const b = normalized(right);
  if (a === b) return a ? 1 : 0;
  if (a.length < 2 || b.length < 2) return 0;
  const aBigrams = bigrams(a);
  const bBigrams = bigrams(b);
  let shared = 0;
  for (const [gram, count] of aBigrams) shared += Math.min(count, bBigrams.get(gram) || 0);
  return (2 * shared) / ((a.length - 1) + (b.length - 1));
}

function stripHansolSupplement(value = '') {
  return String(value).split(/\n\n\[(?:한솔아카데미 동일 문제 보충 해설|COMCBT 동일 문제 추가 해설)\]/)[0].trim();
}

function stemKey(question) {
  return normalized(question.text || question.html || '');
}

function fullKey(question) {
  return normalized([question.text || question.html, ...question.choices.map((choice) => choice.text || choice.html)].join(' '));
}

function calculationGuide(source) {
  const rules = [
    [/이론.*성적계수.*실제.*성적계수|압축효율.*기계효율/i, '이론 COP = 냉동효과 ÷ 이론 압축일, 실제 COP ≈ 이론 COP × 압축효율 × 기계효율', '그림에서 냉동효과는 395.5-135.5=260, 압축일은 462-395.5=66.5이므로 이론 COP는 약 3.9입니다. 실제 COP는 3.9×0.80×0.9≈2.8입니다.'],
    [/열\s*통과율.*열전도율|열관류율.*열전도율/i, '1/K = 1/αᵢ + L/λ + 1/αₒ', '전체 열저항 1/K에서 실내·외 표면 열저항을 빼면 벽체 열저항 L/λ가 됩니다. 따라서 λ = L ÷ 남은 열저항으로 구합니다.'],
    [/절연저항.*(?:전압계|내부저항)|전압계.*절연저항/i, '절연저항 Rₓ = 전압계 내부저항 Rₘ × (측정 전압 V ÷ 전압계 지시값 e - 1)', '먼저 V를 e로 나누고 1을 뺀 다음 Rₘ과 곱합니다. MΩ로 바꿀 때는 Ω 값을 1,000,000으로 나눕니다.'],
    [/선팽창|열팽창.*길이|팽창량/i, '늘어난 길이 ΔL = 선팽창계수 α × 원래 길이 L × 온도차 ΔT', 'mm와 m 단위를 먼저 하나로 맞추고, 온도차는 높은 온도에서 낮은 온도를 뺍니다.'],
    [/공기여과기|필터.*(?:개수|매수|통과풍속)/i, '필터 수 = 전체 풍량 ÷ (필터 1개의 면적 × 통과속도 × 유효면적비)', '유효면적 80%는 0.8처럼 소수로 바꿉니다. 계산 결과가 소수이면 실제 설치 수는 부족하지 않게 올림합니다.'],
    [/가스.*(?:효율|열효율)|가스레인지/i, '효율 = 물이 얻은 열량 ÷ 가스가 낸 열량 × 100', '물이 얻은 열량은 m×c×ΔT, 가스가 낸 열량은 가스 사용량×발열량으로 구한 뒤 서로 나눕니다.'],
    [/탱크.*(?:바닥|밑면).*압력|액체.*깊이.*압력/i, '바닥의 압력 = 액면 압력 + ρgH', '액체가 깊어질수록 ρgH만큼 압력이 더해집니다. 게이지압인지 절대압인지도 확인합니다.'],
    [/압축비/i, '압축비 = 토출 절대압력 ÷ 흡입 절대압력', '게이지압력으로 주어졌다면 양쪽에 대기압을 더해 절대압력으로 바꾼 뒤 나눕니다.'],
    [/코일.*정면.*면적|코일.*통과.*풍속/i, '코일 정면면적 A = 풍량 Q ÷ 정면 통과속도 v', '풍량이 m³/min이면 먼저 60으로 나눠 m³/s로 바꾼 뒤 속도로 나눕니다.'],
    [/냉각탑.*보급수|비산손실|블로우다운/i, '보급수량 = 증발손실 + 비산손실 + 블로우다운 손실', '세 손실의 단위를 같게 맞춘 뒤 모두 더합니다. 순환수량에 대한 %이면 각각 소수로 바꿔 곱합니다.'],
    [/엔트로피.*(?:주위|주변)|주위.*엔트로피/i, '주위의 엔트로피 변화 ΔS = 주위가 받은 열량 Q ÷ 절대온도 T', '온도는 ℃가 아니라 K를 사용합니다. 열을 받으면 +, 내보내면 - 부호를 붙입니다.'],
    [/관.*절단.*길이|배관.*실제.*길이|실제.*강관.*길이/i, '관 절단길이 = 중심 간 거리 - 양쪽 이음쇠 물림길이 + 필요한 나사 여유', '그림의 중심선 길이에서 엘보·티가 차지하는 치수를 각각 빼고 나사 체결 여유만 더합니다.'],
    [/방열기.*(?:EDR|방열량)|상당방열면적/i, '방열량 = 상당방열면적(EDR) × 표준 방열량', '증기 또는 온수 방열기의 표준 방열량을 확인하고 EDR과 곱합니다. 반대로 EDR을 구하면 방열량을 표준값으로 나눕니다.'],
    [/정적.*기체|정용.*기체|체적.*일정.*압력|체적이.*일정/i, '체적이 일정한 이상기체는 P₁/T₁ = P₂/T₂', '온도는 반드시 ℃에 273을 더한 K로 바꾸고 압력과 같은 위치끼리 비례식으로 풉니다.'],
    [/외표면.*온도|외부.*표\s*면온도|벽체.*표면온도/i, '벽을 통과한 열유속은 표면 대류열과 같으므로 q = KΔT = α(표면온도-공기온도)', '먼저 전도와 외부 대류의 열저항을 더해 열유속을 구합니다. 그 값을 바깥쪽 열전달계수로 나누면 외기와 표면의 온도차가 나옵니다.'],
    [/2진수.*16진수|16진수.*2진수/i, '2진수는 오른쪽부터 4자리씩 묶어 16진수 한 자리로 바꿉니다.', '예를 들어 1010은 A, 1111은 F입니다. 왼쪽 묶음이 4자리보다 짧으면 앞에 0을 채웁니다.'],
    [/임피던스.*(?:강하|전압).*단락전류|단락전류.*임피던스/i, '단락전류 배수 = 100 ÷ 임피던스 전압(%)', '5%라면 100 ÷ 5 = 20배입니다. 퍼센트 숫자를 그대로 100에서 나눕니다.'],
    [/회전자.*입력.*슬립|슬립.*2차.*동손/i, '2차 동손 = 슬립 × 회전자 입력', '슬립 4%는 0.04로 바꾸고, 10 kW는 10,000 W로 바꾼 뒤 곱합니다.'],
    [/가스.*소\s*모량|연료.*소\s*비량|보일러.*발열량.*효율/i, '연료량 = 필요한 열량 ÷ (연료 발열량 × 효율)', '먼저 물의 열량 m×c×온도차를 구하고, 효율 95%는 0.95로 바꿔 발열량과 곱한 값으로 나눕니다.'],
    [/2전력계|두.*전력계/i, '3상 소비전력 = 첫째 전력계 P₁ + 둘째 전력계 P₂', '두 전력계가 가리킨 값을 그대로 더합니다.'],
    [/성능계수|\bCOP\b/i, '냉동 COP = 냉동효과(Qₗ) ÷ 압축기에 넣은 일(W)', '분자와 분모의 단위를 같게 맞춘 뒤 나눕니다. COP에는 단위가 남지 않습니다.'],
    [/냉동톤|\bRT\b/i, '1 USRT = 약 3.517 kW = 약 3,024 kcal/h', 'RT를 kW로 바꿀 때는 3.517을 곱하고, 반대로 바꿀 때는 3.517로 나눕니다.'],
    [/상대습도|수증기분압/i, '상대습도(%) = 현재 수증기압 ÷ 포화수증기압 × 100', '두 압력의 단위를 같게 맞춘 뒤 나누고 마지막에 100을 곱합니다.'],
    [/옴의 법칙|저항.*(?:전류|전압)|(?:전류|전압).*저항/i, 'V = I × R (I = V ÷ R, R = V ÷ I)', 'V·A·Ω 단위를 확인하고, 모르는 값 하나만 왼쪽에 남깁니다.'],
    [/3상|삼상|역률.*(?:전력|전압|전류)|유효전력/i, '3상 유효전력 P = √3 × V × I × cosφ', 'W로 계산한 뒤 kW가 필요하면 1,000으로 나눕니다.'],
    [/펌프|양정|수동력|축동력/i, '펌프 동력 P = ρ × g × Q × H ÷ η', '유량 Q를 m³/s로 맞추고 효율은 %가 아닌 소수로 넣습니다.'],
    [/송풍기|팬.*법칙|상사법칙/i, '팬 법칙: 풍량 Q∝N, 압력 H∝N², 동력 P∝N³', '회전수 비를 먼저 만들고 풍량은 1제곱, 압력은 2제곱, 동력은 3제곱합니다.'],
    [/유량|유속|단면적/i, '체적유량 Q = 단면적 A × 속도 v', '지름이 주어지면 A = πd²÷4로 면적을 먼저 구하고 mm는 m로 바꿉니다.'],
    [/열관류|열통과/i, '벽을 통과하는 열량 Q = K × A × ΔT', '열관류율·면적·온도차를 차례로 곱하고 시간 단위를 확인합니다.'],
    [/열량|비열|현열|온도차/i, '현열 Q = m × c × ΔT', '질량·비열·온도차를 같은 단위계로 맞춘 뒤 차례로 곱합니다.'],
    [/냉각수량|냉수량/i, '물의 열량 Q = m × c × ΔT', '물의 비열은 약 4.2 kJ/(kg·K)입니다. 시간 단위를 맞춘 뒤 Q를 비열과 온도차로 나눕니다.'],
    [/냉동능력.*(?:응축기|냉각수)|(?:응축기|냉각수).*냉동능력/i, '응축기 방열량 = 냉동능력 + 압축일', '냉각수가 가져간 열량을 먼저 구하고 압축기 동력을 빼면 증발기의 냉동능력이 됩니다.'],
    [/냉동능력|냉매순환량/i, '냉동능력 Qₗ = 냉매유량 m × 냉동효과 Δh', 'P-h 선도에서 증발기 입구와 출구의 엔탈피 차를 찾은 뒤 냉매유량과 곱합니다.'],
    [/카르노.*(?:냉동|성능계수)|(?:냉동|성능계수).*카르노/i, '역카르노 냉동 COP = Tₗ ÷ (Tₕ - Tₗ)', '온도는 반드시 ℃에 273을 더한 절대온도 K로 바꾼 뒤 계산합니다.'],
    [/압력.*(?:절대압|진공압)|(?:절대압|진공압).*압력|대기압.*진공|진공.*절대압/i, '절대압력 = 대기압력 - 진공압력', 'mmHg와 kPa의 단위를 먼저 통일합니다. 76 mmHg는 약 10.13 kPa이므로 대기압에서 이 값을 뺍니다.'],
    [/팬.*동력|송풍기.*동력|회전수.*(?:풍량|정압|동력)/i, '팬 법칙: Q₂/Q₁=N₂/N₁, H₂/H₁=(N₂/N₁)², P₂/P₁=(N₂/N₁)³', '회전수 비를 먼저 구한 뒤 풍량은 1제곱, 압력은 2제곱, 동력은 3제곱합니다.'],
    [/펌프.*토출압|토출압.*펌프/i, '펌프 수동력 P = ρgQH', '축동력에 효율을 곱해 수동력을 구하고, 유량을 m³/s로 바꾼 뒤 양정 H를 계산합니다.'],
    [/냉방.*현열비|현열비/i, '현열비 SHF = 현열 ÷ (현열 + 잠열)', '분모에는 현열과 잠열을 모두 더하고, 분자에는 현열만 넣습니다.'],
    [/열통과율|열관류율/i, '1/K = 1/α₁ + Σ(L/λ) + 1/α₂', '실내·외 표면 열저항과 각 재료층의 두께/열전도율을 모두 더한 뒤 역수를 취합니다.'],
    [/수분량|절대습도.*공기량/i, '수분량 = 건공기량 × 절대습도 차', '입구와 출구 절대습도의 차를 구하고 건공기 질량유량과 곱합니다.'],
    [/변압기.*(?:전압|권수)|권수비/i, 'V₁/V₂ = N₁/N₂', '전압비와 권수비는 같습니다. 같은 위치의 1차·2차 값을 서로 대응시켜 비례식으로 풉니다.'],
    [/합성저항|병렬저항/i, '병렬회로는 1/R = 1/R₁ + 1/R₂ + …', '먼저 역수들을 더한 뒤 마지막에 다시 역수를 취합니다. 직렬회로는 저항을 그대로 더합니다.'],
    [/주파수|동기속도|극수/i, '동기속도 Nₛ = 120f ÷ P', '주파수 f와 극수 P를 넣습니다. 유도전동기의 실제 속도는 슬립 때문에 동기속도보다 조금 작습니다.'],
    [/효율/i, '효율(%) = 유효한 출력 ÷ 공급한 입력 × 100', '입력과 출력의 단위를 같게 만든 뒤 나누고 마지막에 100을 곱합니다.'],
  ];
  return rules.find(([pattern]) => pattern.test(source))?.slice(1) || null;
}

function conceptGuide(source, answerText, negative) {
  const rules = [
    [/일의 열당량|427.*kcal/i, '일의 열당량은 기계적 일과 열량의 환산관계입니다. 1kcal≈427kgf·m이므로 반대로 1kgf·m≈1/427kcal입니다.'],
    [/특성방정식.*근|방정식의 근/i, '전달함수의 특성근은 분모를 0으로 놓고 인수분해해 구합니다. 예를 들어 s²+s-6=(s+3)(s-2)이므로 근은 -3과 2입니다.'],
    [/헬라이드.*토치|토치.*불꽃.*누설/i, '헬라이드 토치는 할로겐계 냉매가 불꽃에 들어오면 색이 변하는 성질을 이용합니다. 누설량이 작을 때는 녹색, 많아지면 청록·청색 계열로 변합니다.'],
    [/실.*내외.*온도차.*클수록|공기조화에 관한 설명/i, '냉방 때 실내외 온도차를 지나치게 크게 하면 냉방병과 불쾌감이 생기고 에너지 사용도 늘어납니다. 공조는 온도뿐 아니라 습도·청정도·기류를 적정 범위로 유지해야 합니다.'],
    [/양자화.*오차|아날로그.*디지털.*bit/i, '양자화는 연속 신호를 정해진 단계로 나누는 과정입니다. 최대 양자화 오차는 한 단계 폭의 절반이며, 비트 수가 늘수록 단계가 촘촘해져 오차가 작아집니다.'],
    [/미분요소/i, '미분요소는 입력의 변화속도에 비례해 출력하므로 전달함수는 G(s)=Ks입니다. 적분요소 K/s와 구분합니다.'],
    [/절점주파수|꺾임주파수/i, '1차 요소 1/(1+Ts)의 절점주파수는 ω=1/T입니다. T=5초이면 1÷5=0.2rad/s입니다.'],
    [/유접점.*회로.*간단|접점회로.*간단/i, '유접점 회로는 직렬 접점을 AND, 병렬 접점을 OR로 바꾸어 논리식을 만든 뒤 흡수법칙과 드모르간 법칙으로 줄입니다. 간단해진 논리식과 같은 접점 배치를 고릅니다.'],
    [/무제동.*진동|감쇠\s*.*율/i, '표준 2차 특성식 s²+2ζωₙs+ωₙ²에서 ζ가 감쇠율입니다. 무제동이면 ζ=0이고, s²+2s+2라면 계수를 비교해 ζ=1/√2입니다.'],
    [/배관.*침식/i, '배관 침식은 높은 유속, 난류, 기포·고형물 충돌, 재질과 유체의 부식성에 영향을 받습니다. 소음은 이런 현상의 결과일 수 있지만 침식을 정하는 직접 요소는 아닙니다.'],
    [/스트레이너.*종류/i, '스트레이너는 Y형·U형·V형·바스켓형 등 배관 속 이물질을 거르는 구조로 나눕니다. 보기의 형상이 실제 여과망 구조인지 확인합니다.'],
    [/루프형.*신축이음/i, '루프형 신축이음은 관 자체를 굽혀 탄성으로 팽창을 흡수하므로 설치공간과 배관 길이가 많이 필요합니다. 패킹 마모 누수는 슬리브형의 특징입니다.'],
    [/체크.*밸브.*도시기호|한 방향.*밸브.*도시기호/i, '한 방향으로만 흐르게 하는 밸브는 체크밸브(역지밸브)입니다. 원문 기호에서 흐름 화살표와 역류를 막는 디스크 모양을 확인합니다.'],
    [/레듀서.*표시|레듀서.*도시기호/i, '레듀서는 서로 다른 관경을 잇는 부속이므로 기호도 한쪽 지름이 작아지는 형태입니다. 엘보·티·캡 기호와 구분합니다.'],
    [/합성.*정전용량|콘덴서.*직렬|콘덴서.*병렬/i, '콘덴서는 병렬이면 용량을 그대로 더하고, 직렬이면 저항의 병렬처럼 역수합을 사용합니다. 같은 용량 C 두 개 직렬은 C/2입니다.'],
    [/테스크.*[앨앰]비언트|작업공간.*비작업공간/i, '태스크 앰비언트 공조는 비작업 공간에는 기본 공조를 하고, 실제 작업 자리에는 개인이 조절할 수 있는 공조를 추가하는 방식입니다.'],
    [/외기.*환기.*혼합|혼합공기.*최종온도/i, '두 공기를 섞은 온도는 각 공기량을 가중치로 한 평균입니다. 외기:환기=1:3이면 (외기온도×1+실내온도×3)÷4로 계산합니다.'],
    [/수분의 증가 없이.*가열|현열.*가열.*선도/i, '습공기선도에서 수분량 변화 없이 가열·냉각하면 절대습도가 일정합니다. 따라서 상태점은 수평 방향으로 이동합니다.'],
    [/Contact Factor|접촉계수|CF\(/i, '접촉계수 CF는 공기가 코일 표면 상태에 얼마나 가까워졌는지를 나타내며 CF=1-BF입니다. 입구·출구·코일 표면온도의 차를 같은 방향으로 잡아 비를 만듭니다.'],
    [/열 이동|열전도.*열대류.*열복사/i, '열전도는 물질 내부의 분자 작용, 대류는 유체의 이동, 복사는 전자파로 열이 전달되는 현상입니다. 고온 유체가 표면으로 이동해 열을 주는 과정은 대류입니다.'],
    [/1RT|냉동톤/i, '1냉동톤은 0℃ 물 1ton을 24시간에 0℃ 얼음으로 만드는 데 필요한 냉동능력입니다. 시간 기준이 1시간인지 24시간인지 꼭 확인합니다.'],
    [/여과작용.*분류|여과기.*분류/i, '공기여과기는 관성·충돌·확산·정전기·흡착 같은 포집 원리로 분류합니다. 유닛 교환식은 관리·교체 방식이지 여과작용 원리 분류가 아닙니다.'],
    [/안정.*필요조건|라우스|특성방정식.*안정/i, '연속 제어계가 안정하려면 특성방정식의 모든 근 실수부가 음수여야 합니다. 3차식은 계수가 모두 양수이고 라우스 배열 첫 열의 부호가 바뀌지 않는지 확인합니다.'],
    [/활성탄.*여과|유해가스.*냄새.*필터/i, '활성탄 여과기는 아주 많은 미세구멍에 냄새와 유해가스 분자를 흡착합니다. 패널·지그재그·바이패스형으로 만들 수 있습니다.'],
    [/증발압력.*저하.*증발잠열|증발잠열.*비체적/i, '증발압력이 낮아지면 포화온도도 내려가고 냉매증기의 비체적은 커집니다. 일반적인 냉매 범위에서는 증발잠열도 커지는 방향입니다.'],
    [/벽체.*열이동/i, '벽체의 열이동은 실내 표면 대류·벽 내부 전도·실외 표면 대류가 한 흐름으로 이어집니다. 각 현상이 서로 독립적으로 따로 열을 보내는 것은 아닙니다.'],
    [/규소강판.*성층|직류발전기.*철심/i, '철심을 얇은 규소강판으로 절연해 쌓으면 와전류가 흐르는 길이 끊겨 와전류손과 전체 철손이 줄어듭니다.'],
    [/유효온도|온열환경지표.*복사/i, '유효온도 ET는 기온·습도·기류를 종합하지만 복사열은 직접 반영하지 않습니다. 복사까지 고려한 지표와 구분합니다.'],
    [/고압.*증기관.*유속/i, '증기관 유속이 너무 빠르면 소음·침식·압력손실이 커집니다. 고압 증기 주관은 보통 약 30~50m/s 범위를 사용합니다.'],
    [/이상기체.*내부에너지/i, '이상기체는 분자 사이 위치에너지를 무시하므로 내부에너지가 온도만의 함수입니다. 압력과 체적은 상태식으로 온도와 연결됩니다.'],
    [/방향을 바꾸.*부속|배관.*엘보/i, '배관의 진행 방향을 바꾸는 대표 부속은 엘보입니다. 티는 분기, 리듀서는 관경 변경, 소켓은 직선 연결에 사용합니다.'],
    [/지지대.*간격|강관.*수평.*지지/i, '수평 강관은 관경이 커질수록 처짐이 줄어 허용 지지간격을 조금 넓힐 수 있습니다. 문제에 제시된 관경별 표준 간격을 적용합니다.'],
    [/3관식.*4관식|팬코일유닛.*배관/i, '팬코일 3관식은 냉수·온수 공급관을 따로 두고 환수관을 함께 써서 혼합손실이 생길 수 있습니다. 4관식은 공급·환수를 모두 분리해 동시 냉난방과 제어에 유리합니다.'],
    [/냉온수.*유량.*유속.*관경/i, '관경은 Q=Av를 이용합니다. 유량을 m³/s로 바꾸고 A=Q/v를 구한 뒤, d=√(4A/π)로 지름을 계산해 가까운 표준 관경을 고릅니다.'],
    [/염화리튬|트리에틸렌.*글리콜/i, '염화리튬과 트리에틸렌글리콜 같은 액체 흡수제는 공기 중 수분을 녹여 흡수하므로 흡수식 감습장치에 사용합니다.'],
    [/흡수식.*흡수제.*조건|결정이 생기기/i, '흡수식 냉동기의 흡수제는 냉매를 잘 흡수하고 비등점이 높으며 부식성이 작고 결정이 쉽게 생기지 않아야 합니다. 결정은 배관 막힘과 운전 불량을 일으킵니다.'],
    [/불쾌지수|온도와 습도만.*쾌적/i, '불쾌지수는 주로 건구온도와 습도를 이용해 더위의 불쾌감을 나타냅니다. 기류와 벽면 복사열은 직접 반영하지 않습니다.'],
    [/제올라이트/i, '제올라이트는 표면의 미세한 구멍에 수분을 붙잡는 고체 흡착제입니다. 따라서 제올라이트를 쓰는 제습은 흡착식입니다.'],
    [/폐루프.*장점|폐루프.*제어/i, '폐루프 제어는 출력을 되먹임해 외란과 오차를 줄이는 장점이 있지만, 구조가 복잡해지고 설치·운전·수리가 더 어려워질 수 있습니다.'],
    [/맥동.*주파수.*정류|3상.*전파정류/i, '정류 펄스 수가 많을수록 출력의 출렁임이 작아집니다. 3상 전파정류는 한 주기에 6번 정류되어 맥동주파수가 높고 맥동률이 작습니다.'],
    [/불대수|간\s*단히.*식|논리식.*간\s*단/i, '불대수에서는 같은 항을 묶고 X+X=X, X·X=X, X+X̄=1 같은 법칙을 사용합니다. 각 항에서 공통인 문자를 먼저 묶으면 식이 짧아집니다.'],
    [/2진수.*16진수|16진수.*변환/i, '2진수는 오른쪽부터 네 자리씩 묶고 각 묶음을 0~F의 16진수 한 자리로 바꿉니다. 0010·1111·0101·1001은 차례로 2·F·5·9가 됩니다.'],
    [/실효치|실효값/i, '교류 실효값은 같은 저항에서 같은 열을 내는 직류값입니다. 정현파에서는 최대값의 1/√2, 즉 약 0.707배입니다.'],
    [/계측기.*선택|측정기.*선택/i, '계측기는 정확도·감도·측정범위·응답속도와 사용 환경을 보고 고릅니다. 보기를 이런 실제 성능 기준과 관련 있는지 하나씩 대조합니다.'],
    [/배관설계.*유의|굽힘.*곡률.*반경/i, '배관은 가능한 짧고 굴곡을 적게 하며, 굽힘 반경을 충분히 크게 해야 압력손실이 줄어듭니다. 곡률반경을 작게 하면 흐름 저항과 응력이 커집니다.'],
    [/가습방법|가습.*분무/i, '공기 가습은 증기를 넣거나 물을 분무·기화해 수증기량을 늘립니다. 얼음 분무는 공기에서 열을 빼앗는 냉각 쪽이라 일반적인 가습방법으로 보지 않습니다.'],
    [/동합금.*납땜.*이음|C×F.*엘보/i, '관이음 표기에서 C는 동관 납땜 접합, F는 암나사 접합을 뜻합니다. 한쪽은 동관을 납땜하고 다른 쪽은 강관 수나사와 연결하는 90° 엘보인지 확인합니다.'],
    [/임펄스.*응답|충격.*응답/i, '전달함수는 임펄스 응답을 라플라스 변환한 값입니다. sin(ωt)의 변환이 ω/(s²+ω²)라는 기본식을 사용해 보기를 비교합니다.'],
    [/흡입관.*횡주|흡입.*수평.*구배/i, '프레온 냉동장치의 수평 흡입관은 냉동유가 압축기로 돌아가도록 압축기 쪽으로 약 1/200의 내리구배를 둡니다.'],
    [/소켓식.*이음|배관.*이음.*기호/i, '배관 기호 문제는 원문 그림의 관 끝 모양을 봅니다. 소켓식은 관 끝을 소켓 안에 끼워 접합하므로 맞대기·플랜지 기호와 구분합니다.'],
    [/Y결선.*△결선|와이.*델타|스타.*델타/i, 'Y-Δ 변환은 각 단자에서 본 저항이 같도록 바꾸는 계산입니다. 대칭회로라면 Δ의 각 저항은 Y 저항의 3배이고, 비대칭이면 마주 보는 두 저항의 곱과 전체 합을 이용합니다.'],
    [/플로우차트|순서도.*기호/i, '순서도에서 평행사변형은 입력·출력, 마름모는 조건 판단, 직사각형은 처리, 타원은 시작·끝을 뜻합니다. 그림의 외곽 모양을 먼저 확인합니다.'],
    [/벡터궤적|나이퀴스트.*선도/i, '벡터궤적은 전달함수에 s=jω를 넣고 주파수 ω를 0에서 무한대로 바꾸며 실수부와 허수부의 이동을 그립니다. 시작점·끝점과 회전 방향을 차례로 비교합니다.'],
    [/윤활.*목적/i, '냉동기 윤활유는 마찰과 마모를 줄이고 틈을 밀봉하며 마찰열을 빼내는 역할을 합니다. 열을 쌓는 것은 윤활 목적과 반대입니다.'],
    [/최종치|최종값.*정리/i, '최종값 정리는 f(∞)=lim(s→0) sF(s)로 계산합니다. F(s)에 s를 곱한 뒤 s=0을 넣고, 불안정한 극이 없는지도 확인합니다.'],
    [/비중.*(?:2\.7|가볍).*건축재료|알루미늄관/i, '알루미늄은 비중이 약 2.7로 가볍고 열·전기 전도성과 가공성이 좋으며, 표면 산화피막 덕분에 내식성도 좋습니다.'],
    [/비중.*(?:9|8\.9).*전연성|동관/i, '동은 비중이 약 8.9이고 열·전기 전도성이 매우 좋으며 연성과 전연성이 커 가공하기 쉽습니다. 배관과 건축 재료로 널리 사용합니다.'],
    [/산술평균.*온도|가열코일.*증기.*입구.*출구/i, '증기 온도를 tₛ, 공기 입·출구 온도를 t₁·t₂라 하면 산술평균 온도차는 tₛ-(t₁+t₂)/2입니다. 공기 평균온도를 먼저 구해 증기온도에서 뺍니다.'],
    [/포화액선.*건조포화.*만나|임계점/i, '포화액선과 건조포화증기선이 만나는 끝점을 임계점이라 합니다. 임계점보다 높은 온도에서는 압력만으로 기체를 액화하기 어렵습니다.'],
    [/폴리트로픽/i, '폴리트로픽 변화는 PVⁿ=일정입니다. n=0은 정압, n=1은 등온, n=비열비는 단열, n이 매우 크면 정적 변화로 봅니다.'],
    [/열에너지.*방향성|열.*흐름.*방향/i, '열이 자연히 고온에서 저온으로 흐른다는 방향성을 설명하는 것은 열역학 제2법칙입니다. 제1법칙은 에너지의 양이 보존된다는 내용입니다.'],
    [/전기력선/i, '전기력선은 양전하에서 나와 음전하로 들어가고 서로 교차하지 않습니다. 진행 방향은 전위가 높은 곳에서 낮은 곳이며 그 점의 전기장 방향과 같습니다.'],
    [/압력.*값이.*다른|압력.*환산/i, '압력 단위를 하나로 바꿔 비교합니다. 1kgf/cm²≈98.0665kPa, 1mmAq≈9.80665Pa, 1atm≈101.325kPa 관계를 사용합니다.'],
    [/열과 일|한 사이클.*열량.*일/i, '열과 일은 과정 중에 전달되는 에너지입니다. 한 사이클 뒤에는 계의 내부에너지 변화가 0이므로, 계가 받은 순열량과 계가 한 순일의 크기가 같습니다.'],
    [/세정식.*집진|분무수.*공해물질/i, '세정식 집진기는 배기가스에 물을 분무해 먼지와 가스상 오염물질을 물방울에 붙이거나 녹여 제거합니다. 그래서 흡수·용해·응축 작용을 함께 이용합니다.'],
    [/자기유지|푸시버튼.*전자접촉기/i, '자기유지회로는 기동 버튼을 잠깐 눌러도 전자접촉기의 보조접점이 전원 경로를 유지합니다. 정지 버튼을 누르면 그 경로가 끊겨 출력이 꺼집니다.'],
    [/신선.*공기량|CO.*허용농도|환기.*이산화탄소/i, '필요 환기량은 사람이 내는 CO₂량을 실내 허용농도와 외기농도의 차로 나눠 구합니다. ppm과 %를 같은 비율 단위로 바꾸고 전체 인원수를 먼저 계산합니다.'],
    [/제어대상.*출력.*원하는.*값|외부에서.*주어지는.*값/i, '제어계에서 출력이 따라가도록 외부에서 정해 주는 값이 목표값입니다. 실제 출력인 제어량과 목표값의 차가 편차입니다.'],
    [/감압밸브.*부속|감압밸브.*주위/i, '감압밸브 주위에는 차단밸브·압력계·스트레이너·바이패스처럼 운전과 정비에 필요한 장치를 둡니다. 단순 개폐용 콕은 이 표준 부속 구성과 구분합니다.'],
    [/바이패스.*팩터|By-?pass.*Factor/i, '바이패스 팩터는 공기가 코일과 충분히 접촉하지 못하고 지나간 비율입니다. 코일 면적·열수·접촉시간이 늘면 작아지고, 이용 가능한 전열면적이 줄면 커집니다.'],
    [/유체.*증기.*기호|파이프.*유체.*기호/i, '배관 유체 식별기호는 원문 도면의 선 모양과 문자 약호를 기준으로 봅니다. 증기·물·공기·가스는 비슷해 보여도 선 종류나 약호가 다르므로 범례와 대조합니다.'],
    [/냉각코일.*상태변화|공기조화.*상태변화/i, '일반 냉각코일을 지나는 공기는 온도가 내려가고, 코일 표면이 노점보다 낮으면 수분도 응축되어 절대습도가 함께 내려갑니다. 선도에서는 냉각·감습 방향을 고릅니다.'],
    [/기계설비성능점검업.*기술인력/i, '기계설비성능점검업 기술인력 문항은 책임기계설비유지관리자의 등급과 필요한 인원 구성을 묻습니다. 법정 구성에 없는 등급·인원 조합을 구분해야 합니다.'],
    [/압력.*변위.*변환|변환.*요소.*노즐플래퍼/i, '압력을 변위로 바꾸는 요소에는 벨로즈·다이어프램·부르동관처럼 압력에 따라 실제로 휘거나 늘어나는 부품을 씁니다. 노즐플래퍼는 변위를 공기압 신호로 바꾸는 쪽입니다.'],
    [/BCR|바이오.*클린|생물학적.*클린/i, 'BCR은 먼지뿐 아니라 미생물까지 관리하는 바이오 클린룸입니다. 의약품·병원·식품처럼 세균 오염 제어가 중요한 곳에 사용합니다.'],
    [/CA.*저장|기체조성.*저장|산소농도.*저장/i, 'CA 저장은 저장고의 산소·이산화탄소 농도와 온도·습도를 조절해 과일과 채소의 호흡을 늦추는 방법입니다. 부패와 숙성을 늦춰 저장기간을 늘립니다.'],
    [/개별.*난방|개별식.*난방/i, '개별난방은 각 실이나 세대가 난방기를 따로 운전합니다. 필요한 곳만 켤 수 있어 조절은 쉽지만 기기 관리가 분산되고 실내 공기나 안전 관리가 필요합니다.'],
    [/HEPA|공기.*여과|에어.*필터/i, '공기여과기는 큰 먼지를 먼저 거르고 미세한 먼지는 뒤쪽의 고성능 필터에서 제거합니다. HEPA 필터는 미세입자 제거용이므로 보통 프리필터 뒤에 둡니다.'],
    [/2단.*압축|이단.*압축|중간냉각/i, '2단 압축 냉동은 압축을 두 번으로 나누고 중간에서 냉각해 토출온도와 압축일을 줄입니다. 각 단의 압력비가 비슷하도록 중간압력을 정하면 유리합니다.'],
    [/가스미터|가스.*계량기/i, '가스미터는 검침·교체가 쉽고 환기가 잘되는 곳에 두며, 화기·전기점멸기·습기 많은 곳은 피합니다. 설치 높이와 이격거리는 문제에 제시된 기준을 구분해야 합니다.'],
    [/가스.*배관|가스관|슬리브.*배관/i, '가스배관은 누출되었을 때 실내에 체류하지 않도록 하고, 전기설비·화기와 필요한 거리를 둡니다. 벽이나 바닥을 관통할 때는 슬리브로 배관을 보호합니다.'],
    [/열역학.*제2법칙|제2종.*영구기관|클라우지우스|켈빈.*플랑크/i, '열역학 제2법칙은 열이 저절로 저온부에서 고온부로 이동하지 않으며, 받은 열을 전부 일로 바꾸는 기관도 만들 수 없다는 법칙입니다. 실제 과정에는 방향성과 손실이 있습니다.'],
    [/엔트로피/i, '엔트로피는 에너지가 얼마나 퍼져 있어 일로 바꾸기 어려운지를 나타내는 상태량입니다. 가역과정에서는 받은 열을 절대온도로 나눈 값으로 변화를 계산합니다.'],
    [/자기.*차폐|자기실드|차폐.*자성/i, '자기 차폐는 투자율이 큰 재료로 자기력선이 보호 대상 대신 차폐재를 지나가게 합니다. 전기장 차폐와 달리 자성재료의 성질이 중요합니다.'],
    [/파형률|파고율|실효값|평균값/i, '교류의 실효값은 같은 열을 내는 직류값이고, 파형률은 실효값÷평균값, 파고율은 최대값÷실효값입니다. 정현파에서는 실효값이 최대값의 약 0.707배입니다.'],
    [/직류기.*정류|정류자|브러시.*중성축/i, '직류기의 정류는 코일 전류의 방향을 바꾸는 과정입니다. 브러시는 중성축 부근에 두고 보극 등으로 리액턴스 전압과 불꽃을 줄입니다.'],
    [/PLC|프로그램.*제어기/i, 'PLC는 입력 신호를 읽고 저장된 프로그램의 논리대로 연산해 출력을 켜거나 끄는 산업용 제어기입니다. 릴레이 회로를 소프트웨어로 구성하기 쉽습니다.'],
    [/바리스터|서지.*보호/i, '바리스터는 전압이 일정 수준을 넘으면 저항이 급격히 작아져 서지 전압을 흡수합니다. 평상시에는 큰 저항으로 회로에 거의 영향을 주지 않습니다.'],
    [/단위.*계단|단위.*임펄스|신호\s*흐름|논리회로|논리식|불대수|블[록럭]선도|라플라스/i, '제어·논리 문제는 입력에서 출력까지 신호가 어떻게 바뀌는지 한 단계씩 따라갑니다. 블록은 직렬이면 곱하고 병렬이면 더하며, 논리식은 AND·OR·NOT 관계로 바꿔 확인합니다.'],
    [/냉수.*열원|열원.*방식|직접팽창|간접팽창/i, '직접팽창식은 냉매가 실내 코일에서 직접 증발하고, 간접식은 냉동기가 물이나 브라인을 냉각해 공조기로 보냅니다. 그림에서 냉매배관인지 냉수배관인지 먼저 구분합니다.'],
    [/공조프로세스|지하수.*예냉|예냉.*냉각코일/i, '지하수 예냉 뒤 냉각코일을 통과하면 먼저 현열이 줄고, 코일 표면이 노점보다 낮아지면 냉각과 제습이 함께 일어납니다. 선도에서 각 장치 전후의 상태점을 이 순서로 연결합니다.'],
    [/냉각탑.*보충수/i, '냉각탑 보충수는 증발로 없어진 물, 바람에 날아간 비산수, 농축을 막기 위해 버리는 블로우다운 물을 모두 채워야 합니다. 따라서 세 손실의 합입니다.'],
    [/실내.*공기질.*이\s*산화질소|이\s*산화질소.*권고기준/i, '이 문항의 실내공기질 권고기준에서 해당 다중이용시설의 이산화질소 기준은 0.1ppm 이하입니다. 법령 수치 문항은 대상 시설과 단위를 함께 기억합니다.'],
    [/회로.*R의 값|회로.*저항.*값|그림과 같은 회로/i, '그림의 전원전압과 계기 지시전압을 먼저 구분한 뒤 옴의 법칙을 적용합니다. 계기 내부저항에 걸리는 전압비를 식으로 세워 미지 저항 R만 왼쪽에 남깁니다.'],
    [/이상 기체.*체적이.*일정/i, '체적이 고정된 이상기체는 P/T가 일정합니다. 가열해 절대온도 T가 올라가면 같은 비율로 압력 P도 올라갑니다.'],
    [/등마찰손실법/, '등마찰손실법은 덕트나 배관의 단위 길이당 마찰손실이 같아지도록 관경을 정하는 방법입니다. 유량이 달라져도 같은 마찰손실 기준으로 지름을 고르는 것이 핵심입니다.'],
    [/플레이트형.*열교환|전열판.*겹쳐|판과 판.*지그재그/, '플레이트형 열교환기는 얇은 전열판을 여러 장 겹쳐 두 유체를 번갈아 흐르게 합니다. 전열면적이 크고 판의 증감으로 용량을 바꾸기 쉬워 좁은 설치면적에 유리합니다.'],
    [/플래시.*가스|flash.*gas/i, '플래시 가스는 액 냉매가 압력강하나 외부 열 때문에 액관 안에서 미리 증발할 때 생깁니다. 액관 입상, 스트레이너 막힘, 직사광선은 원인이지만 관경이 큰 것은 압력손실을 줄이는 쪽입니다.'],
    [/LP.*가스|프로판.*부탄/i, 'LP가스는 액화석유가스로 주성분은 프로판(C₃H₈)과 부탄(C₄H₁₀)입니다. 프로필렌·부틸렌은 대표 주성분으로 묶지 않습니다.'],
    [/냉수코일.*풍속|코일.*2\s*[~～-]\s*3m\/s/i, '공기가 냉수코일을 너무 빠르게 지나면 열교환이 부족하고 물방울이 날릴 수 있습니다. 일반 설계에서는 약 2~3 m/s 범위를 사용합니다.'],
    [/행거|인서트|지지철물/, '인서트는 천장 콘크리트 등에 미리 묻어 행거나 지지철물을 매다는 부품입니다. 턴버클은 길이 조절, 가이드와 스토퍼는 배관의 이동을 제한하는 역할입니다.'],
    [/마찰손실.*(?:속도수두|관.*지름|배관.*길이)/, '직선관의 마찰손실은 배관 길이와 속도수두에 비례하고 관 지름이 커질수록 작아집니다. 유속이 커지면 속도수두가 유속의 제곱으로 증가합니다.'],
    [/각개.*통기|트랩마다.*통기관/, '각개통기는 각 위생기구의 트랩마다 통기관을 따로 연결합니다. 트랩의 봉수를 가장 안정적으로 보호해 자기 사이펀을 막는 이상적인 방식입니다.'],
    [/패널.*복사|복사.*난방/, '복사난방은 넓은 바닥·벽·천장 면에서 복사열을 전달하므로 실내 온도분포가 고르고 같은 쾌감에서 공기온도를 조금 낮게 유지할 수 있습니다. 방열면적은 작아지는 것이 아니라 넓어집니다.'],
    [/수직형.*공조|바닥.*좁.*층고.*높/, '수직형 공조기는 구성품을 위아래로 배치해 설치 바닥면적을 줄입니다. 바닥이 좁고 층고가 높은 기계실에 알맞습니다.'],
    [/정치제어|목표값.*일정/, '정치제어는 목표값이 시간에 따라 변하지 않고 일정한 제어입니다. 온도·압력·수위 등을 정해진 값으로 유지하는 공정제어가 대표적입니다.'],
    [/서미스터|온도.*저항/, '서미스터는 온도 변화에 따라 저항값이 크게 달라지는 반도체 센서입니다. 그래서 온도 검출과 온도 보상에 사용합니다.'],
    [/콘덴서.*위상|전압.*전류.*90/, '순수 콘덴서 회로에서는 전류가 전압보다 90° 앞섭니다. 같은 말로 전압은 전류보다 90° 뒤집니다.'],
    [/전동기.*회전방향|3상.*2선.*접속/, '3상 유도전동기의 회전방향은 세 전원선 가운데 임의의 두 선을 서로 바꾸면 역전됩니다. 상순서가 반대로 바뀌기 때문입니다.'],
    [/변압기|전자유도/, '변압기는 교류가 만드는 변화 자속과 전자유도 작용으로 전압을 바꿉니다. 1차와 2차 권선은 자속으로 결합됩니다.'],
    [/R-L-C|공진|리액턴스/i, 'R-L-C 직렬회로의 공진에서는 유도리액턴스와 용량리액턴스가 같아 서로 상쇄됩니다. 이때 임피던스는 저항만 남아 전류와 소비전력이 최대가 됩니다.'],
    [/라플라스|전달함수|블록선도/, '블록선도는 직렬 블록은 곱하고 병렬 블록은 더하며, 피드백은 G/(1±GH) 형태로 정리합니다. 입력과 출력의 비가 전달함수입니다.'],
    [/피드백.*제어|되먹임.*제어/, '피드백 제어는 출력값을 검출해 목표값과 비교하고 오차가 줄어들도록 조작합니다. 검출부는 현재 출력 상태를 측정해 비교부로 되돌려 보냅니다.'],
    [/비례.*동작|P\s*동작/i, '비례동작(P)은 현재 편차에 비례한 크기로 조작량을 냅니다. 반응은 빠르지만 부하가 바뀌면 정상상태에서 잔류편차가 남을 수 있습니다.'],
    [/스트레인.*게이지|전위차계|검출부|센서/, '검출기는 온도·압력·변위 같은 물리량을 제어기가 읽을 수 있는 전기신호로 바꿉니다. 문제의 측정 대상과 센서의 변환 원리를 대응시키면 됩니다.'],
    [/습공기|절대습도|상대습도|노점|엔탈피/, '습공기선도에서는 건구·습구온도, 상대습도, 절대습도, 엔탈피와 수증기분압의 관계를 읽습니다. 가열·냉각·가습·제습 과정에서 어느 값이 일정한지 먼저 판단해야 합니다.'],
    [/단열.*가습|수분무.*가습/, '단열가습은 공기의 현열을 물의 증발잠열로 바꾸므로 엔탈피가 거의 일정합니다. 공기 온도는 내려가고 절대습도는 올라갑니다.'],
    [/냉방부하|난방부하|열부하/, '공조부하는 벽·창·외기·사람·조명·기기에서 들어오거나 나가는 열을 합해 구합니다. 현열은 온도, 잠열은 수분 변화와 관련되므로 두 부하를 구분해야 합니다.'],
    [/덕트|송풍기|취출구/, '덕트와 송풍기 문제는 필요한 풍량, 덕트 마찰손실, 국부저항과 취출 특성을 함께 봅니다. 풍량을 확보하면서 소음과 압력손실이 지나치게 커지지 않는 조건이 올바른 설계입니다.'],
    [/보일러|증기난방|온수난방/, '보일러와 난방배관은 열매체가 증기인지 온수인지에 따라 운전 특성이 달라집니다. 증기는 잠열로 빠르게 가열하고, 온수는 온도와 유량으로 방열량을 조절하기 쉽습니다.'],
    [/압축기/, '압축기는 증발기에서 온 저압 냉매증기를 흡입해 응축 가능한 고압으로 올립니다. 액 냉매가 들어오면 액압축이 생기므로 흡입측은 증기 상태를 유지해야 합니다.'],
    [/응축기/, '응축기는 압축기에서 나온 고온·고압 냉매증기의 열을 냉각수나 공기로 버려 액체로 만듭니다. 응축압력과 냉각 조건이 나빠지면 압축동력이 증가합니다.'],
    [/증발기/, '증발기는 저압 액 냉매가 주위의 열을 흡수하며 증발하는 곳입니다. 냉매가 고르게 공급되고 출구에서 액이 압축기로 넘어가지 않게 해야 합니다.'],
    [/팽창밸브|모세관|교축/, '팽창장치는 고압 액 냉매를 교축해 증발압력까지 낮추고 증발기에 필요한 냉매량을 조절합니다. 교축과정은 열교환과 일이 거의 없어 엔탈피가 일정합니다.'],
    [/냉매/, '좋은 냉매는 증발잠열이 크고 적당한 압력에서 운전되며 화학적으로 안정해야 합니다. 독성·가연성·부식성과 환경 영향도 작아야 합니다.'],
    [/냉동사이클|냉동.*과정|냉동능력|성능계수|COP/i, '증기압축 냉동사이클은 압축→응축→팽창→증발 순서입니다. 냉동효과는 증발기에서 흡수한 열이고 COP는 그 열을 압축일로 나눈 값입니다.'],
    [/브라인/, '브라인은 냉동기에서 냉각된 뒤 부하까지 냉열을 운반하는 2차 냉매입니다. 낮은 온도에서도 얼지 않아야 하고 부식성이 작아야 합니다.'],
    [/배관.*구배|배관.*이음|플랜지|용접|플레어|스위블/, '배관 이음과 구배는 유체 종류, 압력, 관경, 분해 필요성과 응축수·오일의 흐름을 기준으로 정합니다. 큰 관이나 분해가 필요한 곳은 플랜지, 영구 접합은 용접을 주로 사용합니다.'],
    [/체크.*밸브|역지.*밸브/, '체크밸브는 유체를 한 방향으로만 흐르게 해 역류를 막습니다. 펌프 토출측이나 냉매·급수 배관의 역류 방지에 사용합니다.'],
    [/트랩|배수|통기관/, '배수트랩의 봉수는 하수관의 냄새와 유해가스가 실내로 역류하는 것을 막습니다. 통기관은 배관 압력을 안정시켜 사이펀이나 역압으로 봉수가 깨지는 것을 방지합니다.'],
    [/펌프|수격작용/, '펌프 배관은 흡입저항과 공기 고임을 줄이고 역류·수격을 막도록 구성합니다. 밸브를 급히 닫으면 유속이 갑자기 변해 수격압이 커집니다.'],
    [/보온|보냉|결로/, '보온·보냉은 열의 출입을 줄이고 표면온도가 노점 아래로 내려가 생기는 결로를 방지합니다. 재료는 열전도율과 흡수율이 작고 내구성이 좋아야 합니다.'],
    [/급수|급탕|위생기구/, '급수·급탕설비는 필요한 수량과 압력을 확보하면서 역류와 수격을 막아야 합니다. 위생기구 수, 동시사용률, 배관 손실을 함께 고려합니다.'],
    [/전압|전류|전력|저항|옴/, '전기회로는 전압 V, 전류 I, 저항 R의 관계 V=IR을 기본으로 봅니다. 전력은 직류·저항회로에서 P=VI=I²R=V²/R로 서로 바꿔 계산할 수 있습니다.'],
    [/전동기|유도전동기/, '유도전동기는 회전자계가 회전자에 전류를 유도해 토크를 만듭니다. 실제 회전속도는 동기속도보다 느리며 그 차이를 슬립으로 나타냅니다.'],
    [/법령|산업안전|고압가스|기계설비법/, '법령 문항은 대상 설비, 수치, 주체와 검사·신고 시점을 서로 바꾸어 출제하는 경우가 많습니다. 문제의 원문 기준에서 해당되는 대상과 예외를 구분해야 합니다.'],
  ];
  const guide = rules.find(([pattern]) => pattern.test(source))?.[1];
  if (!guide) return '';
  return `${guide}${negative ? ` 따라서 ‘${answerText}’ 보기가 일반 원리와 맞지 않는 예외입니다.` : ''}`;
}

function beginnerExplanation(question) {
  const answer = question.answer;
  const answerText = plain(question.choices[answer - 1]?.text || question.choices[answer - 1]?.html || `${answer}번`);
  const stem = plain(question.text || question.html || '문제의 조건');
  const source = `${stem} ${question.choices.map((choice) => plain(choice.text || choice.html)).join(' ')}`;
  const asksNumber = /계산|구하|산출|얼마|몇\s*(?:개|배|%|℃|도|kW|W|kcal|kg|m|Pa|V|A|Ω|rpm|RT)?|수치는|값은\??$/i.test(stem)
    || /(?:신축량|손실량|효율|표면온도|열전도율|열관류율|절대압력|저항|면적|방열량|환기량)(?:은|는|이|가)?\??/i.test(stem)
    || (/[-+]?\d+(?:\.\d+)?\s*(?:kW|W|kcal|kg|m³|m2|m²|Pa|MPa|V|A|Ω|rpm|RT|℃|%)/i.test(stem)
      && /동력|전력|유량|풍량|열량|효율|능력|온도|압력|저항/i.test(stem));
  const guide = calculationGuide(source);
  if (asksNumber && guide) {
    return [
      `핵심은 문제에서 요구한 값을 먼저 표시하고 단위를 맞추는 것입니다. 사용할 식은 ${guide[0]}입니다.`,
      guide[1],
      `계산값과 단위가 ‘${answerText}’와 일치하므로 정답은 ${answer}번입니다.`,
    ].join(' ');
  }
  const normalizedPolarity = normalized(stem);
  const negative = /옳지않|아닌|틀린|거리가먼|해당되지않|관계없는|잘못된|부적당/.test(normalizedPolarity);
  const concept = conceptGuide(source, answerText, negative);
  if (concept) {
    return `${concept} ${negative ? '' : `이 원리에 맞는 보기는 ‘${answerText}’이므로 `}정답은 ${answer}번입니다.`.replace(/\s+/g, ' ').trim();
  }
  const clue = stem.replace(/\([^)]*\)/g, ' ').replace(/(?:으로|로)?\s*(?:옳은|알맞은|적당한|틀린|옳지 않은|거리가 먼|해당하지 않는)?\s*것은\??$/g, '').replace(/\s+/g, ' ').trim();
  return [
    `핵심 조건은 ‘${clue || stem}’입니다.`,
    negative
      ? `이 조건의 일반적인 설명과 맞지 않는 예외가 ‘${answerText}’이므로 ${answer}번이 정답입니다.`
      : `이 조건을 그대로 나타내는 보기 또는 계산 결과가 ‘${answerText}’이므로 ${answer}번이 정답입니다.`,
    '문제의 부정 표현과 단위를 한 번 더 확인하면 비슷한 보기를 구분하기 쉽습니다.',
  ].join(' ');
}

function fuzzyExplanationSource(question, candidates, minimumStem = 0.9) {
  const targetStem = plain(question.text || question.html || '');
  const targetAnswer = correctChoice(question);
  const normalizedStem = normalized(targetStem);
  let best = null;
  for (const candidate of candidates) {
    const lengthRatio = Math.min(normalizedStem.length, candidate.normalizedStem.length)
      / Math.max(normalizedStem.length, candidate.normalizedStem.length, 1);
    if (lengthRatio < 0.62) continue;
    const stemScore = diceSimilarity(targetStem, candidate.stem);
    if (stemScore < minimumStem) continue;
    const answerScore = diceSimilarity(targetAnswer, candidate.answerText);
    if (answerScore < 0.9) continue;
    const score = stemScore * 0.85 + answerScore * 0.15;
    if (!best || score > best.score) best = { ...candidate, score, stemScore, answerScore };
  }
  return best;
}

const hvac = readCatalog('data/hvac.js');
const hansol = readCatalog('data/hvac-hansol.js');
const correctedQuestionText = new Map([
  ['hvac-hansol-2020-4:29', '암모니아 냉동기의 증발온도 -20℃, 응축온도 35℃일 때 ① 이론 성적계수와 ② 실제 성적계수는 약 얼마인가? (단, 팽창밸브 직전의 액온도는 32℃, 흡입가스는 건포화증기이고, 체적효율은 0.65, 압축효율은 0.80, 기계효율은 0.9로 한다.)'],
  ['hvac-hansol-2021-2:79', '자동제어계에서 과도응답 중 지연시간을 옳게 정의한 것은?'],
  ['hvac-hansol-2025-3:9', '다음 그림과 같은 덕트에서 점 ①의 정압 P₁=15mmAq, 속도 V₁=10m/s일 때, 점 ②에서의 전압은? (단, ①-② 구간의 전압손실은 2mmAq, 공기의 밀도는 1kg/m³로 한다.)'],
]);
const correctedChoices = new Map([
  ['hvac-hansol-2020-4:29', ['① 0.5, ② 3.8', '① 3.9, ② 2.8', '① 3.5, ② 2.5', '① 4.3, ② 2.8']],
]);
// These questions were previously confirmed against an identical question in
// the verified HVAC catalog. Keep the provenance even when a newer importer
// already emits the corrected answer and no value has to be changed again.
const verifiedAnswerCorrectionIds = new Set([
  'hvac-hansol-2017-2:69', 'hvac-hansol-2017-2:70',
  'hvac-hansol-2020-3:1', 'hvac-hansol-2020-3:2', 'hvac-hansol-2020-3:3',
  'hvac-hansol-2020-3:4', 'hvac-hansol-2020-3:5', 'hvac-hansol-2020-3:6',
  'hvac-hansol-2020-3:8', 'hvac-hansol-2020-3:9', 'hvac-hansol-2020-3:16',
  'hvac-hansol-2020-3:17', 'hvac-hansol-2020-3:24', 'hvac-hansol-2020-3:26',
  'hvac-hansol-2020-3:27', 'hvac-hansol-2020-3:28', 'hvac-hansol-2020-3:29',
  'hvac-hansol-2020-3:31', 'hvac-hansol-2020-3:32', 'hvac-hansol-2020-3:34',
  'hvac-hansol-2020-3:35', 'hvac-hansol-2020-3:37', 'hvac-hansol-2020-3:38',
  'hvac-hansol-2020-3:39', 'hvac-hansol-2020-3:42', 'hvac-hansol-2020-3:43',
  'hvac-hansol-2020-3:44', 'hvac-hansol-2020-3:45', 'hvac-hansol-2020-3:48',
  'hvac-hansol-2020-3:50', 'hvac-hansol-2020-3:51', 'hvac-hansol-2020-3:52',
  'hvac-hansol-2020-3:53', 'hvac-hansol-2020-3:57', 'hvac-hansol-2020-3:60',
  'hvac-hansol-2020-3:61', 'hvac-hansol-2020-3:62', 'hvac-hansol-2020-3:67',
  'hvac-hansol-2020-3:68', 'hvac-hansol-2020-3:72', 'hvac-hansol-2020-3:73',
  'hvac-hansol-2020-3:79', 'hvac-hansol-2020-3:80', 'hvac-hansol-2025-2:54',
]);
for (const round of hansol.rounds) {
  for (const question of round.questions) {
    const key = `${round.id}:${question.number}`;
    const correction = correctedQuestionText.get(key);
    if (correction) {
      question.text = correction;
      question.html = correction;
    }
    const choiceCorrection = correctedChoices.get(key);
    if (choiceCorrection) question.choices = choiceCorrection.map((text) => ({ text, html: text, images: [] }));
  }
}
const verifiedAnswerByFullQuestion = new Map();
const verifiedAnswerByChoices = new Map();
const verifiedAnswerCandidates = [];
for (const round of hvac.rounds) {
  for (const question of round.questions) {
    const key = fullKey(question);
    if (!key) continue;
    const current = verifiedAnswerByFullQuestion.get(key) || { answers: new Set(), sources: [] };
    current.answers.add(Number(question.answer));
    current.sources.push(`${round.id}:${question.number}`);
    verifiedAnswerByFullQuestion.set(key, current);
    const choicesKey = question.choices.map((choice) => normalized(choice.text || choice.html)).join('|');
    const choiceCandidates = verifiedAnswerByChoices.get(choicesKey) || [];
    choiceCandidates.push({ round, question });
    verifiedAnswerByChoices.set(choicesKey, choiceCandidates);
    verifiedAnswerCandidates.push({
      round,
      question,
      normalizedStem: normalized(question.text || question.html),
    });
  }
}
for (const round of hansol.rounds) {
  for (const question of round.questions) {
    let verified = verifiedAnswerByFullQuestion.get(fullKey(question));
    if (!verified) {
      const choicesKey = question.choices.map((choice) => normalized(choice.text || choice.html)).join('|');
      const candidates = (verifiedAnswerByChoices.get(choicesKey) || [])
        .map((entry) => ({ ...entry, score: diceSimilarity(question.text || question.html, entry.question.text || entry.question.html) }))
        .filter((entry) => entry.score >= 0.9);
      const answers = new Set(candidates.map((entry) => Number(entry.question.answer)));
      if (candidates.length && answers.size === 1) {
        verified = {
          answers,
          sources: candidates
            .sort((left, right) => right.score - left.score)
            .map((entry) => `${entry.round.id}:${entry.question.number}`),
        };
      }
    }
    if (!verified) {
      const targetStem = normalized(question.text || question.html);
      const candidates = verifiedAnswerCandidates.flatMap((entry) => {
        const lengthRatio = Math.min(targetStem.length, entry.normalizedStem.length)
          / Math.max(targetStem.length, entry.normalizedStem.length, 1);
        if (lengthRatio < 0.72) return [];
        const stemScore = diceSimilarity(question.text || question.html, entry.question.text || entry.question.html);
        if (stemScore < 0.94) return [];
        const choiceScores = question.choices.map((choice, index) => diceSimilarity(
          choice.text || choice.html,
          entry.question.choices[index]?.text || entry.question.choices[index]?.html || '',
        ));
        const choiceAverage = choiceScores.reduce((sum, score) => sum + score, 0) / choiceScores.length;
        if (choiceAverage < 0.92 || Math.min(...choiceScores) < 0.75) return [];
        return [{ ...entry, score: stemScore * 0.7 + choiceAverage * 0.3 }];
      });
      const answers = new Set(candidates.map((entry) => Number(entry.question.answer)));
      if (candidates.length && answers.size === 1) {
        verified = {
          answers,
          sources: candidates
            .sort((left, right) => right.score - left.score)
            .map((entry) => `${entry.round.id}:${entry.question.number}`),
        };
      }
    }
    if (!verified || verified.answers.size !== 1) continue;
    const [verifiedAnswer] = verified.answers;
    if (verifiedAnswerCorrectionIds.has(`${round.id}:${question.number}`)) {
      question.answerCorrectionSource = verified.sources[0];
    }
    if (Number(question.answer) === verifiedAnswer) continue;
    question.answer = verifiedAnswer;
    question.answerCorrectionSource = verified.sources[0];
  }
}
const allHansol = hansol.rounds.flatMap((round) => round.questions.map((question) => ({ round, question })));
const hvacExplanationCandidates = hvac.rounds.flatMap((round) => round.questions
  .filter((question) => stripHansolSupplement(question.explanation))
  .map((question) => ({
    round,
    question,
    stem: plain(question.text || question.html || ''),
    normalizedStem: normalized(question.text || question.html || ''),
    answerText: correctChoice(question),
    explanation: stripHansolSupplement(question.explanation),
  })));
const sourceByStem = new Map();
const sourceByFull = new Map();
for (const entry of hvacExplanationCandidates) {
  const answerKey = normalized(entry.answerText);
  sourceByStem.set(`${answerKey}:${stemKey(entry.question)}`, entry);
  sourceByFull.set(`${answerKey}:${fullKey(entry.question)}`, entry);
}

function explanationFromSource(target, source) {
  const original = source.explanation;
  const targetAnswer = correctChoice(target);
  const notes = [];
  if (Number(target.answer) !== Number(source.question.answer)) {
    notes.push(`※ 이 한솔 문제는 원문과 보기 순서가 다릅니다. 이 화면의 정답은 ${target.answer}번입니다. 정답 보기: ‘${targetAnswer}’. 아래 해설에 적힌 답안 번호는 COMCBT 원문 순서입니다.`);
  }
  const mentionedAnswers = [...plain(original).matchAll(/(?:정답|답)\s*(?:은|:|=)?\s*([1-4])\s*번/g)]
    .map((match) => Number(match[1]));
  if (mentionedAnswers.some((answer) => answer !== Number(source.question.answer))) {
    notes.push(`※ COMCBT 이용자 해설에는 다른 답안 번호를 주장한 오류 신고도 함께 들어 있습니다. 이 화면에서 적용하는 정답은 ${target.answer}번입니다. 정답 보기: ‘${targetAnswer}’.`);
  }
  return [...notes, original].filter(Boolean).join('\n\n');
}

let propagated = 0;
let authored = 0;
let fuzzyLinked = 0;
for (const { question } of allHansol) {
  const answerKey = normalized(correctChoice(question));
  const source = sourceByFull.get(`${answerKey}:${fullKey(question)}`)
    || sourceByStem.get(`${answerKey}:${stemKey(question)}`);
  if (source) {
    question.explanation = explanationFromSource(question, source);
    question.explanationProvenance = `${source.round.id}:${source.question.number}`;
    question.explanationMatchScore = 1;
    propagated += 1;
  } else {
    const fuzzySource = fuzzyExplanationSource(question, hvacExplanationCandidates);
    if (fuzzySource) {
      question.explanation = explanationFromSource(question, fuzzySource);
      question.explanationProvenance = `${fuzzySource.round.id}:${fuzzySource.question.number}`;
      question.explanationMatchScore = Number(fuzzySource.score.toFixed(4));
      propagated += 1;
      fuzzyLinked += 1;
    } else {
      question.explanation = beginnerExplanation(question);
      question.explanationProvenance = 'hansol-beginner-authored';
      question.explanationMatchScore = 0;
      authored += 1;
    }
  }
}

const hansolLinked = allHansol.filter(({ question }) => question.explanation
  && question.explanationProvenance !== 'hansol-beginner-authored'
  && question.explanationProvenance !== 'hansol-answer-only');
const linkedByStem = new Map();
const linkedByFull = new Map();
for (const entry of hansolLinked) {
  const answerKey = normalized(correctChoice(entry.question));
  linkedByStem.set(`${answerKey}:${stemKey(entry.question)}`, entry);
  linkedByFull.set(`${answerKey}:${fullKey(entry.question)}`, entry);
}
const linkedCandidates = hansolLinked.map((entry) => ({
  ...entry,
  stem: plain(entry.question.text || entry.question.html || ''),
  normalizedStem: normalized(entry.question.text || entry.question.html || ''),
  answerText: correctChoice(entry.question),
  explanation: entry.question.explanation,
}));

let restoredMerged = 0;
for (const round of hvac.rounds) {
  if (Number(round.year) < 2021) continue;
  for (const question of round.questions) {
    const currentBase = stripHansolSupplement(question.explanation);
    question.explanation = currentBase;
    delete question.explanationSupplementSource;
    const answerKey = normalized(correctChoice(question));
    const source = linkedByFull.get(`${answerKey}:${fullKey(question)}`)
      || linkedByStem.get(`${answerKey}:${stemKey(question)}`)
      || fuzzyExplanationSource(question, linkedCandidates, 0.93);
    if (!source) continue;
    const sourceQuestion = source.question;
    const sourceRound = source.round;
    const supplement = plain(sourceQuestion.explanation);
    const current = plain(currentBase);
    if (!supplement || current.includes(supplement) || (current && supplement.includes(current))) continue;
    question.explanation = `${currentBase || ''}\n\n[COMCBT 동일 문제 추가 해설]\n${sourceQuestion.explanation}`.trim();
    question.explanationSupplementSource = `${sourceRound.id}:${sourceQuestion.number}`;
    restoredMerged += 1;
  }
}

fs.writeFileSync(path.join(root, 'data/hvac-hansol.js'), `window.CBT_DATA_HANSOL_HVAC=${JSON.stringify(hansol)};\n`);
fs.writeFileSync(path.join(root, 'data/hvac.js'), `window.CBT_DATA_HVAC=${JSON.stringify(hvac)};\n`);

const finalLinked = allHansol.filter(({ question }) => question.explanation
  && question.explanationProvenance !== 'hansol-beginner-authored'
  && question.explanationProvenance !== 'hansol-answer-only').length;
const finalAuthored = allHansol.filter(({ question }) => question.explanationProvenance === 'hansol-beginner-authored').length;
const finalAnswerOnly = allHansol.filter(({ question }) => question.explanationProvenance === 'hansol-answer-only').length;
const reportPath = path.join(root, 'work/hansol-import-report.json');
if (fs.existsSync(reportPath)) {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  report.enrichment = {
    linkedExplanations: finalLinked,
    beginnerAuthoredExplanations: finalAuthored,
    answerOnlyExplanations: finalAnswerOnly,
    restoredQuestionsWithHansolSupplement: hvac.rounds
      .flatMap((round) => round.questions)
      .filter((question) => question.explanationSupplementSource).length,
    exactQuestionAnswerCorrections: allHansol
      .filter(({ question }) => question.answerCorrectionSource).length,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify({
  propagated,
  fuzzyLinked,
  authored,
  restoredMerged,
  hansolQuestions: allHansol.length,
  finalLinked,
  finalAuthored,
  finalAnswerOnly,
}));
