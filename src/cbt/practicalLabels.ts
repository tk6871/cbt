import type { PracticalPrompt } from './hvacPracticalTypes';

export function practicalSourceLabel(prompt: PracticalPrompt): string {
  if (prompt.year && prompt.session) {
    const session = /^\d+$/.test(prompt.session) ? `${prompt.session}회` : prompt.session;
    const number = prompt.numberLabel || (prompt.number ? `${prompt.number}번` : '추가 복원');
    return `${prompt.year}년 ${session} ${number}`;
  }
  return prompt.group === 'foundation' ? '기초 연습' : prompt.group === 'drill' ? '심화 연습' : '추가 자료';
}
