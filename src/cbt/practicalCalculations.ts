import type { PracticalPrompt } from './hvacPracticalTypes';

export type CalculationLesson = {
  topic: string; title: string; kind: 'numeric' | 'formula'; formula: string;
  symbols: string[]; why: string; units: string[]; memory: string;
  steps: string[]; caution?: string; examAnswer?: string; rounding?: string;
};
type Method = Omit<CalculationLesson, 'steps'>;

export const practicalSiBasics = [
  { title: '단위는 숫자 뒤에 붙이는 이름표', text: '23만 쓰면 길이인지, 무게인지 모릅니다. 23 m는 길이, 23 m³는 부피, 23 m³/h는 한 시간에 흐르는 부피입니다. m³는 세제곱미터라고 읽고, /는 “나누기” 또는 “~당”이라고 읽습니다.' },
  { title: 'SI는 서로 계산이 맞도록 정한 공통 단위', text: '길이는 m, 질량은 kg, 시간은 s를 기준으로 씁니다. 다른 단위도 쓸 수 있지만 공식 안에서는 기준을 맞춰야 합니다. cm와 m, 시간(h)과 초(s)를 섞어 넣으면 숫자가 틀어집니다. 문제에서 준 비열·밀도·RT 환산값을 우선 사용합니다.' },
  { title: '열의 양과 열을 처리하는 빠르기', text: 'J(줄)와 kJ(킬로줄)는 에너지·열의 양입니다. 1 kJ = 1,000 J입니다. W(와트)와 kW(킬로와트)는 1초마다 처리하는 에너지입니다. 1 W = 1 J/s, 1 kW = 1 kJ/s입니다. 따라서 총열량 kJ를 걸린 시간 s로 나누면 kW가 됩니다. N(뉴턴)은 힘의 단위이고, 힘 N × 이동거리 m는 일 J입니다. Pa(파스칼)는 압력이며 1 Pa = 1 N/m², 1 kPa = 1,000 Pa입니다.' },
  { title: '왜 3,600을 곱하거나 나누나?', text: '1시간 = 60분 × 60초 = 3,600초입니다. 3,600 m³/h ÷ 3,600 = 1 m³/s: 한 시간 양을 3,600초로 나눕니다. 반대로 1 m³/s × 3,600 = 3,600 m³/h: 1초 양을 한 시간 동안 모읍니다. kg/h와 kg/s도 같습니다.' },
  { title: '왜 1,000이나 60이 갑자기 나오나?', text: 'k(킬로)는 1,000배입니다. W → kW는 ÷1,000, kW → W는 ×1,000입니다. 1 ton = 1,000 kg, 1분 = 60초라서 ton → kg는 ×1,000, L/min → L/s는 ÷60입니다. 물 1 L를 약 1 kg으로 보는 문제에서는 L/s와 kg/s의 숫자가 같습니다. 모든 액체에 적용하면 안 됩니다.' },
  { title: '곱할 때 단위도 같이 곱합니다', text: '2 kg/s × 4.2 kJ/(kg·℃) × 5℃ = 42 kJ/s = 42 kW입니다. kg는 위의 kg와 아래의 kg가 나누어져 1이 되고, ℃도 같습니다. 없어지는 것이 아니라 같은 단위끼리 나눈 결과입니다. ·는 곱하기입니다.' },
  { title: '더하기·빼기는 같은 단위끼리', text: '3 m + 20 cm는 바로 23이 아닙니다. 20 cm = 0.2 m로 바꾼 뒤 3 + 0.2 = 3.2 m입니다. 20℃ - 8℃ = 12℃는 온도차이며 12 K와 크기가 같습니다. 절대온도를 구할 때만 ℃ + 273.15 = K를 씁니다. 온도차에는 273.15를 더하지 않습니다.' },
  { title: '기호를 먼저 읽고 계산합니다', text: '×는 곱하기, ÷와 /는 나누기입니다. ( ) 안을 먼저 계산하고, 2²는 2×2, √9는 두 번 곱해 9가 되는 수 3입니다. Δ(델타)는 “차이”, ρ(로)는 밀도, γ(감마)는 비중량, η(에타)는 효율을 뜻하는 경우가 많습니다. 기호 뜻은 공식마다 옆에서 다시 설명합니다.' },
  { title: '분수로 나누면 뒤집어 곱합니다', text: '(kJ/s) ÷ (kJ/kg)는 (kJ/s) × (kg/kJ)와 같습니다. 나누는 쪽의 위아래를 뒤집어 곱하는 것입니다. kJ끼리 나누어 1이 되면 kg/s만 남습니다. kW ÷ (kW/m²)도 kW × (m²/kW)이므로 m²입니다. 같은 단위끼리 나눈 COP·SHF·효율에는 단위가 없습니다. 효율에 ×100을 하면 %로 표시합니다. RT는 냉동능력 단위이며 문제에서 준 kW/RT 값으로 바꿉니다.' },
  { title: '반올림과 시험 답안 쓰기', text: '사용자 제공 채점 안내는 기본적으로 소수 셋째 자리에서 반올림하여 둘째 자리까지 쓰도록 합니다. 단, 개별 문제의 조건이 우선입니다. “셋째 자리까지”면 넷째 숫자를 보고 세 자리를 남깁니다. 0.0042는 0.004입니다. “셋째 자리에서 반올림”이면 둘째 자리까지 남기므로 서로 다릅니다. 중간값은 충분히 유지하고 최종 답에서만 반올림합니다. 계산과정과 단위를 함께 씁니다.' },
];

