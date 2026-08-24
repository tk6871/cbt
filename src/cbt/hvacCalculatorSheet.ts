export type HvacCalculatorMemory = {
  variable: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'X' | 'Y' | 'M';
  value: string;
  name: string;
  unit: string;
  use: string;
  group: 'air' | 'water' | 'state' | 'refrigeration' | 'force';
};

export type HvacFrequentFormula = {
  title: string;
  frequency: string;
  target: string;
  formula: string;
  calculatorFormula?: string;
  steps: string[];
  caution?: string;
};

export const hvacCalculatorMemory: HvacCalculatorMemory[] = [
  { variable: 'A', value: '1.2', name: '공기 밀도', unit: 'kg/m³', use: '풍량을 공기 질량으로 바꿀 때', group: 'air' },
  { variable: 'B', value: '1.01', name: '공기 비열', unit: 'kJ/(kg·K)', use: '공기의 현열을 구할 때', group: 'air' },
  { variable: 'C', value: '4.2', name: '물의 비열', unit: 'kJ/(kg·K)', use: '물·냉각수의 열량을 구할 때', group: 'water' },
  { variable: 'D', value: '2501', name: '수증기 증발잠열', unit: 'kJ/kg', use: '공기의 잠열부하를 구할 때', group: 'water' },
  { variable: 'E', value: '273.15', name: '절대온도 기준값', unit: 'K', use: '섭씨온도를 절대온도로 바꿀 때', group: 'state' },
  { variable: 'F', value: '0.622', name: '공기·수증기 분자량비', unit: '단위 없음', use: '절대습도와 수증기분압을 바꿀 때', group: 'state' },
  { variable: 'X', value: '3.86', name: '1 일본냉동톤', unit: 'kW/JRT', use: '현재 SI 냉동톤을 kW로 바꿀 때', group: 'refrigeration' },
  { variable: 'Y', value: '3320', name: '1 일본냉동톤', unit: 'kcal/(h·JRT)', use: '과거 kcal 냉동톤 문제를 풀 때', group: 'refrigeration' },
  { variable: 'M', value: '9.80665', name: '중력가속도', unit: 'm/s²', use: '펌프·수두·kgf 환산에 쓸 때', group: 'force' },
];

export const hvacCalculatorMemoryGroups = [
  { key: 'air', title: 'AB · 공기', variables: 'A B' },
  { key: 'water', title: 'CD · 물과 수증기', variables: 'C D' },
  { key: 'state', title: 'EF · 온도와 습도', variables: 'E F' },
  { key: 'refrigeration', title: 'XY · 냉동톤', variables: 'X Y' },
  { key: 'force', title: 'M · 힘과 수두', variables: 'M' },
] as const;

