import type { QuestionItem } from './types';

export type CalculationGuide = {
  goal: string;
  formula: string;
  symbols: string;
  reason: string;
  unitTip: string;
  numberOrigins?: string[];
  substitution?: string;
  reliable?: boolean;
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

export function comcbtCalculationExplanation(item: QuestionItem): string {
  const raw = item.question.explanation || item.question.explanationHtml || '';
  const supplement = raw.split('[COMCBT 동일 문제 추가 해설]')[1];
  if (supplement) return plainText(supplement.replace(/\[해설작성자[^\]]*\]/g, ' '));
  const provenance = item.question.explanationProvenance || '';
  if (!/(?:^|\.)comcbt\.com(?:\/|$)/i.test(item.question.source || '') || /local-|ai-reference|beginner-authored/i.test(provenance)) return '';
  return plainText(raw.replace(/\[해설작성자[^\]]*\]/g, ' '));
}

function numericTokens(value: string): string[] {
  return [...value.matchAll(/-?\d+(?:[,.]\d+)?/g)]
    .map((match) => match[0].replace(/,/g, ''))
    .filter((token) => token !== '1' && token !== '2' && token !== '3' && token !== '4');
}

function comcbtEquationGuide(item: QuestionItem, explanation: string): Pick<CalculationGuide, 'formula' | 'reason' | 'symbols' | 'unitTip' | 'substitution'> | null {
  if (!explanation || /맞는지\s*모르|오류|오답|정정|틀린\s*해설|아닌\s*것/i.test(explanation)) return null;
  const nativeComcbt = /(?:^|\.)comcbt\.com(?:\/|$)/i.test(item.question.source || '');
  const answerChoice = plainText(item.question.choices[item.question.answer - 1]?.text || item.question.choices[item.question.answer - 1]?.html);
  const answerNumbers = numericTokens(answerChoice);
  const explanationNumbers = numericTokens(explanation);
  const normalizedExplanation = explanation.replace(/,/g, '');
  const answerSupported = nativeComcbt || answerNumbers.some((number) => normalizedExplanation.includes(number))
    || answerNumbers.some((number) => {
      const answerValue = Number(number);
      return Number.isFinite(answerValue) && explanationNumbers.some((candidate) => {
        const candidateValue = Number(candidate);
        const tolerance = Math.max(.2, Math.abs(answerValue) * .015);
        return Number.isFinite(candidateValue) && Math.abs(candidateValue - answerValue) <= tolerance;
      });
    })
    || (answerChoice.length >= 2 && normalizedExplanation.includes(answerChoice.replace(/,/g, '')));
  if (!answerSupported) return null;

  const lines = explanation
    .split(/(?:\n+|(?<=[.!?])\s+)/)
    .map((line) => line.replace(/\[해설작성자[^\]]*\]/g, '').replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 4 && line.length <= 240)
    .filter((line) => /(?:=|＝|∝|×|÷|\*|\/|제곱|비례|공식)/i.test(line))
    .filter((line) => !/https?:|정답\s*(?:은|:|=)?\s*[1-4]\s*번만/i.test(line));
  if (!lines.length) return null;

  const score = (line: string): number => {
    let value = 0;
    if (/(?:공식|성적계수|COP|열량|효율|압력|동력|전력|유량|풍량|엔트로피|PV|RT|Δ|√)/i.test(line)) value += 4;
    if (/[A-Za-z가-힣]\s*(?:=|＝|∝)/.test(line)) value += 3;
    if (/(?:=|＝).*(?:=|＝)/.test(line)) value += 2;
    if (answerNumbers.some((number) => line.replace(/,/g, '').includes(number))) value += 1;
    return value;
  };
  const formula = [...lines].sort((left, right) => score(right) - score(left))[0];
  const substitution = lines.find((line) => line !== formula
    && answerNumbers.some((number) => line.replace(/,/g, '').includes(number))
    && numericTokens(line).length >= 2);
  return {
    formula: `COMCBT 풀이식: ${formula}`,
    reason: nativeComcbt
      ? '이 문제의 COMCBT 원문 해설에서 계산식을 확인해 그대로 기준으로 삼았습니다.'
      : '동일 문제의 COMCBT 추가 해설에 계산식과 정답값이 함께 확인되어 이 식을 기준으로 정리했습니다.',
    symbols: '식에 나온 기호와 숫자는 문제 조건을 같은 순서로 대응해 확인하세요.',
    substitution,
    unitTip: '',
  };
}

