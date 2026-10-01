import { mappedSubject } from './catalog';
import type { QuestionItem } from './types';

export const coolingMidtermTitle = '냉동공학 중간고사';

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
export function uniqueSchoolItems(items: QuestionItem[]): QuestionItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const q = item.question;
    const text = (q.text || q.html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const key = text.length < 8 ? item.id : JSON.stringify([
      text, q.choices, q.answer, q.images || [], q.sourceImage || '',
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
