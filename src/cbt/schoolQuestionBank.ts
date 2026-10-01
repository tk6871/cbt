import { mappedSubject } from './catalog';
import type { QuestionItem } from './types';

export const coolingMidtermTitle = '냉동공학 중간고사';
export const coolingRecordPrefix = 'school-cooling::';
export const coolingRecordId = (id: string) => id.startsWith(coolingRecordPrefix) ? id : `${coolingRecordPrefix}${id}`;
export const isCoolingRecord = (id: string) => id.startsWith(coolingRecordPrefix);
export const coolingOriginalId = (id: string) => isCoolingRecord(id) ? id.slice(coolingRecordPrefix.length) : id;
export function coolingRecordItem(item: QuestionItem): QuestionItem {
  return { ...item, id: coolingRecordId(item.id), subject: '냉동냉장설비' };
}

export const coolingTopics = ['냉동이론', '냉동장치의 구조', '냉동장치의 응용과 안전관리', '냉동냉장 부하계산', '냉동설비의 설치', '냉방설비운영'] as const;
const topicTerms: Array<RegExp> = [
  /냉동사이클|성적계수|엔탈피|엔트로피|열역학|카르노|절대압|진공압|비열|냉매.*(?:특성|특징|성질)|몰리에르|증기압|임계온도|압축비|과열도|과냉각|포화(?:온도|압력)|이상기체/g,
  /압축기|응축기|증발기|팽창밸브|수액기|유분리기|액분리기|압축방식|왕복동|스크루|스크롤|모세관|역지밸브|전자밸브|건조기|드라이어|냉동장치의 구성/g,
  /안전밸브|안전관리|누설|중독|동상|제빙|빙축열|급속동결|동결장치|냉동창고|냉장창고|콜드체인|식품|방폭|보호구|흡수식|흡착식|열전냉동|펠티어|브라인/g,
  /부하|냉동능력|전열면적|열관류|열통과|침입열|침입공기|저장품|단열두께|환기량|냉각열량|냉동톤|소요동력|동력.*계산/g,
  /배관|관경|관지름|배관길이|이중입상관|오일트랩|기밀시험|내압시험|진공건조|진공펌프|냉매충전|냉매 충전|설치장소|방진|지지대|납땜|용접|수압시험|플레어/g,
  /냉방|히트펌프|열펌프|냉각탑|냉각수|냉수|공조기|팬코일|냉수펌프|수온|냉동기.*(?:운전|정지|제어)|펌프다운|제상|운전순서|운전 순서|고압차단|저압차단/g,
];
export function coolingTopic(item: QuestionItem): string {
  const q = item.question;
  const plain = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  const text = plain([q.text, q.html, q.ocrText, ...q.choices.map(choice => choice.text || choice.html)].filter(Boolean).join(' '));
  const explanation = plain(q.explanation || q.explanationHtml || '');
  // Questions drive the classification; explanations only break a clear near tie.
  const scores = topicTerms.map(pattern => (text.match(pattern)?.length || 0) * 3 + Math.min(2, explanation.match(pattern)?.length || 0));
  const best = Math.max(...scores);
  const ranked = scores.map((score, index) => ({ score, index })).sort((a, b) => b.score - a.score);
  return best >= 3 && ranked[0].score > ranked[1].score ? coolingTopics[ranked[0].index] : '분류 미확인';
}

export function normalizedSchoolSubject(item: QuestionItem): string {
  return mappedSubject(item.round.qualificationKey || '', item.subject);
}

export function coolingMidtermItems(items: QuestionItem[]): QuestionItem[] {
  return items.filter(item => ['hvac', 'hvac-hansol'].includes(item.round.qualificationKey || '')
    && normalizedSchoolSubject(item).replace(/\s/g, '') === '냉동냉장설비'
    && item.round.kind !== 'field-report-practice').map(item => ({ ...item, subject: '냉동냉장설비' }));
}

// Keep numerical conditions, choice order, images and answers in the key.
// Similar wording alone is not enough to merge two exam questions.
export function schoolItemKey(item: QuestionItem): string {
    const q = item.question;
    const text = (q.text || q.html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length < 8 ? coolingOriginalId(item.id) : JSON.stringify([
      text, q.choices, q.answer, q.images || [], q.sourceImage || '',
    ]);
}

export function uniqueSchoolItems(items: QuestionItem[]): QuestionItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = schoolItemKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type CoolingDrawState = { ids: string[]; resetAt: number; savedAt: number };
export function coolingUnusedItems(items: QuestionItem[], all: QuestionItem[], drawn: CoolingDrawState,
  attempts: Record<string, { at: number }>): QuestionItem[] {
  const usedIds = new Set(drawn.ids);
  const usedKeys = new Set(all.filter(item => usedIds.has(item.id)
    || (attempts[item.id] && attempts[item.id].at > drawn.resetAt)).map(schoolItemKey));
  // Keep unused aliases here so narrowing to an older year or a source does not
  // accidentally hide that source's representative. Deduplicate the chosen pool.
  return items.filter(item => !usedKeys.has(schoolItemKey(item)));
}