export function calculationGivenValues(item: QuestionItem): string[] {
  const prompt = plainText(item.question.text || item.question.html);
  return prompt.match(/-?\d+(?:\.\d+)?\s*(?:kW|W|kJ|kcal\/h|kcal|kg\/s|kg\/h|kg|m³\/s|m³\/min|m³\/h|m³|m²|m\/s|mmHg|mm|cm|m|kPa|MPa|Pa|bar|℃|K|V|A|Ω|%|rpm|RT)/gi)?.slice(0, 10) || [];
}

export function commonCalculationNumberOrigins(item: QuestionItem): string[] {
  const source = plainText([
    item.question.text,
    item.question.html,
    item.question.explanation,
    item.question.explanationHtml,
  ].filter(Boolean).join(' '));
  const rules: Array<[RegExp, string]> = [
    [/\b273(?:\.15)?\b/, '273(정확히는 273.15)는 섭씨 0℃를 절대온도 K로 바꾸는 기준값입니다. 섭씨온도에 약 273을 더하면 K가 됩니다.'],
    [/\b101\.325\b/, '101.325kPa는 표준대기압 1기압을 SI 단위로 나타낸 값입니다. 760mmHg·1.01325bar와 같은 압력입니다.'],
    [/\b760\b.*mmHg|mmHg.*\b760\b/i, '760mmHg는 표준대기압 1기압입니다. 101.325kPa와 같은 압력을 수은기둥 높이로 표시한 값입니다.'],
    [/\b1\.0332\b/, '1.0332kgf/cm²는 표준대기압 1기압을 중력단위로 나타낸 근삿값입니다.'],
    [/\b9\.8(?:1)?\b/, '9.8 또는 9.81m/s²는 지구의 중력가속도 g입니다. 질량 kg을 힘 N으로 바꿀 때 등장합니다.'],
    [/\b4\.18\b|\b4\.2\b/, '4.18(문제에 따라 4.2)kJ/(kg·℃)는 물의 비열입니다. 물 1kg의 온도를 1℃ 올리는 데 필요한 열량입니다.'],
    [/\b0\.24\b/, '0.24kcal/(kg·℃)는 공기의 정압비열을 옛 열량단위로 나타낸 근삿값입니다. 공기 현열 계산에 자주 씁니다.'],
    [/\b1\.2\s*kg\/?m(?:³|3)|공기[^.]{0,40}(?:밀도|비중량)[^.]{0,30}\b1\.2\b|\b1\.2\b[^.]{0,30}공기[^.]{0,20}(?:밀도|비중량)/i, '1.2kg/m³는 보통 상태에서 공기 1m³의 질량을 약 1.2kg으로 잡은 공기 밀도 근삿값입니다.'],
    [/\b3600\b|\b3,600\b/, '3,600은 1시간=60분×60초이기 때문에 나옵니다. 초당 단위(kW 등)와 시간당 단위를 바꿀 때 씁니다.'],
    [/\b860\b\s*kcal|1\s*kW[^.]{0,30}\b860\b/i, '860kcal/h는 1kW를 옛 열량단위로 바꾼 근삿값입니다. 즉 1kW≈860kcal/h입니다.'],
    [/(?:\b3024\b|\b3,024\b)\s*kcal|USRT[^.]{0,40}(?:\b3024\b|\b3,024\b)/i, '3,024kcal/h는 미국 냉동톤 1USRT의 냉동능력입니다. 1USRT≈3.517kW와 같은 값입니다.'],
    [/(?:\b3320\b|\b3,320\b)\s*kcal|(?:일본|JRT)[^.]{0,40}(?:\b3320\b|\b3,320\b)/i, '3,320kcal/h는 옛 문제에서 쓰는 일본 냉동톤 1RT의 환산값입니다. 문제에 USRT라고 적혔으면 3,024kcal/h와 구분합니다.'],
    [/\b3\.517\b\s*kW|USRT[^.]{0,40}\b3\.517\b/i, '3.517kW는 미국 냉동톤 1USRT의 냉동능력입니다. 3,024kcal/h와 같은 값입니다.'],
    [/\b539\b\s*kcal|증발잠열[^.]{0,30}\b539\b/i, '539kcal/kg은 100℃ 부근에서 물 1kg이 증기로 바뀔 때 필요한 증발잠열의 옛 단위 근삿값입니다.'],
    [/\b427\b[^.]{0,20}kgf|1\s*kcal[^.]{0,30}\b427\b/i, '427kgf·m/kcal은 열량과 일을 바꾸는 열의 일당량입니다. 1kcal가 약 427kgf·m의 일과 같다는 뜻입니다.'],
    [/\b102\b[^.]{0,20}kgf|1\s*kW[^.]{0,30}\b102\b/i, '약 102kgf·m/s는 1kW를 중력단위 동력으로 바꾼 값입니다. 1kW≈102kgf·m/s로 환산할 때 씁니다.'],
    [/\b0\.707\b/, '0.707은 1/√2의 근삿값입니다. 사인파의 최댓값과 실효값을 바꿀 때 등장합니다.'],
    [/√3|1\.732/, '√3≈1.732는 3상 교류에서 선간값과 상값의 120° 위상 관계 때문에 생기는 값입니다.'],
    [/\b1000\b|\b1,000\b/, '1,000은 단위 접두어 k(킬로) 변환 또는 물의 밀도 1,000kg/m³에서 자주 나옵니다. 이 문제의 단위를 보고 어느 쪽인지 구분합니다.'],
    [/(?:×|x|\*|÷|\/)\s*100\b|\b100\s*(?:%|퍼센트)|퍼센트/i, '100은 소수 비율을 퍼센트(%)로 바꿀 때 곱합니다. 예를 들어 0.6×100=60%입니다.'],
    [/(?:×|x|\*|÷|\/)\s*60\b|\b60\s*(?:초|분)|1시간[^.]{0,20}60분|1분[^.]{0,20}60초/i, '60은 1분=60초 또는 1시간=60분인 시간 단위 변환에서 주로 나옵니다.'],
  ];
  return rules.filter(([pattern]) => pattern.test(source)).map(([, explanation]) => explanation);
}