export const hvacFrequentFormulas: HvacFrequentFormula[] = [
  {
    title: '벽체 전도·열관류', frequency: '89문제', target: '벽을 통과하는 열량',
    formula: 'Q = K × 면적 × 온도차',
    steps: ['벽 전체의 열관류율 K를 확인합니다.', '면적과 실내외 온도차를 곱합니다.', '시간당 열량인지 순간 동력인지 단위를 확인합니다.'],
    caution: '여러 재료층이면 K = 1 ÷ (1/hi + Σ두께/열전도율 + 1/ho)입니다.',
  },
  {
    title: '물·냉각수 열량', frequency: '55문제', target: '물을 데우거나 식히는 열량',
    formula: 'Q = 물 질량 × 물 비열 × 온도차', calculatorFormula: 'Q = 질량 × (C) × ΔT',
    steps: ['물의 질량 또는 초당 유량을 찾습니다.', '큰 온도에서 작은 온도를 빼 온도차를 만듭니다.', '질량 × (C) × 온도차를 누릅니다.'],
    caution: '문제에서 물의 비열을 따로 주면 (C) 대신 문제의 값을 넣습니다.',
  },
  {
    title: '공기 현열·송풍량', frequency: '47문제', target: '공기의 온도만 바뀌는 열량',
    formula: 'Q = 공기밀도 × 풍량 × 공기비열 × 온도차', calculatorFormula: 'Q(kW) = (A) × 풍량(m³/s) × (B) × ΔT',
    steps: ['풍량을 m³/s로 맞춥니다.', '온도차를 구합니다.', '(A)×풍량×(B)×온도차를 계산합니다.'],
    caution: '풍량이 m³/h라면 먼저 3,600으로 나눕니다.',
  },
  {
    title: '공기 잠열', frequency: '열·습도 문제', target: '공기에서 빠지거나 더해지는 수분 열량',
    formula: 'Qₗ = 공기밀도 × 풍량 × 증발잠열 × 절대습도차', calculatorFormula: 'Qₗ(kW) = (A) × 풍량(m³/s) × (D) × Δx',
    steps: ['실내외 절대습도의 차 Δx를 구합니다.', '풍량을 m³/s로 맞춥니다.', '(A)×풍량×(D)×Δx를 계산합니다.'],
    caution: '절대습도 단위는 kg/kg입니다. g/kg이면 1,000으로 나눕니다.',
  },
  {
    title: '상대습도·수증기분압', frequency: '40문제', target: '절대습도로 수증기분압과 상대습도 구하기',
    formula: 'Pv = xP ÷ (0.622+x), RH = Pv ÷ Ps × 100', calculatorFormula: 'Pv = x × P ÷ ((F)+x)',
    steps: ['절대습도 x와 대기압 P를 찾습니다.', 'x×P÷((F)+x)로 수증기분압 Pv를 구합니다.', 'Pv를 포화수증기압 Ps로 나누고 100을 곱합니다.'],
    caution: 'P와 Ps는 mmHg끼리 또는 kPa끼리 같은 단위로 맞춥니다.',
  },
  {
    title: '냉동 COP·응축기', frequency: '45문제', target: '냉동기 효율과 응축기 방열량',
    formula: '냉동 COP = Qₗ ÷ W, Qₕ = Qₗ + W',
    steps: ['증발기가 빼앗은 열 Qₗ을 찾습니다.', '압축기에 넣은 일 W로 나누면 냉동 COP입니다.', '응축기 열량은 Qₗ에 W를 더합니다.'],
    caution: '난방 COP는 냉동 COP보다 1 큽니다.',
  },
  {
    title: '냉동톤 환산', frequency: '33문제', target: '냉동톤을 kW 또는 kcal/h로 바꾸기',
    formula: 'SI: kW = JRT × 3.86, 과거 단위: kcal/h = JRT × 3,320', calculatorFormula: 'kW = RT × (X), kcal/h = RT × (Y)',
    steps: ['문제가 kW를 요구하면 RT×(X)를 누릅니다.', '과거 kcal/h 문제이면 RT×(Y)를 누릅니다.', '문제에서 1RT 값을 따로 주면 그 값을 우선합니다.'],
    caution: '(X)는 SOLVE를 사용하면 덮어써질 수 있으므로 다시 3.86을 저장합니다.',
  },
  {
    title: '절대압력·진공압', frequency: '55문제', target: '게이지압력과 절대압력 바꾸기',
    formula: '절대압력 = 게이지압력 + 대기압, 진공일 때 = 대기압 - 진공압',
    steps: ['압력이 게이지인지 절대인지 표시합니다.', '양압 게이지면 대기압을 더합니다.', '진공압이면 대기압에서 뺍니다.'],
    caution: 'fx-991EX의 CONV 압력 메뉴로 atm·Pa·mmHg를 먼저 같은 단위로 바꿀 수 있습니다.',
  },
  {
    title: '이상기체 상태변화', frequency: '30문제', target: '압력·체적·온도 변화',
    formula: 'P₁V₁/T₁ = P₂V₂/T₂', calculatorFormula: '절대온도 T = ℃ + (E)',
    steps: ['두 온도에 각각 (E)를 더해 K로 바꿉니다.', '압력은 둘 다 절대압력으로 맞춥니다.', '모르는 값 하나만 남기고 비례식으로 풉니다.'],
    caution: '℃를 그대로 식에 넣으면 틀립니다.',
  },
  {
    title: '펌프 동력', frequency: '29문제', target: '유량과 양정으로 필요한 펌프 동력 구하기',
    formula: 'P = ρgQH ÷ η', calculatorFormula: 'P(kW) = 밀도 × (M) × 유량(m³/s) × 양정 ÷ 효율 ÷ 1000',
    steps: ['유량을 m³/s, 양정을 m로 맞춥니다.', '효율 80%는 0.8로 넣습니다.', '밀도×(M)×유량×양정÷효율÷1000을 누릅니다.'],
    caution: '문제에서 g=9.8 또는 9.81을 주면 (M) 대신 문제 값을 씁니다.',
  },
  {
    title: '송풍기·펌프 상사법칙', frequency: '25문제', target: '회전수가 바뀔 때 풍량·압력·동력',
    formula: '풍량비=N비, 압력비=N비², 동력비=N비³',
    steps: ['새 회전수÷기존 회전수로 비를 만듭니다.', '풍량이면 그대로, 압력이면 제곱합니다.', '동력이면 세제곱합니다.'],
    caution: '암기: 풍압동 = 1·2·3제곱.',
  },
  {
    title: '압축기 피스톤 토출량', frequency: '29문제', target: '실린더 크기와 회전수로 이론 토출량 구하기',
    formula: 'V = (πD²/4) × 행정 × 회전수 × 실린더수 × 60',
    steps: ['내경 D와 행정을 m로 바꿉니다.', '피스톤 한 번의 부피 πD²/4×행정을 구합니다.', '분당 회전수·실린더수·60분을 곱합니다.'],
    caution: '실제 토출량을 물으면 마지막에 체적효율을 곱합니다.',
  },
  {
    title: '공기·물 혼합온도', frequency: '27문제', target: '두 유체를 섞은 뒤 온도',
    formula: 'Tmix = (m₁T₁ + m₂T₂) ÷ (m₁+m₂)',
    steps: ['각 유량과 온도를 짝지어 곱합니다.', '두 값을 더합니다.', '전체 유량으로 나눕니다.'],
    caution: '1:2 혼합이면 첫 온도×1, 둘째 온도×2를 더한 뒤 3으로 나눕니다.',
  },
  {
    title: '유량·관 단면적', frequency: '22문제', target: '관의 크기·속도·유량',
    formula: 'Q = A × v, 원형 면적 A = πd²/4',
    steps: ['지름을 m로 바꿉니다.', 'π×지름²÷4로 단면적을 구합니다.', '면적에 속도를 곱해 m³/s를 구합니다.'],
    caution: '지름을 제곱하므로 mm를 m로 바꾸는 순서를 놓치지 않습니다.',
  },
  {
    title: '3상 전력·역률', frequency: '30문제', target: '3상 회로의 유효전력',
    formula: 'P = √3 × V × I × cosφ',
    steps: ['선간전압 V와 선전류 I를 찾습니다.', '역률 80%는 0.8로 바꿉니다.', '√3×V×I×역률을 계산합니다.'],
    caution: '단상은 √3 없이 P=VIcosφ입니다.',
  },
  {
    title: '옴의 법칙·병렬저항', frequency: '79문제', target: '전압·전류·저항',
    formula: 'V = IR, 병렬은 1/R = 1/R₁ + 1/R₂ + …',
    steps: ['구할 값에 맞춰 V=IR을 변형합니다.', '병렬저항은 각 저항의 역수를 더합니다.', '마지막 합계의 역수를 눌러 합성저항을 구합니다.'],
    caution: '병렬 합성저항은 가장 작은 저항보다 반드시 작습니다.',
  },
  {
    title: '얼음 제조 냉동부하', frequency: '18문제', target: '물을 식혀 얼음으로 만드는 전체 열량',
    formula: 'Q = m[4.2×물 온도 + 335 + 2.1×얼음 온도차]', calculatorFormula: '물 냉각 구간에는 (C)를 사용',
    steps: ['물을 0℃까지 식히는 열을 구합니다.', '0℃ 물을 얼리는 잠열 335를 더합니다.', '0℃ 얼음을 영하로 더 식히는 열을 더합니다.'],
    caution: '문제에서 비열·잠열을 제시하면 4.2·335·2.1 대신 제시값을 씁니다.',
  },
  {
    title: '대수평균온도차 LMTD', frequency: '반복 출제', target: '열교환기 양 끝의 평균 온도차',
    formula: 'LMTD = (ΔT₁-ΔT₂) ÷ ln(ΔT₁/ΔT₂)',
    steps: ['열교환기 양 끝의 온도차 ΔT₁, ΔT₂를 구합니다.', '두 온도차의 차를 구합니다.', 'ln(큰 온도차÷작은 온도차)로 나눕니다.'],
    caution: '30℃ 응축, 냉각수 25→28℃ 문제의 반복 정답은 약 3.27℃입니다.',
  },
];

export const hvacCalculatorSheetNotes = [
  '문제에서 비열·밀도·잠열·중력가속도를 따로 주면 저장값보다 문제의 숫자가 우선입니다.',
  'X=3.86과 Y=3320은 같은 일본냉동톤(JRT)입니다. 미국냉동톤은 1USRT≈3.517kW≈3,024kcal/h이므로 구분합니다.',
  'X는 SOLVE 계산 뒤 다른 값으로 바뀔 수 있습니다. 냉동톤 문제 전에 X=3.86인지 확인합니다.',
  'M+·M−를 누르면 M 값이 바뀔 수 있으므로 펌프 문제 전에 M=9.80665인지 확인합니다.',
  'AB=공기, CD=물, EF=온도·습도, XY=냉동톤, M=힘·수두로 묶어서 기억합니다.',
];
