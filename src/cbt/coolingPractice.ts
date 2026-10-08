import type { QuestionItem } from './types';
import { coolingStem } from './coolingScope';
import { uniqueSchoolItems } from './schoolQuestionBank';

// School practice only: do not change calculation detection in other catalogs.
// A numeric constant/formula recall question is not an arithmetic exercise.
const reviewed = new Set(['hvac-20060816:30', 'hvac-20070304:21', 'hvac-20070513:36', 'hvac-20080511:40',
    'hvac-20140817:22', 'hvac-20150816:39', 'hvac-20160508:22',
    'hvac-hansol-2018-2:24', 'hvac-hansol-2021-2:28', 'hvac-hansol-2022-3:21',
    'hvac-hansol-2023-1:35', 'hvac-hansol-2023-2:28']);
export function coolingCalculation(item: QuestionItem): boolean {
  const text = coolingStem(item);
  const id = item.id.replace(/^school-cooling::/, '');
  // Reviewed figure-only/PDF-private-glyph calculations lack readable givens.
  if (reviewed.has(id)) return true;
  if (/공정점|일당량은|몇법칙|필요한값이아닌|구하는식|가장높은가|온도는얼마로유지|동결잠열은얼마/.test(text)) return false;
  const asks = /얼마|몇|구하|계산하|계산하면|값은|소요시간/i.test(text);
  const given = /\d+(?:[.,]\d+)?\s*(?:℃|°C|K|kW|W|kJ|J|kcal|cal|kg|g|m|cm|mm|kPa|MPa|Pa|bar|%|RT|rpm|초|분|시간|배|톤|ℓ|L|kWh|V|A)/i.test(text);
  const numericChoices = item.question.choices.filter(choice => /^(?:약\s*)?[-+]?\d/.test((choice.text || choice.html || '').replace(/<[^>]*>/g, '').trim())).length;
  return given && (asks || numericChoices >= 3);
}

export function coolingPracticeSelection(items: QuestionItem[], count: number, calculationCount?: number, random = Math.random): QuestionItem[] {
  if (!Number.isInteger(count) || count < 1 || (calculationCount !== undefined && (!Number.isInteger(calculationCount) || calculationCount < 0 || calculationCount > count))) throw new Error('출제 문제 수를 확인해 주세요.');
  const pool = uniqueSchoolItems(items);
  const sample = (values: QuestionItem[], size: number) => {
    const shuffled = [...values];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, size);
  };
  if (calculationCount === undefined) return sample(pool, count);
  const calculations = pool.filter(coolingCalculation);
  const theory = pool.filter(item => !coolingCalculation(item));
  if (calculations.length < calculationCount || theory.length < count - calculationCount || count < calculationCount) {
    throw new Error('선택 범위에 계산5개와 나머지 이론 문제가 부족합니다. 범위를 넓히거나 계산5개 포함 옵션을 꺼 주세요.');
  }
  return sample([...sample(calculations, calculationCount), ...sample(theory, count - calculationCount)], count);
}