const methods: Record<string, Method> = {
  cop: { topic:'냉동사이클',title:'COP와 응축기 방열량',kind:'numeric',formula:'COP = Qe ÷ L, Qc = Qe + L',symbols:['Qe: 증발기가 가져오는 열, 냉동능력(kW)','L: 압축기에 넣는 동력(kW). 이 공식의 L은 길이가 아닙니다.','Qc: 응축기가 밖으로 버리는 열(kW)','COP: 성능계수. 넣은 동력 1에 대해 냉동능력을 얼마나 얻는지'],why:'응축기는 실내에서 가져온 열과 압축기가 보탠 에너지를 함께 버립니다. COP는 “얻은 것 ÷ 넣은 것”이라 나눕니다.',units:['COP: kW ÷ kW = 1 → 단위 없음.','방열량: kW + kW = kW. 같은 단위끼리 더합니다.'],memory:'성능은 얻은 것 나누기 넣은 것, 응축기는 둘을 더하기.' },
  circulation: { topic:'냉동사이클',title:'냉매 순환량',kind:'numeric',formula:'G = Qe ÷ (h출구 - h입구)',symbols:['G: 필요한 냉매 질량유량(kg/s 또는 kg/h)','Qe: 전체 냉동능력(kW = kJ/s, 또는 kJ/h)','h: 냉매 1 kg이 가진 엔탈피(kJ/kg). 출구-입구는 1 kg이 가져간 열'],why:'전체에서 빼야 할 열을 냉매 1 kg이 가져가는 열로 나누면 필요한 kg 수가 나옵니다.',units:['(kJ/s) ÷ (kJ/kg) = kg/s. kJ가 나뉘고 아래에 있던 kg가 위로 올라옵니다.','시간 기준이 kJ/h라면 같은 계산에서 kg/h가 남습니다.'],memory:'필요한 전체 열 ÷ 냉매 1 kg의 몫.' },
  enthalpyCop: { topic:'냉동사이클',title:'엔탈피로 COP 구하기',kind:'numeric',formula:'COP = (h흡입 - h팽창밸브입구) ÷ (h토출 - h흡입)',symbols:['h흡입: 압축기로 들어가기 전 엔탈피(kJ/kg)','h토출: 압축기를 나온 엔탈피(kJ/kg)','h팽창밸브입구: 팽창 전 액냉매 엔탈피(kJ/kg). 교축 전후 엔탈피는 같다고 봅니다.'],why:'분자는 증발기에서 얻은 열, 분모는 압축기가 냉매에 보탠 일입니다. 둘 다 냉매 1 kg 기준이므로 그대로 비교할 수 있습니다.',units:['(kJ/kg) ÷ (kJ/kg) = 1. 분자와 분모의 단위가 같아 모두 나뉩니다.'],memory:'냉동효과 ÷ 압축일.' },
  water: { topic:'열량·부하',title:'물의 온도 변화와 열량',kind:'numeric',formula:'Q = G × c × Δt',symbols:['Q: 1초마다 전달하는 열(kW)','G: 물의 질량유량(kg/s)','c: 물 1 kg의 온도를 1℃ 바꾸는 데 필요한 열, 비열[kJ/(kg·℃)]','Δt: 온도차(℃ 또는 K). 따뜻한 온도에서 찬 온도를 뺍니다.'],why:'물의 양 × 1 kg을 1℃ 바꾸는 열 × 바꿀 온도입니다. 흐르는 물의 양을 초 기준으로 쓰므로 결과도 1초 기준입니다.',units:['(kg/s) × [kJ/(kg·℃)] × ℃ = kJ/s = kW. kg와 ℃가 각각 나뉩니다.'],memory:'양 × 비열 × 온도차.' },
  air: { topic:'공기조화',title:'공기의 현열·송풍량',kind:'numeric',formula:'Q = ρ × V × c × Δt, V = Q ÷ (ρ × c × Δt)',symbols:['Q: 공기의 온도만 바꾸는 현열(kW)','ρ(로): 공기 밀도, 1 m³ 공기의 질량(kg/m³)','V: 풍량(m³/s). m³/h로 답할 때 마지막에 ×3,600','c: 공기 비열[kJ/(kg·℃)]','Δt: 실내와 공급 공기의 온도차(℃)'],why:'ρ×V로 부피를 질량으로 바꾼 뒤 비열과 온도차를 곱합니다. 풍량을 거꾸로 구할 때는 열량을 나머지 세 값으로 나눕니다.',units:['(kg/m³) × (m³/s) × [kJ/(kg·℃)] × ℃ = kJ/s = kW. m³, kg, ℃가 차례로 나뉩니다.','V를 구하면 (kJ/s) ÷ (kJ/m³) = m³/s. ×3,600 s/h를 하면 s가 나뉘고 m³/h가 남습니다.'],memory:'풍량은 현열 ÷ (밀도 × 비열 × 온도차).',caution:'잠열까지 합한 전열을 이 현열 공식에 넣지 않습니다.' },
  shf: { topic:'공기조화',title:'현열비 SHF',kind:'numeric',formula:'SHF = 현열 ÷ (현열 + 잠열)',symbols:['현열: 온도를 바꾸는 열(kW)','잠열: 수분의 증발·응축 등 상태를 바꾸는 열(kW)','SHF: 전체 열 중 현열이 차지하는 비율'],why:'전체가 현열과 잠열의 합입니다. 그중 현열의 몫을 구하므로 “부분 ÷ 전체”입니다.',units:['kW ÷ (kW + kW) = kW ÷ kW = 1. 비율이라 단위가 없습니다.'],memory:'현열비는 현열 나누기 전체.' },
  mixing: { topic:'공기조화',title:'혼합공기의 온도·습도',kind:'numeric',formula:'혼합값 = (외기값 × 외기량 + 실내값 × 실내공기량) ÷ 전체 공기량',symbols:['외기: 밖에서 들어오는 공기','실내공기: 되돌아와 섞이는 공기','1:3은 외기 1몫, 실내공기 3몫. 전체는 4몫','절대습도: 건조공기 1 kg당 수증기 질량[kg/kg(DA)]'],why:'공기량이 많은 쪽이 결과에 더 크게 영향을 줍니다. 같은 비열의 공기를 단순 혼합하는 조건에서는 온도를 가중평균합니다. 절대습도는 건조공기 질량 기준으로 평균합니다.',units:['비율 1, 3은 단위 없는 몫이므로 온도 계산은 ℃가 그대로 남습니다.','실제 질량유량으로 쓰면 [(kg/s)×℃] ÷ (kg/s) = ℃. 습도는 같은 방식으로 kg/kg(DA)가 남습니다.'],memory:'각 값에 각 몫을 곱해 더하고, 전체 몫으로 나누기.',caution:'단순 산술평균은 공기량이 같을 때만 맞습니다. 문제의 혼합비 기준을 따릅니다.' },
  enthalpyLoad: { topic:'공기조화',title:'엔탈피 차로 전열부하',kind:'numeric',formula:'Q = G × (h입구 - h출구)',symbols:['Q: 코일이 빼는 전체 열, 전열부하(kW)','G: 건조공기 질량유량(kg/s)','h: 건조공기 1 kg 기준 엔탈피[kJ/kg(DA)]'],why:'공기 1 kg에서 뺀 열에 1초에 흐르는 kg 수를 곱합니다. 엔탈피 차에는 온도 변화와 수분 변화에 따른 열이 함께 포함됩니다.',units:['(kg/s) × (kJ/kg) = kJ/s = kW. kg가 위아래에서 나뉩니다.'],memory:'공기량 × 1 kg당 뺀 열.' },
  floor: { topic:'열관류',title:'바닥 손실열과 열관류율',kind:'numeric',formula:'Q = K × A × Δt, K = Q ÷ (A × Δt)',symbols:['Q: 바닥 전체를 통해 빠지는 열(W)','K: 1 m²에서 온도차 1℃일 때 통과하는 열[W/(m²·℃)]','A: 바닥면적(m²) = 가로(m) × 세로(m)','Δt: 실내온도 - 지중온도(℃)'],why:'K는 바닥 1칸(m²), 온도차 1℃ 기준입니다. 실제 면적과 온도차만큼 곱하면 전체 열이 됩니다. K를 구할 때는 반대로 나눕니다.',units:['[W/(m²·℃)] × m² × ℃ = W. 면적과 온도차 단위가 나뉩니다.','K = W ÷ (m²×℃)이므로 최종 단위는 W/(m²·℃)입니다.'],memory:'열관류율 × 면적 × 온도차.',caution:'바닥 열량은 바닥면적을 사용합니다. 방 높이를 곱하면 부피 m³가 되어 맞지 않습니다.' },
  wall: { topic:'열관류',title:'열저항으로 열관류율 구하기',kind:'numeric',formula:'K = 1 ÷ (1/α바깥 + δ/λ + 1/α안)',symbols:['K: 전체 열관류율[W/(m²·K)]','α(알파): 표면 열전달률[W/(m²·K)]','δ(델타): 벽 두께(m). 여기서는 차이가 아닌 두께 기호입니다.','λ(람다): 벽 재료의 열전도율[W/(m·K)]'],why:'실외 표면, 벽 속, 실내 표면은 열이 통과하는 세 장애물입니다. 각 장애물의 열저항을 더한 뒤 역수(1 나누기)를 취하면 열이 통과하는 쉬운 정도 K가 됩니다.',units:['1/α의 단위는 m²·K/W. δ/λ도 m ÷ [W/(m·K)] = m²·K/W입니다.','같은 단위의 저항을 더하고 1로 나누면 W/(m²·K)가 됩니다.'],memory:'표면 역수 + 두께/전도율 + 표면 역수, 마지막에 한 번 더 역수.' },
  condenser: { topic:'열관류',title:'응축기 전열면적',kind:'numeric',formula:'Q = Gc(t출구-t입구), A = Q ÷ (K × Δt평균)',symbols:['Q: 냉각수가 받은 열(kW)','G: 냉각수 질량유량(kg/s)','c: 물의 비열[kJ/(kg·K)]','K: 열관류율[kW/(m²·K)] - 이 문제는 kW 기준','A: 필요한 면적(m²)','Δt평균: 냉매와 물의 두 온도차를 산술평균한 값(K)'],why:'냉각수가 받은 열을 먼저 구합니다. 전열면적 1 m²가 처리하는 열은 K×평균온도차이므로 전체 열을 그 값으로 나누면 필요한 면적입니다.',units:['(kg/s)×[kJ/(kg·K)]×K = kJ/s = kW.','kW ÷ {[kW/(m²·K)]×K} = kW ÷ (kW/m²) = m².','물 200 L/min은 이 문제에서 약 200 kg/min입니다. ÷60으로 kg/s로 바꿉니다.'],memory:'물에서 열량 → 온도차 평균 → 열량 나누기 K와 온도차.',caution:'이 문제는 산술평균 조건입니다. 다른 문제의 대수평균 조건에 그대로 적용하지 않습니다.' },
  arc: { topic:'배관',title:'굽힌 배관의 길이',kind:'numeric',formula:'L = a + b + 2 × π × R × (θ ÷ 360)',symbols:['L: 직선과 곡선을 합친 전체 길이(mm)','a, b: 그림에서 정한 두 직선부 길이(mm)','R: 배관 중심선의 굽힘 반지름(mm)','θ(세타): 굽힌 각도(도)','π(파이): 원주율, 약 3.14159. 문제에 없더라도 원의 둘레 공식에 쓰는 수'],why:'직선부 두 개에 곡선 부분을 더합니다. 2πR은 원 한 바퀴 길이입니다. θ/360은 그중 몇 몫을 사용했는지입니다.',units:['2 × π × mm × (도/도) = mm. 각도끼리 나뉘고 π와 2에는 단위가 없습니다.','mm + mm + mm = mm.'],memory:'직선 + 직선 + 원 둘레의 해당 각도만큼.',caution:'그림의 a,b가 이미 접선까지의 직선 길이인지 확인합니다. 중심거리라면 접선 길이를 먼저 빼야 합니다.' },
  pipe: { topic:'배관',title:'나사이음 강관 길이 공식',kind:'formula',formula:'l = L - 2 × (A - a)',symbols:['l(소문자 엘): 실제로 자를 관 길이','L(대문자 엘): 양쪽 이음쇠 중심 사이 거리','A: 엘보 중심에서 끝까지의 길이','a: 관이 이음쇠에 들어가는 나사 물림길이','2: 같은 보정을 왼쪽과 오른쪽 두 군데 적용한다는 뜻'],why:'한쪽에서 줄어드는 길이는 A-a입니다. 양쪽에 있으므로 두 배를 중심거리에서 뺍니다.',units:['L, A, a를 전부 mm로 넣으면 mm - 2×(mm-mm) = mm입니다. 단위 없는 2를 곱해도 mm는 그대로입니다.'],memory:'중심거리에서 양쪽의 “중심길이-물림길이” 빼기.' },
  dry: { topic:'냉동사이클',title:'건조도로 냉동능력 구하기',kind:'numeric',formula:'Qe = G × (1-x) × r, RT = Qe ÷ (문제의 kW/RT)',symbols:['G: 냉매순환량(kg/s)','x: 건조도. 냉매 질량 중 이미 증기인 비율','1-x: 아직 액체라서 새로 증발할 수 있는 비율','r: 액체 1 kg을 증발시키는 열, 증발잠열(kJ/kg)','Qe: 증발기가 흡수하는 열(kW)'],why:'이미 증기인 몫은 증발잠열을 새로 흡수하지 않습니다. 액체로 남은 몫에만 잠열을 곱합니다.',units:['(kg/s) × 1 × (kJ/kg) = kJ/s = kW.','kW ÷ (kW/RT) = RT. kW가 나뉘고 RT가 남습니다.'],memory:'남은 액체 비율은 1-건조도, 마지막에 RT로 환산.',caution:'1 RT의 환산값은 문제마다 지정값을 따릅니다. 이 문제는 3.86 kW/RT입니다.' },
  coolWater: { topic:'열량·부하',title:'정해진 시간에 물을 냉각하기',kind:'numeric',formula:'총열량 E = m × c × Δt, 냉동능력 Q = E ÷ 시간(s)',symbols:['m: 냉각할 물 전체의 질량(kg). 유량 kg/s와 다릅니다.','c: 물의 비열[kJ/(kg·K)]','Δt: 물의 온도 하강폭(K 또는 ℃)','E: 빼야 할 열의 총량(kJ)','Q: 1초마다 빼야 하는 열(kW)'],why:'물 전체에서 빼야 할 열을 먼저 구합니다. 그 열을 제한 시간 안에 빼야 하므로 시간으로 나눕니다.',units:['kg × [kJ/(kg·K)] × K = kJ.','kJ ÷ s = kJ/s = kW, 이후 kW ÷ (kW/RT) = RT.'],memory:'전체 열부터 구하고 걸리는 초로 나누기.' },
  pump: { topic:'펌프',title:'펌프 축동력',kind:'numeric',formula:'L = γ × Q × H ÷ (1,000 × η)',symbols:['L: 펌프 축에 공급해야 하는 동력(kW). 길이 L과 뜻이 다릅니다.','γ(감마): 물의 비중량(N/m³). 알파벳 y가 아닙니다. 1 m³ 물의 무게를 힘으로 나타낸 값','Q: 부피유량(m³/s). 여기의 Q는 열량이 아닙니다.','H: 양정(m). 물에 주는 에너지를 높이로 나타낸 값','η(에타): 펌프 효율. 70%는 70이 아닌 0.7','1,000: W를 kW로 바꾸는 환산수'],why:'γQH는 실제 물에 전달된 동력입니다. 펌프는 손실이 있으므로 축에는 더 큰 동력이 필요합니다. 0.7로 나누면 손실을 포함한 입력이 됩니다.',units:['(N/m³) × (m³/s) × m = N·m/s = J/s = W. m³끼리 먼저 나뉩니다.','효율은 단위가 없습니다. W ÷ 1,000 = kW.','m³/h를 그대로 넣으면 N·m/h입니다. 초 기준 W를 얻으려고 먼저 ÷3,600 합니다.'],memory:'물의 무게 × 흐르는 양 × 올릴 높이, 효율로 나누고 kW로.',caution:'비중량 γ는 이미 중력의 효과가 들어 있습니다. γ=9,800 N/m³를 썼다면 9.8을 또 곱하지 않습니다. 밀도 ρ를 쓰는 식은 ρgQH입니다.' },
  affinity: { topic:'펌프',title:'펌프 유량과 회전수',kind:'numeric',formula:'N₂ = N₁ × (Q₂ ÷ Q₁)',symbols:['N₁: 바꾸기 전 회전수(rpm = 1분당 회전수)','N₂: 바꾼 뒤 회전수(rpm)','Q₁,Q₂: 바꾸기 전·후 유량. 같은 단위로 맞춥니다.','아래 숫자 1과 2는 곱하는 수가 아니라 전·후를 구별하는 이름표'],why:'같은 펌프의 상사조건에서 유량은 회전수에 비례합니다. 유량을 몇 배 늘렸는지 구해 회전수에도 같은 배수를 곱합니다.',units:['rpm × [(m³/min)/(m³/min)] = rpm. 유량 단위는 비율에서 모두 나뉩니다.'],memory:'새 회전수 = 옛 회전수 × 새 유량/옛 유량.',caution:'유량의 비는 1승, 양정의 비는 2승, 동력의 비는 3승입니다. 이번에는 회전수만 구하므로 제곱하지 않습니다.' },
  heatPhase: { topic:'열량·부하',title:'얼음 → 물 → 증기의 열량',kind:'numeric',formula:'총열량 = 얼음 데우기 + 녹이기 + 물 데우기 + 증발시키기',symbols:['m: 질량(kg)','c: 비열[kJ/(kg·℃)]. 온도를 바꾸는 구간에 사용','r: 잠열(kJ/kg). 온도는 같고 상태가 바뀌는 구간에 사용'],why:'얼음의 온도를 올리는 일과 얼음을 녹이는 일은 다릅니다. 온도가 변할 때는 mcΔt, 상태가 변할 때는 mr로 나누어 구하고 같은 kJ끼리 더합니다.',units:['온도 변화: kg × [kJ/(kg·℃)] × ℃ = kJ.','상태 변화: kg × (kJ/kg) = kJ. 네 결과가 모두 kJ라서 합칠 수 있습니다.'],memory:'데우고 → 녹이고 → 데우고 → 증발.' },
  rtLoad: { topic:'열량·부하',title:'부하 합계로 냉동톤 구하기',kind:'numeric',formula:'RT = 냉방부하 합계(kW) ÷ (문제의 kW/RT)',symbols:['냉방부하: 냉동기가 처리해야 하는 열(kW)','RT: 냉동톤. 질량 ton이 아니라 냉동능력 단위','3.86 kW/RT: 이 문제에서 지정한 1 RT의 크기'],why:'1 RT가 3.86 kW를 처리한다고 주어졌습니다. 전체 열을 한 단위가 처리하는 열로 나누면 필요한 RT 수입니다.',units:['kW ÷ (kW/RT) = RT. 같은 kW끼리 나뉩니다.'],memory:'표의 부하를 합하고 RT 한 개의 능력으로 나누기.' },
  boiler: { topic:'열량·부하',title:'보일러 부하와 정격출력',kind:'numeric',formula:'정격출력 = 부하 합계 × 배관부하계수 × 예열부하계수',symbols:['부하 합계: 표에서 실제로 공급할 난방 열의 합(W 또는 kW)','부하계수: 손실이나 예열 여유를 포함하는 단위 없는 배수','20% 추가는 1+20/100 = 1.20배. 1.5로 주면 그대로 1.5배'],why:'공급할 열뿐 아니라 배관에서 잃는 열과 처음 데우는 데 필요한 여유도 보탭니다. 문제에서 두 계수를 각각 주면 각각 곱합니다.',units:['W × 1 × 1 = W, 마지막에 ÷1,000으로 kW. 계수에 단위가 없으므로 열의 단위는 바뀌지 않습니다.'],memory:'부하 합계에 배관 여유, 예열 여유를 차례로 곱하기.' },
  boilerMulti: { topic:'열량·부하',title:'급탕·상용·정격출력과 효율',kind:'numeric',formula:'급탕 = GcΔt, 상용 = (난방+급탕)×1.20, 정격 = 상용×1.15',symbols:['G: 시간당 급탕 물의 질량(kg/h). 이 문제는 물 1 L ≈ 1 kg','c: 물의 비열[kJ/(kg·K)]','상당증발량: 100℃ 물을 증기로 바꾸는 양으로 환산한 값(kg/h)','2,256 kJ/kg: 문제에서 준 물의 증발잠열','1.20, 1.15: 각각 20%, 15%를 더하는 배수','보일러 효율 = 유효출력 ÷ 연료가 공급한 열 × 100(%)'],why:'난방과 급탕에 쓸 열을 더하고 배관·예열 여유를 차례로 넣습니다. 이 복원문항의 기존 답안은 정격출력을 효율의 분자로 사용하는 조건입니다.',units:['(kg/h)×[kJ/(kg·K)]×K = kJ/h.','상당증발량(kg/h)×증발잠열(kJ/kg) = kJ/h이므로 급탕부하와 더할 수 있습니다.','kJ/h ÷ 3,600 = kJ/s = kW. 효율은 같은 kJ/h끼리 나눈 뒤 ×100이므로 %입니다.'],memory:'급탕 → 난방과 합치기 → 배관 → 예열 → 연료와 비교.',caution:'효율의 유효출력 기준은 원문 조건에 따라야 합니다. 상당증발량 1,000 kg/h 자체의 열출력으로 정의하면 효율은 약 43.38%로 달라집니다. 출제 조건이 생략된 복원답안 하나를 보일러 효율의 보편 공식으로 외우지 않습니다.' },
  pressure: { topic:'압력',title:'진공압에서 절대압력',kind:'numeric',formula:'P절대 = (760 - P진공) × 101.325 ÷ 760',symbols:['P진공: 대기압보다 얼마나 낮은지(mmHg)','P절대: 완전 진공 0을 기준으로 남은 압력(kPa)','760 mmHg와 101.325 kPa: 같은 표준대기압을 다른 단위로 쓴 값','101.325/760: mmHg 1을 kPa로 바꾸는 비율'],why:'진공압은 빠진 압력이므로 대기압에서 뺍니다. 남은 mmHg를 kPa로 바꾸기 위해 같은 압력끼리의 환산비를 곱합니다.',units:['mmHg × (kPa/mmHg) = kPa. mmHg는 나뉘고 kPa만 남습니다.'],memory:'진공압은 대기압에서 빼고, 같은 1기압 비율로 환산.',caution:'게이지압이 양수인 문제는 대기압에 더합니다. 이 식은 진공압과 표준대기압을 준 조건입니다.' },
  intermediate: { topic:'냉동사이클',title:'이상적인 중간압력',kind:'numeric',formula:'Pm = √(Pe × Pc)',symbols:['Pe: 증발압력, Pc: 응축압력, Pm: 중간압력','√: 루트. 같은 수 두 개를 곱해 안의 수가 되는 값','세 압력은 같은 단위의 절대압력을 사용'],why:'이상적인 두 압축단의 압축비가 같게 Pe→Pm→Pc를 나눕니다. 따라서 Pm/Pe=Pc/Pm, 즉 Pm²=Pe×Pc입니다.',units:['√(MPa×MPa) = √(MPa²) = MPa. 두 번 곱한 단위를 루트로 한 번 되돌립니다.'],memory:'절대압력끼리 곱하고 루트.',caution:'실제 최적 중간압력은 냉매·중간냉각 조건에 따라 달라집니다. 단순 이상식 문제의 답입니다.' },
  bf: { topic:'공기조화',title:'바이패스팩터 BF·콘택트팩터 CF',kind:'formula',formula:'BF = (t출구-t코일) ÷ (t입구-t코일), CF = 1-BF',symbols:['t입구: 코일에 들어가기 전 공기온도(그림 ①)','t출구: 코일을 지난 실제 공기온도(그림 ②)','t코일: 코일 표면을 대표하는 장치노점온도(그림 ③)','BF: 코일과 충분히 열교환하지 않고 지나친 몫, CF: 접촉한 몫'],why:'코일 온도까지 내려갈 수 있는 전체 온도차 중 실제로 남은 온도차가 BF입니다. 전체를 1로 보면 접촉한 몫은 1-BF입니다.',units:['℃ 차 ÷ ℃ 차 = 1. 같은 온도차 단위가 나뉘므로 BF와 CF에는 단위가 없습니다.'],memory:'남은 차 / 전체 차 = BF, 나머지는 CF.' },
  tower: { topic:'열량·부하',title:'냉각탑 레인지·어프로치·방열량',kind:'formula',formula:'레인지 = t입구수-t출구수, 어프로치 = t출구수-t외기습구, Q = Gc×레인지',symbols:['t입구수: 뜨거운 물이 냉각탑에 들어오는 온도','t출구수: 식은 물이 나가는 온도','t외기습구: 냉각탑으로 들어오는 공기의 습구온도','G: 물의 질량유량(kg/s), c: 물 비열[kJ/(kg·℃)]','Q: 냉각탑이 버린 열(kW)'],why:'레인지는 물이 식은 폭, 어프로치는 식은 물과 공기의 습구온도 사이에 아직 남은 차이입니다. 방열량은 물이 식으며 내놓은 열입니다.',units:['온도 - 온도 = 온도차(℃ 또는 K).','(kg/s)×[kJ/(kg·℃)]×℃ = kJ/s = kW.'],memory:'물 전후는 레인지, 출구 물과 외기 습구는 어프로치.' },
};

