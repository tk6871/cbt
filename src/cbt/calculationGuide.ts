import type { QuestionItem } from './types';

export type CalculationGuide = {
  goal: string;
  formula: string;
  symbols: string;
  reason: string;
  unitTip: string;
};

function plainText(value?: string): string {
  return (value || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export function calculationSource(item: QuestionItem): string {
  return [
    item.question.text,
    item.question.html,
    ...item.question.choices.flatMap((choice) => [choice.text, choice.html]),
  ].filter(Boolean).map(plainText).join(' ');
}

export function isCalculationItem(item: QuestionItem): boolean {
  const prompt = plainText(item.question.text || item.question.html);
  const choices = item.question.choices.map((choice) => plainText(choice.text || choice.html));
  const source = `${prompt} ${choices.join(' ')}`;
  const asksForQuantity = /계산(?:값|하|하시오|하여)?|구하|산출|얼마(?:인가|인지|가)|몇\s*(?:개|배|%|℃|도|kW|W|kcal|kg|m|Pa|V|A|Ω|rpm|RT)?|값은|필요(?:한)?\s*(?:열량|동력|전력|유량|풍량)|소요(?:되는)?\s*(?:동력|전력|열량)/i.test(prompt);
  const hasFormulaSignal = /\bCOP\b|성능계수|냉동톤|\bRT\b|kW|kcal|엔탈피|열량|유량|풍량|동력|전력|전류|전압|저항|효율|압력|온도|습도|℃|kg\/|m²|m³|kPa|MPa|Pa|rpm|역률|비열|열관류/i.test(source);
  const numericChoiceCount = choices.filter((choice) => /(?:^|\s|[①-④])[-+]?\d|√|π|%|℃|kW|kcal|kg|m²|m³|Pa|V|A|Ω|rpm|RT/i.test(choice)).length;
  return asksForQuantity || (hasFormulaSignal && numericChoiceCount >= 3 && /다음|조건|때|경우|관계/i.test(prompt));
}

export function calculationGuideFor(item: QuestionItem): CalculationGuide {
  const source = calculationSource(item);
  const goal = plainText(item.question.text || item.question.html) || `${item.subject}의 조건을 읽고 보기와 일치하는 값을 찾는 문제`;

  if (/성능계수|\bCOP\b/i.test(source)) return {
    goal,
    formula: '냉동 COP = 냉동효과(Qₗ) ÷ 압축기에 넣은 일(W)',
    symbols: 'Qₗ은 차갑게 만든 열량, W는 압축기에 공급한 일입니다.',
    reason: '같은 일을 넣었을 때 얼마나 큰 냉동효과를 얻는지 비교하는 값이기 때문입니다.',
    unitTip: '분자와 분모의 단위를 먼저 같게 맞추면 COP에는 단위가 남지 않습니다.',
  };
  if (/냉동톤|\bRT\b/i.test(source)) return {
    goal,
    formula: '1 USRT = 약 3.517 kW = 약 3,024 kcal/h',
    symbols: 'RT는 냉동능력의 크기를 나타내는 단위입니다.',
    reason: '냉동톤과 kW 또는 kcal/h 사이의 크기를 바꾸는 문제에 쓰는 기본 환산값입니다.',
    unitTip: 'RT를 kW로 바꿀 때는 3.517을 곱하고, kW를 RT로 바꿀 때는 3.517로 나눕니다.',
  };
  if (/상대습도|절대습도|습공기|수증기분압|습도/i.test(source)) return {
    goal,
    formula: '상대습도(%) = 현재 수증기압 ÷ 같은 온도의 포화수증기압 × 100',
    symbols: '현재 수증기압은 실제 물의 양, 포화수증기압은 그 온도에서 담을 수 있는 최대량을 뜻합니다.',
    reason: '공기가 담을 수 있는 최대 수증기량과 현재 수증기량을 비교하는 문제이기 때문입니다.',
    unitTip: '두 압력의 단위를 같게 맞춘 뒤 나누고, 마지막에 100을 곱해 %로 표시합니다.',
  };
  if (/옴|저항|전류|전압/i.test(source)) return {
    goal,
    formula: '옴의 법칙 V = I × R (따라서 I = V ÷ R, R = V ÷ I)',
    symbols: 'V는 전압(V), I는 전류(A), R은 저항(Ω)입니다.',
    reason: '전압·전류·저항 중 두 값을 알 때 나머지 한 값을 찾는 가장 기본 관계식입니다.',
    unitTip: '전압은 V, 전류는 A, 저항은 Ω로 맞춘 뒤 계산합니다.',
  };
  if (/삼상|3상|역률|전력|전기.*동력/i.test(source)) return {
    goal,
    formula: '3상 유효전력 P = √3 × V × I × cosφ',
    symbols: 'V는 선간전압, I는 선전류, cosφ는 역률입니다.',
    reason: '균형 잡힌 3상 교류의 실제 사용 전력을 구하는 관계식입니다.',
    unitTip: '계산 결과가 W이면 1,000으로 나누어 kW로 바꿉니다.',
  };
  if (/펌프|양정|수동력|축동력/i.test(source)) return {
    goal,
    formula: '펌프 동력 P = ρ × g × Q × H ÷ η',
    symbols: 'ρ는 밀도, g는 중력가속도, Q는 유량, H는 양정, η는 효율입니다.',
    reason: '물을 일정 높이까지 보내는 데 필요한 일과 실제 손실을 함께 계산하기 때문입니다.',
    unitTip: 'Q를 m³/s로 맞추고 계산하면 W가 나오며, kW는 1,000으로 나눕니다.',
  };
  if (/팬|송풍기|회전수|상사법칙|풍량/i.test(source)) return {
    goal,
    formula: '팬 법칙: 풍량 Q∝N, 압력 H∝N², 동력 P∝N³',
    symbols: 'N은 회전수, Q는 풍량, H는 압력, P는 동력입니다.',
    reason: '같은 팬에서 회전수가 바뀔 때 풍량·압력·동력이 서로 다른 비율로 변하기 때문입니다.',
    unitTip: '새 값 ÷ 기존 값의 비를 먼저 만들고, 압력은 제곱·동력은 세제곱합니다.',
  };
  if (/유량|연속방정식|유속|단면적/i.test(source)) return {
    goal,
    formula: '체적유량 Q = 단면적 A × 속도 v',
    symbols: 'Q는 m³/s, A는 m², v는 m/s입니다.',
    reason: '통로의 넓이와 1초 동안 이동하는 길이를 곱하면 1초 동안 지나간 부피가 되기 때문입니다.',
    unitTip: '지름이 주어지면 A = πd²÷4로 면적부터 구하고, mm는 m로 바꿉니다.',
  };
  if (/열관류|열전달|열통과|전열|열량|비열|현열|온도차/i.test(source)) return {
    goal,
    formula: '현열 Q = m × c × ΔT, 벽을 통과하는 열량은 Q = K × A × ΔT',
    symbols: 'm은 질량, c는 비열, ΔT는 온도차, K는 열관류율, A는 면적입니다.',
    reason: '물질의 온도를 바꾸는 문제인지, 벽·열교환기를 통과하는 열을 구하는 문제인지 먼저 구분해 알맞은 식을 씁니다.',
    unitTip: '시간당 열량인지 초당 열량인지 확인하고, 온도차는 ℃와 K의 숫자가 같습니다.',
  };
  if (/효율/i.test(source)) return {
    goal,
    formula: '효율(%) = 유효한 출력 ÷ 공급한 입력 × 100',
    symbols: '입력은 넣어 준 전체 에너지, 출력은 실제로 이용한 에너지입니다.',
    reason: '넣은 양 가운데 실제로 쓴 몫이 얼마인지 비교하는 문제이기 때문입니다.',
    unitTip: '입력과 출력의 단위를 같게 만든 뒤 나누고 마지막에 100을 곱합니다.',
  };

  return {
    goal,
    formula: '이 문제의 기존 해설에서 주어진 값과 구할 값을 먼저 표시한 뒤 관계식을 고릅니다.',
    symbols: '기호 옆에 문제에서 주어진 숫자와 단위를 하나씩 적습니다.',
    reason: '문제 문장만으로 공식을 단정하면 다른 조건을 놓칠 수 있어 기존 해설과 함께 확인해야 합니다.',
    unitTip: '서로 다른 단위를 먼저 맞추고, 숫자 대입 → 계산 → 보기와 비교 순서로 풉니다.',
  };
}
