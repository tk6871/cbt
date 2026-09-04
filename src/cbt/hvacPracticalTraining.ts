import type { PracticalPrompt } from './hvacPracticalTypes';

export type PracticalCriterionKind = 'formula' | 'process' | 'unit' | 'keyword' | 'diagram';

export type PracticalCriterion = {
  id: string;
  label: string;
  kind: PracticalCriterionKind;
};

const stopWords = new Set(['그리고', '또는', '대한', '한다', '하여', '있는', '없는', '것은', '경우', '때문', '정답', '설명']);

export function normalizePracticalText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ko').replace(/\s+/g, '').replace(/[·ㆍ,.;:()\[\]{}]/g, '');
}

function meaningfulTokens(value: string): string[] {
  return [...new Set(value.normalize('NFKC').toLocaleLowerCase('ko')
    .replace(/[^0-9a-z가-힣%℃°/²³.-]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !stopWords.has(token)))];
}

function criterionKind(value: string): PracticalCriterionKind {
  if (/(도면|회로|배관|그림|도식|기호)/.test(value)) return 'diagram';
  if (/(단위|kw|kj|kcal|mpa|kpa|pa|℃|kg|m³|w\/|rpm|cop)/i.test(value)) return 'unit';
  if (/[=×÷+\-√]|공식|계산|대입/.test(value)) return 'formula';
  if (/(순서|과정|절차|단계)/.test(value)) return 'process';
  return 'keyword';
}

export function practicalCriteria(prompt: PracticalPrompt): PracticalCriterion[] {
  const source = prompt.keyPoints?.filter(Boolean).length
    ? prompt.keyPoints!.filter(Boolean)
    : prompt.answer.split(/\n|[.;。]|(?<=다)\s+/).map((row) => row.trim()).filter((row) => row.length >= 2).slice(0, 6);
  return source.slice(0, 10).map((label, index) => ({
    id: `${prompt.id}-criterion-${index}`,
    label,
    kind: criterionKind(label),
  }));
}

export function criterionMatchesDraft(criterion: PracticalCriterion, draft: string): boolean {
  const normalizedDraft = normalizePracticalText(draft);
  const normalizedLabel = normalizePracticalText(criterion.label);
  if (!normalizedDraft || !normalizedLabel) return false;
  if (normalizedLabel.length <= 12 && normalizedDraft.includes(normalizedLabel)) return true;
  const tokens = meaningfulTokens(criterion.label);
  if (!tokens.length) return false;
  const matches = tokens.filter((token) => normalizedDraft.includes(normalizePracticalText(token))).length;
  return matches >= Math.max(1, Math.ceil(tokens.length * 0.6));
}

export function practicalExpectedUnits(prompt: PracticalPrompt): string[] {
  const matches = prompt.answer.match(/(?:kW|W|kJ\/kg|kJ|kcal\/h|MPa|kPa|Pa|kg\/s|kg\/h|kg|m³\/min|m³\/h|m³|m\/s|mm|cm|m|℃|°C|%|rpm|COP)/gi) || [];
  return [...new Set(matches.map((value) => value.replace('°C', '℃')))];
}

export function practicalExpectedNumbers(prompt: PracticalPrompt): string[] {
  return [...new Set((prompt.answer.match(/(?<![a-z가-힣])\d+(?:\.\d+)?/gi) || []).filter((value) => value.length < 9))].slice(0, 8);
}

export function practicalRequirementLines(prompt: PracticalPrompt): string[] {
  const lines: string[] = [];
  const count = prompt.question.match(/(\d+)\s*(가지|개|항목|종류|방법|원인|대책)/);
  if (count) lines.push(`${count[1]}${count[2]}를 모두 작성`);
  if (/(계산|구하시오|구하여|산출|얼마)/.test(prompt.question)) lines.push('공식·대입·계산·최종 답 작성');
  if (/(단위|kw|kj|kcal|mpa|kpa|℃|kg|m³|cop)/i.test(`${prompt.question} ${prompt.answer}`)) lines.push('최종 값에 단위 표시');
  if (/(도시|그리|도면|회로|배관도|선도)/.test(prompt.question)) lines.push('기호·연결 방향·명칭 확인');
  if (/(이유|원인|설명|정의|무엇)/.test(prompt.question)) lines.push('결론과 근거 핵심어 작성');
  return lines.length ? lines : ['문제에서 요구한 핵심어를 빠짐없이 작성'];
}

export function practicalAnswerTemplate(prompt: PracticalPrompt): string {
  if (prompt.category === 'calculation' || /(계산|구하시오|산출|얼마)/.test(prompt.question)) {
    return '공식:\n대입:\n계산:\n최종 답:                (단위)';
  }
  if (/(도시|그리|도면|회로|배관도|선도)/.test(prompt.question)) return '도면:\n기호·명칭:\n흐름 또는 동작 설명:';
  const count = prompt.question.match(/(\d+)\s*(가지|개|항목|종류|방법|원인|대책)/)?.[1];
  if (count) return Array.from({ length: Math.min(8, Number(count)) }, (_, index) => `${index + 1}. `).join('\n');
  if (/(비교|차이)/.test(prompt.question)) return '① 대상 A:\n② 대상 B:\n차이점:';
  return '결론:\n핵심 근거:';
}

export function practicalInitialHint(prompt: PracticalPrompt): string {
  const points = practicalCriteria(prompt);
  if (!points.length) return practicalCategoryHint(prompt);
  return points.map((point) => meaningfulTokens(point.label)[0]?.[0] || point.label[0]).join(' · ');
}

export function practicalCategoryHint(prompt: PracticalPrompt): string {
  const hints = {
    calculation: '구하는 값의 단위를 먼저 보고, 그 단위가 나오는 공식을 떠올려 보세요.',
    equipment: '장치의 역할을 입력·동작·출력 순서로 떠올려 보세요.',
    cycle: '냉매가 지나가는 순서와 각 구간의 압력·온도 변화를 떠올려 보세요.',
    operation: '현상 → 원인 → 조치 순서로 답안을 구성해 보세요.',
    piping: '흐름 방향, 기울기, 오일 회수와 안전 조건을 확인하세요.',
    air: '공기의 현열·잠열 변화와 장치의 목적을 구분하세요.',
    safety: '위험 원인과 예방 조치를 짝으로 떠올려 보세요.',
  } as const;
  return hints[prompt.category];
}

export function maskPracticalAnswer(prompt: PracticalPrompt): string {
  let masked = prompt.answer;
  const words = practicalCriteria(prompt).flatMap((criterion) => meaningfulTokens(criterion.label)).sort((a, b) => b.length - a.length);
  for (const word of [...new Set(words)].slice(0, 12)) masked = masked.replaceAll(word, '＿＿＿');
  return masked;
}