export function isCalculationItem(item: QuestionItem): boolean {
  const prompt = plainText(item.question.text || item.question.html);
  const choices = item.question.choices.map((choice) => plainText(choice.text || choice.html));
  const source = `${prompt} ${choices.join(' ')}`;
  const asksForQuantity = /계산(?:값|하|하시오|하여)?|구하|산출|얼마(?:인가|인지|가)|몇\s*(?:개|배|%|℃|도|kW|W|kcal|kg|m|Pa|V|A|Ω|rpm|RT)?|값은|필요(?:한)?\s*(?:열량|동력|전력|유량|풍량)|소요(?:되는)?\s*(?:동력|전력|열량)/i.test(prompt);
  const hasFormulaSignal = /\bCOP\b|성능계수|냉동톤|\bRT\b|kW|kcal|엔탈피|열량|유량|풍량|동력|전력|전류|전압|저항|효율|압력|온도|습도|℃|kg\/|m²|m³|kPa|MPa|Pa|rpm|역률|비열|열관류/i.test(source);
  const numericChoiceCount = choices.filter((choice) => /(?:^|\s|[①-④])[-+]?\d|√|π|%|℃|kW|kcal|kg|m²|m³|Pa|V|A|Ω|rpm|RT/i.test(choice)).length;
  const explanation = plainText(item.question.explanation || item.question.explanationHtml);
  const explanationHasEquation = /(?:공식|계산|산출|=|＝|×|÷|\*|\/|제곱|비례)/i.test(explanation)
    && /\d/.test(explanation);
  return asksForQuantity
    || (hasFormulaSignal && numericChoiceCount >= 3 && /다음|조건|때|경우|관계/i.test(prompt))
    || (numericChoiceCount >= 3 && explanationHasEquation);
}