export const practicalCalculationLessons: Record<string, CalculationLesson> = {};
function add(id: string, method: string, steps: string[], extra: Partial<CalculationLesson> = {}): void {
  practicalCalculationLessons[id] = { ...methods[method], steps, ...extra };
}
add('hvac-practical-restored-2026-2-09','air',['온도차: 26-15=11℃. 현열 25 kW만 사용합니다. 잠열 10 kW는 현열 공식에 넣지 않습니다.','공기 1 m³가 가져가는 열: 1.2×1.01×11=13.332 kJ/m³.','필요한 풍량: 25÷13.332=1.87519 m³/s.','시간당으로: 1.87519×3,600=약 6,750.68 m³/h. 약 6,751 m³/h이며 기존 답안 약 6,750은 거칠게 반올림한 값입니다.']);
add('hvac-practical-restored-2026-2-10','floor',['바닥면적: 그림의 10×10=100 m². 높이 3 m는 쓰지 않습니다.','온도차: 20-10.2=9.8℃.','K=490÷(100×9.8)=0.50 W/(m²·℃).']);
add('hvac-practical-restored-2026-1-05','condenser',['유량: 200 L/min ≈ 200 kg/min, ÷60=3.3333 kg/s.','물 온도상승: 31-28=3 K. 열량=200÷60×4.2×3=42 kW.','냉매와 물의 온도차: 입구에서 40-28=12 K, 출구에서 40-31=9 K. 평균=(12+9)÷2=10.5 K.','A=42÷(0.95×10.5)=약 4.21 m².']);
add('hvac-practical-restored-2026-1-06','arc',['직선부: 350+500=850 mm.','90°는 90÷360=1/4바퀴. 곡선=2×π×150×1/4=약 235.62 mm.','전체=850+235.62=약 1,085.62 mm.']);
add('hvac-practical-restored-2025-3-06','dry',['건조도 0.1=이미 증기 10%. 남은 액체는 1-0.1=0.9(90%).','냉매 1 kg당 얻는 열=0.9×1,675=1,507.5 kJ/kg.','초당 열량=1.3×1,507.5=1,959.75 kW.','냉동톤=1,959.75÷3.86=약 507.71 RT.']);
add('hvac-practical-restored-2025-3-07','boiler',['표에서 사용할 부하: 9,000+10,000+2,000+1,000+4,000+2,500=28,500 W. 인체·조명은 문제 조건대로 0입니다.','두 계수는 각각 1.5이므로 28,500×1.5×1.5=64,125 W.','kW로 바꾸면 64,125÷1,000=64.125 kW.']);
add('hvac-practical-restored-2025-2-07','wall',['두께 10 cm=0.10 m. 2.5×10⁻⁵=0.000025입니다. 소수점을 왼쪽으로 다섯 자리 옮깁니다.','바깥 표면 저항=1÷0.05=20. 벽 저항=0.10÷0.000025=4,000. 안 표면 저항=1÷0.009=111.1111.','저항 합=4,131.1111 m²·K/W.','K=1÷4,131.1111=0.0002420656… → 소수점 6자리로 0.000242 W/(m²·K).']);
add('hvac-practical-restored-2025-2-08','affinity',['늘릴 배수=새 유량 2÷옛 유량 1.5=1.3333…배.','N₂=800×(2÷1.5)=1,066.67 rpm, 약 1,067 rpm.','10 kW는 기존 펌프 동력입니다. 이번에 구하는 회전수에는 넣지 않습니다.']);
add('hvac-practical-restored-2025-1-11','coolWater',['물 10 ton=10×1,000=10,000 kg. 온도차=35-2=33 K.','총열량=10,000×4.2×33=1,386,000 kJ.','2시간=2×3,600=7,200 s. 냉동능력=1,386,000÷7,200=192.5 kW.','RT=192.5÷3.86=약 49.87 RT.']);
add('hvac-practical-restored-2025-1-04','pump',['유량 Q=1,500÷3,600=0.416667 m³/s.','물에 준 동력=9,800×(1,500÷3,600)×10=40,833.33 W.','축동력=40,833.33÷0.7=58,333.33 W. 손실 때문에 물에 준 동력보다 커집니다.','kW로=58,333.33÷1,000=약 58.33 kW.']);
add('hvac-practical-restored-2024-3-07','mixing',['비율 외기:실내=1:3, 전체=1+3=4몫.','온도=(-8×1+24×3)÷4=(-8+72)÷4=16℃.','습도=(0.001×1+0.008×3)÷4=0.025÷4=0.00625 kg/kg(DA).']);
add('hvac-practical-restored-2024-3-10','pipe',['한쪽에서 빼는 길이는 A-a입니다.','왼쪽과 오른쪽을 합쳐 2×(A-a)입니다.','따라서 자를 길이 l=L-2(A-a). 수치가 없으므로 숫자를 임의로 넣지 않고 공식으로 답합니다.']);
add('hvac-practical-restored-2024-2-05','floor',['바닥면적=10×10=100 m².','온도차=20-8.2=11.8℃.','손실열량 Q=0.5×100×11.8=590 W.']);
add('hvac-practical-restored-2024-2-08','rtLoad',['표의 냉방부하 합계는 22.1 kW입니다. 원문 표의 실내·외기 처리 부하를 함께 더합니다.','냉동톤=22.1÷3.86=약 5.73 RT.'],{caution:'표의 개별 항목은 문제 그림을 함께 확인합니다. 22.1은 새 상수가 아니라 표의 부하를 합한 결과입니다.'});
add('hvac-practical-restored-2024-2-10','bf',['그림 ①=입구, ②=출구, ③=코일 장치노점입니다.','BF=(②-③)÷(①-③).','CF=1-BF=(①-②)÷(①-③). 수치 대신 공식을 요구한 문제입니다.']);
add('hvac-practical-restored-2024-1-06','circulation',['그림에서 읽는 증발기 출구 엔탈피는 1,630, 입구는 545 kJ/kg입니다. 냉동효과=1,630-545=1,085 kJ/kg.','12 RT×3.86 kW/RT=46.32 kW=46.32 kJ/s.','한 시간 기준 열량=46.32×3,600=166,752 kJ/h.','냉매순환량=166,752÷1,085=약 153.69 kg/h.']);
add('hvac-practical-restored-2024-1-09','mixing',['외기:실내=1:4이므로 총 5몫입니다.','온도=(-5×1+20×4)÷5=75÷5=15℃.','습도=(0.001×1+0.005×4)÷5=0.021÷5=0.0042 kg/kg(DA).','원문은 절대습도를 소수점 셋째 자리까지 기입하라고 합니다. 넷째 숫자 2가 5 미만이므로 최종 답은 0.004 kg/kg(DA)입니다.'],{caution:'사용자 제공 Scan0037.jpg의 책 411쪽, 2024년 1회 8번에서 “소수점 셋째 자리까지 기입” 조건을 직접 확인했습니다. 문항 ID의 09는 과거 번호이며 화면·PDF는 책 번호 8번을 사용합니다.'});
add('hvac-practical-restored-2023-3-02','heatPhase',['얼음 -10→0℃: 1×2.1×[0-(-10)]=21 kJ. 음수 -10을 빼므로 +10이 됩니다.','0℃ 얼음 녹이기: 1×335=335 kJ.','물 0→100℃: 1×4.2×100=420 kJ.','100℃ 물 증발시키기: 1×2,257=2,257 kJ.','모두 합치면 21+335+420+2,257=3,033 kJ.'],{caution:'얼음이 녹거나 물이 끓는 동안에는 온도 변화 대신 잠열을 사용합니다. 잠열 335와 2,257은 이 문제에서 준 값입니다.'});
add('hvac-practical-restored-2023-3-04','shf',['전체 열량=8.3+2.8=11.1 kW.','SHF=8.3÷11.1=0.747747… → 약 0.748 또는 0.75.','실내온도·습도·취출온도차는 현열비만 구하는 계산에는 넣지 않습니다.']);
add('hvac-practical-restored-2023-2-02','water',['선도에서 가열 전 19℃, 후 28℃를 읽습니다. 온도차=28-19=9℃.','0.6×1.0×9=5.4 kJ/s=5.4 kW.'],{title:'선도 온도차로 공기 가열량',symbols:['Q: 공기 가열량(kW)','G: 공기 질량유량 0.6 kg/s','c: 문제에서 준 공기 비열 1.0 kJ/(kg·℃)','Δt: 선도에서 읽은 가열 후-전 온도차(℃)'],why:'1초에 지나가는 공기량에 공기 1 kg을 1℃ 올리는 열과 실제 온도차를 곱합니다. 물의 열량과 같은 원리이지만 비열은 이 문제의 공기 비열 1.0을 사용합니다.',memory:'공기 질량유량 × 공기 비열 × 온도차.'});
add('hvac-practical-restored-2023-2-12','boilerMulti',['급탕 물 3,000 L/h≈3,000 kg/h. 온도차=60-10=50 K. 급탕=3,000×4.18×50=627,000 kJ/h.','난방=1,000×2,256=2,256,000 kJ/h. 합계=2,883,000 kJ/h.','상용출력=2,883,000×1.20=3,459,600 kJ/h.','정격출력=3,459,600×1.15=3,978,540 kJ/h. ÷3,600=1,105.15 kW.','기존 복원답안의 기준: 연료열=130×40,000=5,200,000 kJ/h. 효율=3,978,540÷5,200,000×100=약 76.51%. 아래 조건 주의를 함께 읽습니다.']);
add('hvac-practical-foundation-2','cop',['COP=냉동능력 12÷압축기 입력 3=4.','4 kW가 아니라 단위 없는 4입니다.']);
add('hvac-practical-foundation-3','cop',['응축기 방열량=가져온 열 12+압축기 입력 3=15 kW.']);
add('hvac-practical-foundation-8','water',['1초에 물 1 kg, 비열 4.18, 온도차 5℃를 곱합니다.','Q=1×4.18×5=20.9 kJ/s=20.9 kW.']);
add('hvac-practical-foundation-11','pressure',['남은 압력=760-300=460 mmHg.','460×101.325÷760=61.327… kPa, 약 61.3 kPa.']);
add('hvac-practical-drill-07','cop',['COP=24÷6=4(단위 없음).','응축기 방열량=24+6=30 kW.']);
add('hvac-practical-drill-08','circulation',['냉매 1 kg의 냉동효과=400-250=150 kJ/kg.','전체 75 kW=75 kJ/s이므로 G=75÷150=0.5 kg/s.']);
add('hvac-practical-drill-09','enthalpyCop',['냉동효과=400-250=150 kJ/kg.','압축일=450-400=50 kJ/kg.','COP=150÷50=3. 단위는 없습니다.']);
add('hvac-practical-drill-10','water',['Q=2×4.18×5=41.8 kJ/s=41.8 kW.']);
add('hvac-practical-drill-11','air',['질량유량=1.2×2=2.4 kg/s. 부피에 밀도를 곱해 질량으로 바꿉니다.','현열 Q=2.4×1.005×10=24.12 kW.']);
add('hvac-practical-drill-12','shf',['SHF=현열 21÷전체 30=0.7.','잠열=전체 30-현열 21=9 kW.']);
add('hvac-practical-drill-13','intermediate',['0.2와 1.8 MPa를 절대압력으로 사용하는 이상식입니다.','곱하면 0.2×1.8=0.36 MPa².','루트: √0.36=0.6. 0.6×0.6=0.36이므로 Pm=0.6 MPa.']);
add('hvac-practical-drill-14','pressure',['남은 압력=760-380=380 mmHg.','380×101.325÷760=50.6625 kPa, 약 50.7 kPa.']);
add('hvac-practical-drill-28','mixing',['외기 10 kg/s와 환기 30 kg/s의 합=40 kg/s.','혼합온도=(10×32+30×24)÷40=(320+720)÷40=26℃.','공기량이 더 많은 24℃ 쪽에 가까운 결과입니다.']);
add('hvac-practical-drill-29','enthalpyLoad',['공기 1 kg에서 뺀 열=60-40=20 kJ/kg.','초당 2 kg이 지나가므로 Q=2×20=40 kJ/s=40 kW.']);
add('hvac-practical-supplement-20260916-16','tower',['레인지는 냉각수 입구온도에서 출구온도를 뺍니다.','어프로치는 출구 수온에서 외기 습구온도를 뺍니다. 건구온도가 아닙니다.','방열량은 유량(kg/s)×물 비열×레인지입니다. 수치가 없는 서술형이므로 임의의 숫자를 넣지 않습니다.']);

