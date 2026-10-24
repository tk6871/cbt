import { practicalCategoryLabels, type PracticalPrompt } from './hvacPracticalTypes';
import { practicalSourceLabel } from './practicalLabels';

export type PracticalSearchField = 'all' | 'question' | 'answer' | 'explanation';
export type PracticalSearchOptions = {
  query: string;
  group: 'all' | PracticalPrompt['group'];
  category: 'all' | PracticalPrompt['category'];
  field: PracticalSearchField;
};
export const practicalSearchGroupLabels: Record<PracticalPrompt['group'], string> = {
  restored: '회차별 기출', public: '공개 자료', supplement: '필답문제2 PDF',
  photos: '사진·기기 PDF', foundation: '기초 연습', drill: '심화 연습',
};
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ko').replace(/\s+/g, '');
const terms = (query: string) => query.trim().split(/\s+/).map(normalize).filter(Boolean);
export function matchesPracticalText(text: string, query: string): boolean {
  const normalized = normalize(text);
  return terms(query).every(term => normalized.includes(term));
}
export function createPracticalSearchIndex(prompts: PracticalPrompt[]) {
  return prompts.map(prompt => {
    const fields = {
      question: normalize(prompt.question), answer: normalize(prompt.answer),
      explanation: normalize(`${prompt.explanation} ${(prompt.keyPoints || []).join(' ')}`),
    };
    const metadata = normalize(`${practicalSourceLabel(prompt)} ${practicalSearchGroupLabels[prompt.group]} ${practicalCategoryLabels[prompt.category]}`);
    return { prompt, fields, all: `${fields.question}\n${fields.answer}\n${fields.explanation}\n${metadata}` };
  });
}
export function searchPracticalPrompts(index: ReturnType<typeof createPracticalSearchIndex>, options: PracticalSearchOptions) {
  const words = terms(options.query);
  if (!words.length) return [];
  return index.filter(({ prompt, fields, all }) => {
    if (options.group !== 'all' && prompt.group !== options.group) return false;
    if (options.category !== 'all' && prompt.category !== options.category) return false;
    const text = options.field === 'all' ? all : fields[options.field];
    return words.every(word => text.includes(word));
  }).map(({ prompt, fields }) => ({
    prompt,
    matchedIn: (['question', 'answer', 'explanation'] as const).filter(field => words.some(word => fields[field].includes(word))),
  }));
}