export function calculationGuideFor(item: QuestionItem): CalculationGuide {
  const questionSource = calculationSource(item);
  const comcbtExplanation = comcbtCalculationExplanation(item);
  const primaryExplanation = plainText(String(item.question.explanation || item.question.explanationHtml || '')
    .split(/\n\n\[(?:COMCBT 동일 문제 추가 해설|한솔아카데미 동일 문제 보충 해설|정답·해설 대조 완료)\]\n/)[0]);
  // 동일 문제 COMCBT 해설뿐 아니라 이미 사람이 다듬은 쉬운 해설의 공식·용어도
  // 유형 판별에 사용한다. 화면에 자세한 해설이 있는데도 일반 안내로 떨어지는 일을 막는다.
  const source = `${questionSource} ${primaryExplanation} ${comcbtExplanation}`.trim();
  const goal = plainText(item.question.text || item.question.html) || `${item.subject}의 조건을 읽고 보기와 일치하는 값을 찾는 문제`;
  const comcbtGuide = comcbtEquationGuide(item, comcbtExplanation);
  if (comcbtGuide) return {
    goal,
    ...comcbtGuide,
  };

  if (/진공압|mmHg.*절대압력|절대압력.*mmHg/i.test(source)) {
    const vacuum = Number(source.match(/진공압\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1] || 0);
    const remaining = vacuum ? 760 - vacuum : 0;
    return {
      goal: vacuum ? `진공압 ${vacuum}mmHg일 때 실제 남은 절대압력을 kPa로 구합니다.` : goal,
      formula: '절대압력 = 표준대기압 - 진공압, 단위 변환은 남은 mmHg × 101.325 ÷ 760',
      symbols: '진공압은 대기압에서 얼마나 부족한지를 나타내고, 절대압력은 완전진공 0을 기준으로 실제 남아 있는 압력입니다.',
      reason: '진공압 300 mmHg는 압력이 300이라는 뜻이 아니라 표준대기압보다 300 mmHg 낮다는 뜻이므로 먼저 빼야 합니다.',
      numberOrigins: [
        '760 mmHg: 수은기둥 약 760mm가 누르는 압력이 표준대기압 1기압입니다.',
        '101.325 kPa: 같은 표준대기압 1기압을 SI 압력단위 kPa로 바꾼 값입니다.',
        '따라서 760 mmHg와 101.325 kPa는 서로 다른 압력이 아니라 같은 1기압을 두 종류의 자로 잰 값입니다.',
      ],
      substitution: vacuum
        ? `① 남은 압력은 760-${vacuum}=${remaining} mmHg입니다. ② ${remaining} mmHg는 1기압의 ${remaining}/760만큼입니다. ③ 그래서 ${remaining}×101.325÷760≈${(remaining * 101.325 / 760).toFixed(1)} kPa입니다.`
        : '표준대기압에서 진공압을 뺀 뒤, 남은 mmHg가 760 mmHg 중 얼마인지 비율을 만들어 101.325 kPa에 곱합니다.',
      unitTip: 'mmHg 상태에서 뺄셈을 먼저 끝낸 뒤 마지막에 kPa로 바꾸면 단위가 섞이지 않습니다.',
    };
  }

  if (/혼합공기|외기.*환기.*혼합|바이패스\s*팩터|bypass\s*factor/i.test(source)) return {
    goal,
    formula: '혼합값 = (공기량₁×상태값₁ + 공기량₂×상태값₂) ÷ 전체 공기량, 바이패스 팩터 BF=(출구온도-코일표면온도)÷(입구온도-코일표면온도)',
    symbols: '공기량은 섞이는 비율, 상태값은 온도·엔탈피 등 문제에서 섞으라고 한 값입니다. BF는 코일을 충분히 만나지 못하고 지나간 공기의 비율입니다.',
    reason: '많이 들어온 공기의 상태가 혼합 결과에 더 크게 반영되므로 단순 평균이 아니라 공기량을 곱한 가중평균을 씁니다.',
    unitTip: '혼합비 1:3이면 전체는 4칸입니다. 각 값을 1칸·3칸만큼 곱해 더하고 4로 나눕니다.',
  };

  if (/역\s*카르노|carnot|카르노/i.test(source)) return {
    goal,
    formula: '역카르노 냉동 COP = 저온부 절대온도 Tₗ ÷ (고온부 Tₕ-저온부 Tₗ)',
    symbols: 'Tₗ은 증발기 쪽 낮은 절대온도, Tₕ는 응축기 쪽 높은 절대온도입니다.',
    reason: '카르노 성능은 두 열원의 온도 차이로 정해집니다. 온도 차이가 작을수록 압축기가 덜 힘들어 COP가 커집니다.',
    numberOrigins: ['섭씨온도는 그대로 나누면 안 됩니다. 각 온도에 273(정확히는 273.15)을 더해 절대온도 K로 바꿉니다.'],
    unitTip: '분자와 분모 모두 K를 사용합니다. 온도차 Tₕ-Tₗ의 숫자는 ℃로 뺀 값과 같습니다.',
  };

  if (/이상기체|완전가스|가스\s*정수|등온변화|등압.*팽창|보일.*샤를/i.test(source)) return {
    goal,
    formula: '이상기체 기본식 PV=mRT, 등온이면 P₁V₁=P₂V₂, 등압이면 V₁/T₁=V₂/T₂',
    symbols: 'P는 절대압력, V는 체적, m은 질량, R은 기체상수, T는 절대온도 K입니다.',
    reason: '기체는 압력·부피·온도가 함께 변하므로 변하지 않는 조건(등온·등압)을 먼저 골라 식을 간단하게 만듭니다.',
    numberOrigins: ['기체 계산의 온도는 섭씨에 273을 더한 절대온도 K를 사용합니다. 0℃가 분자운동의 0이 아니기 때문입니다.'],
    unitTip: '게이지압력은 대기압을 더해 절대압력으로 만들고, ℃는 K로 바꾼 뒤 비례식을 세웁니다.',
  };

  if (/게이지압|압축비|중간압력|수주|압력.*환산/i.test(source)) return {
    goal,
    formula: '절대압력 = 게이지압력 + 대기압, 압축비 = 토출 절대압력 ÷ 흡입 절대압력, 최적 중간 절대압력 = √(고압×저압)',
    symbols: '게이지압력은 대기압을 0으로 본 값이고, 절대압력은 완전진공을 0으로 본 값입니다.',
    reason: '압축비와 기체 공식은 실제 압력의 비를 써야 하므로 게이지압력을 그대로 나누면 안 됩니다.',
    numberOrigins: ['대기압은 단위에 따라 약 1.033kgf/cm², 101.325kPa, 760mmHg 중 하나를 더합니다. 모두 같은 1기압입니다.'],
    unitTip: '두 압력을 같은 단위로 맞추고 둘 다 절대압력으로 바꾼 다음 계산합니다.',
  };

  if (/상당증발량|보일러.*마력|보일러\s*효율/i.test(source)) return {
    goal,
    formula: '상당증발량 = 실제증발량×(발생증기 엔탈피-급수 엔탈피)÷539, 보일러마력 = 상당증발량÷15.65',
    symbols: '실제증발량은 시간당 만든 증기 질량, 엔탈피 차는 물 1kg에 실제로 준 열입니다.',
    reason: '서로 다른 급수·증기 조건의 보일러를 표준 증발조건으로 바꾸어 같은 기준에서 비교하기 때문입니다.',
    numberOrigins: ['539kcal/kg은 표준상태에서 물 1kg을 증기로 바꾸는 데 쓰는 증발잠열 근삿값이고, 15.65kg/h는 보일러 1마력의 상당증발량입니다.'],
    unitTip: '증기 엔탈피에서 급수 엔탈피를 먼저 빼고, 시간당 질량과 곱한 뒤 환산값으로 나눕니다.',
  };

  if (/냉매순환량|압축일량|냉동부하|냉동능력|응축기.*(?:부하|열량)|증발기.*(?:부하|열량)/i.test(source)
    && !/성능계수|\bCOP\b/i.test(source)) return {
    goal,
    formula: '냉매순환량 G = 냉동부하 Qₑ ÷ 냉동효과 qₑ, 응축열 Q꜀ = 냉동열 Qₑ + 압축일 W',
    symbols: 'qₑ는 냉매 1kg이 증발기에서 가져가는 열량, G는 1시간(또는 1초)에 도는 냉매 질량입니다.',
    reason: '전체 냉동부하를 냉매 1kg이 처리하는 양으로 나누면 필요한 냉매의 수가 나오고, 응축기는 가져온 열과 압축기 일을 모두 버려야 합니다.',
    unitTip: 'Q와 q의 시간·질량 단위를 맞춥니다. kcal/h÷kcal/kg이면 kg/h가 남는지 단위를 지워 보세요.',
  };

  if (/내부에너지|엔탈피|열역학.*일/i.test(source)) return {
    goal,
    formula: '엔탈피 h = 내부에너지 u + 압력이 밀어내는 일 Pv, 닫힌계 에너지식은 ΔU = 받은 열 Q - 밖으로 한 일 W',
    symbols: 'u는 물질 안에 저장된 에너지, Pv는 자리를 만들며 밀어낸 일, Q는 받은 열, W는 계가 밖으로 한 일입니다.',
    reason: '열을 받았더라도 일부가 바깥을 미는 일로 빠져나가므로 남은 만큼만 내부에너지가 증가합니다.',
    numberOrigins: ['옛 단위 문제에서 1kcal≈427kgf·m를 사용합니다. 열량과 기계적 일을 같은 단위로 바꾸기 위한 환산값입니다.'],
    unitTip: '열을 받으면 +Q, 밖으로 일을 하면 -W로 부호를 표시하고, kcal와 kgf·m를 먼저 같은 단위로 바꿉니다.',
  };

  if (/정전용량|콘덴서|커패시터|임피던스|인덕턴스|R\s*-\s*L\s*-\s*C/i.test(source)) return {
    goal,
    formula: '콘덴서 병렬 C=C₁+C₂…, 직렬 1/C=1/C₁+1/C₂… / RLC 직렬 임피던스 Z=√(R²+(Xₗ-X꜀)²)',
    symbols: 'C는 정전용량, R은 저항, Xₗ은 코일 리액턴스, X꜀는 콘덴서 리액턴스입니다.',
    reason: '콘덴서는 저항과 반대로 병렬에서 용량이 더해지고 직렬에서는 역수로 합쳐집니다. 교류회로의 저항성분은 위상차 때문에 피타고라스식으로 합칩니다.',
    unitTip: 'μF끼리, Ω끼리 단위를 맞춥니다. 같은 콘덴서 2개면 병렬은 2C, 직렬은 C/2입니다.',
  };

  if (/선팽창|신축량|배관.*팽창|열팽창/i.test(source)) return {
    goal,
    formula: '길이 변화 ΔL = 원래 길이 L × 선팽창계수 α × 온도차 ΔT',
    symbols: 'L은 가열 전 길이, α는 재료가 1℃ 오를 때 늘어나는 비율, ΔT는 최종온도-처음온도입니다.',
    reason: '긴 관일수록, 잘 늘어나는 재료일수록, 온도가 많이 변할수록 더 길게 늘어나기 때문입니다.',
    unitTip: 'L과 원하는 답의 길이 단위를 확인합니다. m로 계산한 뒤 mm가 답이면 마지막에 1,000을 곱합니다.',
  };

  if (/슬립|동기속도|극수|유도전동기.*출력/i.test(source)) return {
    goal,
    formula: '동기속도 Nₛ=120f÷P, 슬립 s=(Nₛ-N)÷Nₛ, 회전자 기계출력=(1-s)×회전자입력',
    symbols: 'f는 주파수 Hz, P는 극수, Nₛ는 자기장의 속도, N은 실제 회전자 속도입니다.',
    reason: '유도전동기는 자기장보다 조금 느리게 돌아야 힘이 생기며, 그 차이의 비율이 슬립입니다.',
    numberOrigins: ['120은 1분의 60초와 자석의 N·S 한 쌍(2극)을 함께 반영한 60×2 환산값입니다.'],
    unitTip: '슬립 4%는 4가 아니라 0.04입니다. 극수는 2·4·6처럼 짝수인지 확인합니다.',
  };

  if (/성능계수|\bCOP\b/i.test(source)) return {
    goal,
    formula: '냉동 COP = 냉동효과(Qₗ) ÷ 압축기에 넣은 일(W)',
    symbols: 'Qₗ은 차갑게 만든 열량, W는 압축기에 공급한 일입니다.',
    reason: '같은 일을 넣었을 때 얼마나 큰 냉동효과를 얻는지 비교하는 값이기 때문입니다.',
    numberOrigins: ['엔탈피 h₁·h₂·h₄ 값은 문제 또는 P-h 선도에서 읽습니다. 공식 밖에서 임의로 생기는 숫자가 아닙니다.'],
    unitTip: '분자와 분모의 단위를 먼저 같게 맞추면 COP에는 단위가 남지 않습니다.',
  };
  if (/냉동톤|\bRT\b/i.test(source)) {
    const japaneseTon = /일본|JRT|3,?320/i.test(source);
    return {
      goal,
      formula: japaneseTon ? '1 일본냉동톤(JRT) = 약 3,320 kcal/h' : '1 USRT = 약 3.517 kW = 약 3,024 kcal/h',
      symbols: 'RT는 냉동능력의 크기를 나타내는 단위이며, 문제에서 미국식 USRT인지 일본식 JRT인지 확인합니다.',
      reason: '냉동톤과 kW 또는 kcal/h 사이의 크기를 바꾸는 문제에 쓰는 기본 환산값입니다.',
      numberOrigins: [japaneseTon
        ? '3,320 kcal/h는 물 1톤을 24시간에 얼리는 열량을 기준으로 한 일본냉동톤의 환산값입니다.'
        : '3.517 kW와 3,024 kcal/h는 물 1쇼트톤을 24시간에 얼리는 열량을 기준으로 한 미국냉동톤의 환산값입니다.'],
      unitTip: japaneseTon ? 'JRT에 3,320을 곱하면 kcal/h가 됩니다.' : 'USRT를 kW로 바꿀 때는 3.517을 곱하고, kW를 USRT로 바꿀 때는 3.517로 나눕니다.',
    };
  }
  if (/상대습도|절대습도|습공기|수증기분압|습도/i.test(source)) return {
    goal,
    formula: '상대습도(%) = 현재 수증기압 ÷ 같은 온도의 포화수증기압 × 100',
    symbols: '현재 수증기압은 실제 물의 양, 포화수증기압은 그 온도에서 담을 수 있는 최대량을 뜻합니다.',
    reason: '공기가 담을 수 있는 최대 수증기량과 현재 수증기량을 비교하는 문제이기 때문입니다.',
    numberOrigins: ['마지막의 100은 소수 비율을 퍼센트(%)로 바꾸기 위해 곱합니다. 예를 들어 0.6은 60%입니다.'],
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
    numberOrigins: ['√3은 3상 전압 세 개가 120°씩 어긋난 벡터 관계에서 생기는 값으로, 임의로 붙인 숫자가 아닙니다.', '역률이나 효율이 80%로 주어졌다면 계산기에 80이 아니라 0.8을 넣습니다.'],
    unitTip: '계산 결과가 W이면 1,000으로 나누어 kW로 바꿉니다.',
  };
  if (/펌프|양정|수동력|축동력/i.test(source)) return {
    goal,
    formula: '펌프 동력 P = ρ × g × Q × H ÷ η',
    symbols: 'ρ는 밀도, g는 중력가속도, Q는 유량, H는 양정, η는 효율입니다.',
    reason: '물을 일정 높이까지 보내는 데 필요한 일과 실제 손실을 함께 계산하기 때문입니다.',
    numberOrigins: ['ρ는 문제에서 주어진 유체 밀도를 사용합니다. 물이고 별도 조건이 없다면 약 1,000kg/m³를 씁니다.', 'g≈9.81m/s²는 지구 중력가속도이며 문제에서 9.8 또는 9.81을 사용합니다.', '효율 80%는 손실을 반영하기 위해 0.8로 바꿔 나눕니다.'],
    unitTip: 'Q를 m³/s로 맞추고 계산하면 W가 나오며, kW는 1,000으로 나눕니다.',
  };
  if (/팬|송풍기|회전수|상사법칙|풍량/i.test(source)) return {
    goal,
    formula: '팬 법칙: 풍량 Q∝N, 압력 H∝N², 동력 P∝N³',
    symbols: 'N은 회전수, Q는 풍량, H는 압력, P는 동력입니다.',
    reason: '같은 팬에서 회전수가 바뀔 때 풍량·압력·동력이 서로 다른 비율로 변하기 때문입니다.',
    numberOrigins: ['1·2·3제곱은 암기 숫자입니다. 풍량 1제곱, 압력 2제곱, 동력 3제곱 순서로 적용합니다.'],
    unitTip: '새 값 ÷ 기존 값의 비를 먼저 만들고, 압력은 제곱·동력은 세제곱합니다.',
  };
  if (/유량|연속방정식|유속|단면적/i.test(source)) return {
    goal,
    formula: '체적유량 Q = 단면적 A × 속도 v',
    symbols: 'Q는 m³/s, A는 m², v는 m/s입니다.',
    reason: '통로의 넓이와 1초 동안 이동하는 길이를 곱하면 1초 동안 지나간 부피가 되기 때문입니다.',
    numberOrigins: /지름|직경|원형|파이프|관경/i.test(source)
      ? ['π≈3.14는 원의 둘레와 지름의 비이고, ÷4는 지름 d로 원의 면적을 구할 때 반지름 d/2를 제곱하면서 생깁니다.']
      : undefined,
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
    reliable: false,
  };
}