// Final-answer formatting follows the user's grading notice; intermediate values
// above intentionally retain digits. A question-specific instruction wins.
const examAnswers: Record<string, string> = {
  'restored-2026-2-09':'6,750.68 m³/h', 'restored-2026-2-10':'0.50 W/(m²·℃)',
  'restored-2026-1-05':'4.21 m²', 'restored-2026-1-06':'1,085.62 mm',
  'restored-2025-3-06':'507.71 RT', 'restored-2025-3-07':'64.13 kW',
  'restored-2025-2-07':'0.000242 W/(m²·K)', 'restored-2025-2-08':'1,066.67 rpm',
  'restored-2025-1-11':'49.87 RT', 'restored-2025-1-04':'58.33 kW',
  'restored-2024-3-07':'건구온도 16.00℃, 절대습도 0.01 kg/kg(DA). 반올림 전 절대습도는 0.00625입니다.',
  'restored-2024-2-05':'590.00 W', 'restored-2024-2-08':'5.73 RT',
  'restored-2024-1-06':'153.69 kg/h', 'restored-2024-1-09':'건구온도 15.00℃, 절대습도 0.004 kg/kg(DA)',
  'restored-2023-3-02':'3,033.00 kJ', 'restored-2023-3-04':'0.75(단위 없음)',
  'restored-2023-2-02':'5.40 kW',
  'restored-2023-2-12':'① 627,000.00 kJ/h ② 3,459,600.00 kJ/h ③ 1,105.15 kW ④ 76.51%(기존 복원답안의 출력 기준)',
  'foundation-2':'COP 4.00(단위 없음)', 'foundation-3':'15.00 kW',
  'foundation-8':'20.90 kW', 'foundation-11':'61.33 kPa',
  'drill-07':'COP 4.00(단위 없음), 응축기 방열량 30.00 kW',
  'drill-08':'0.50 kg/s', 'drill-09':'COP 3.00(단위 없음)', 'drill-10':'41.80 kW',
  'drill-11':'24.12 kW', 'drill-12':'SHF 0.70(단위 없음), 잠열부하 9.00 kW',
  'drill-13':'0.60 MPa', 'drill-14':'50.66 kPa', 'drill-28':'26.00℃', 'drill-29':'40.00 kW',
};
for (const [suffix, answer] of Object.entries(examAnswers)) {
  const lesson = practicalCalculationLessons[`hvac-practical-${suffix}`];
  lesson.examAnswer = answer;
  lesson.rounding = '제공된 채점 안내의 기본 조건: 소수 셋째 자리에서 반올림 → 둘째 자리까지. 중간 계산값은 유지합니다.';
}
practicalCalculationLessons['hvac-practical-restored-2025-2-07'].rounding = '개별 문제 우선: 소수점 6자리까지 → 0.000242. 둘째 자리로 줄이면 0.00이 되어 안 됩니다.';
practicalCalculationLessons['hvac-practical-restored-2024-1-09'].rounding = '책 411쪽 개별 조건 확인: 절대습도는 소수점 셋째 자리까지 → 0.004.';
practicalCalculationLessons['hvac-practical-restored-2024-3-07'].rounding = '책 423쪽 인쇄 답안도 0.00625를 둘째 자리로 반올림하여 0.01로 표기합니다. 계산 원리는 반올림 전 값으로 이해합니다.';

export const practicalCalculationPdf = 'output/pdf/hvac-practical-calculation-study.pdf';
export function calculationLesson(prompt: PracticalPrompt): CalculationLesson | undefined {
  return practicalCalculationLessons[prompt.id];
}
export function calculationPrompts(bank: PracticalPrompt[]): PracticalPrompt[] {
  return bank.filter(p => Boolean(calculationLesson(p)));
}

export type PracticalExamFamily = 'cgt' | 'cr' | 'cop' | 'bf';
export const practicalExamFamilies: Array<{
  key: PracticalExamFamily; title: string; formula: string; when: string;
  symbols: string; example: string; units: string; remember: string;
}> = [
  { key:'cgt', title:'CGT · 온도가 바뀔 때', formula:'Q = G × c × Δt',
    when:'물이나 공기를 몇 ℃ 데우거나 식히는 문제입니다. 얼음이 녹는 것처럼 상태만 바뀌는 구간에는 이 식을 쓰지 않습니다.',
    symbols:'Q는 열량, G는 물·공기의 질량 또는 질량유량, c는 비열, Δt(델타 티)는 온도차입니다. 온도차는 높은 온도에서 낮은 온도를 뺍니다.',
    example:'물 2 kg의 온도를 5℃ 올리고 비열이 4.18 kJ/(kg·℃)라면 2×4.18×5=41.8 kJ입니다. 물 1 kg을 1℃ 올리는 열에 물의 양 2와 올릴 온도 5를 각각 곱한 것입니다.',
    units:'kg × [kJ/(kg·℃)] × ℃ = kJ. kg와 ℃가 위아래에서 나뉩니다. G가 2 kg/s라면 처음부터 /s가 붙으므로 결과는 41.8 kJ/s=41.8 kW입니다. kg/h이면 결과는 kJ/h이며 ÷3,600으로 kW로 바꿉니다.',
    remember:'온도 변화 = 양 × 비열 × 온도차. 전체 질량이면 열량, 초당 유량이면 kW.' },
  { key:'cr', title:'CR · 녹거나 증발할 때', formula:'Q = G × r',
    when:'얼음이 물로 녹거나 물·냉매가 증기로 변하는 구간입니다. 상태가 변하는 동안의 열을 구합니다. 수업에서 말한 CR을 여기서는 질량 G와 잠열 r로 표시합니다.',
    symbols:'Q는 상태 변화에 필요한 열, G는 실제로 상태가 변하는 질량(또는 질량유량), r은 1 kg의 상태를 바꾸는 잠열(kJ/kg)입니다. r은 알파벳 알이고, 비열 c와 다릅니다.',
    example:'얼음 2 kg을 녹이고 문제에서 융해열 r=335 kJ/kg을 주면 Q=2×335=670 kJ입니다. 1 kg을 녹이는 데 335 kJ가 필요하므로 2 kg은 두 배입니다. 이 구간에는 비열이나 온도차를 또 곱하지 않습니다.',
    units:'kg × (kJ/kg) = kJ. kg가 위아래에서 나뉩니다. G가 kg/s라면 (kg/s)×(kJ/kg)=kJ/s=kW입니다. 이미 증기가 된 몫이 있으면 전체 질량이 아니라 아직 증발할 액체의 몫을 사용합니다.',
    remember:'상태 변화 = 양 × 잠열. 온도 변화가 아니라 녹음·증발을 찾기.' },
  { key:'cop', title:'COP · 성능계수', formula:'COP = Qe ÷ L',
    when:'압축기에 넣은 동력에 비해 냉동능력을 얼마나 얻는지 묻습니다. 냉동 COP인지 난방 COP인지 먼저 봅니다.',
    symbols:'Qe는 증발기의 냉동능력(kW), L은 압축기 입력동력(kW), COP는 성능계수입니다. L은 이 식에서 길이가 아닙니다.',
    example:'냉동능력 12 kW, 입력 3 kW이면 COP=12÷3=4.00입니다. 입력 1에 대해 냉동능력 4를 얻는다는 뜻입니다. 응축기 방열량을 묻는다면 12+3=15 kW로 다른 계산입니다.',
    units:'kW ÷ kW = 1. 같은 단위가 모두 나뉘므로 COP 뒤에 kW를 붙이지 않습니다. 엔탈피로 계산해도 냉동효과(kJ/kg)÷압축일(kJ/kg)이므로 단위가 없습니다.',
    remember:'COP는 얻은 것 ÷ 넣은 것. 냉동은 증발기 열, 난방은 응축기 열을 분자에 쓰기.' },
  { key:'bf', title:'BF · 코일을 지나친 몫', formula:'BF = (t출구 - t코일) ÷ (t입구 - t코일), CF = 1 - BF',
    when:'입구공기, 실제 출구공기, 코일의 장치노점온도를 구별하는 문제입니다. BF는 바이패스팩터, CF는 콘택트팩터입니다.',
    symbols:'t입구는 코일에 들어가기 전 온도, t출구는 실제로 나온 공기온도, t코일은 코일 표면의 장치노점온도입니다. t는 온도, BF와 CF는 비율입니다.',
    example:'기호를 이해하기 위한 예제: 입구 30℃, 출구 18℃, 코일 10℃라면 BF=(18-10)÷(30-10)=8÷20=0.40. 전체를 1로 보면 CF=1-0.40=0.60입니다. 이 숫자는 원문 복원문제의 수치가 아닌 설명용 예제입니다.',
    units:'(℃의 온도차) ÷ (℃의 온도차) = 1. 같은 단위가 나뉘므로 BF·CF에는 단위가 없습니다. 0.40을 %로 묻는다면 ×100하여 40%입니다.',
    remember:'출구에 남은 차 ÷ 입구의 전체 차 = BF. CF는 1-BF.' },
];

// Explicit study selection, not keyword matching or an official prediction.
const examFamilyIds: Partial<Record<PracticalExamFamily, string[]>> = {
  cgt:['restored-2026-2-09','restored-2025-1-11','restored-2023-3-02','restored-2023-2-02','foundation-8','drill-10','drill-11','supplement-20260916-16'],
  cr:['restored-2025-3-06','restored-2023-3-02'],
  cop:['foundation-2','drill-07','drill-09'],
  bf:['restored-2024-2-10'],
};
export function practicalExamFamiliesFor(prompt: PracticalPrompt): PracticalExamFamily[] {
  return practicalExamFamilies.filter(f => examFamilyIds[f.key]?.some(id => prompt.id === `hvac-practical-${id}`)).map(f => f.key);
}
export function orderPracticalCalculations(prompts: PracticalPrompt[]): PracticalPrompt[] {
  const rank = (p: PracticalPrompt) => {
    const families = practicalExamFamiliesFor(p);
    const family = families.length ? practicalExamFamilies.findIndex(f => f.key === families[0]) : 4;
    const basic = p.group === 'foundation' ? 0 : p.group === 'drill' ? 1 : 2;
    return family*10+basic;
  };
  return [...prompts].sort((a,b) => rank(a)-rank(b));
}
export const practicalCalculationReferences = [
  { title:'열량·비열', url:'https://openstax.org/books/physics/pages/11-2-heat-specific-heat-and-heat-transfer' },
  { title:'상태 변화·잠열', url:'https://openstax.org/books/college-physics/pages/14-3-phase-change-and-latent-heat' },
  { title:'SI 환산·표준대기압', url:'https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors' },
  { title:'펌프 상사법칙', url:'https://www.energy.gov/sites/prod/files/2016/08/f33/Dedicated%20Purpose%20Pool%20Pumps%20TP%20NOPR.pdf' },
];
