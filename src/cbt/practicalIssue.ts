import type { PracticalPrompt } from './hvacPracticalTypes';
import type { QuestionIssueSubmission } from './cloudSync';

export function practicalIssueSnapshot(prompt: PracticalPrompt, displayNumber: number, image?: string): Omit<QuestionIssueSubmission, 'space' | 'issue_types' | 'details'> {
  return {
    qualification_key: 'hvac-practical', qualification: '공조냉동기계산업기사 필답형',
    round_id: prompt.year ? `hvac-practical-${prompt.year}-${prompt.session || 'unknown'}` : `hvac-practical-${prompt.group}`,
    round_title: prompt.year ? `${prompt.year}년 ${prompt.session || ''}회 필답형` : `필답형 ${prompt.group} 자료`,
    round_year: prompt.year, round_session: prompt.session,
    question_id: prompt.id,
    question_number: prompt.number || Number(prompt.id.match(/(\d+)$/)?.[1]) || displayNumber,
    display_number: displayNumber, subject: '필답형',
    // Written answers have no 1..4 configured_answer. Keep the actual answer
    // as a labelled snapshot instead of inventing a multiple-choice number.
    question_text: `${prompt.question}\n\n[학습용 핵심 답안]\n${prompt.answer}`.slice(0, 5000),
    source_image: image || prompt.image || prompt.images?.[0],
  };
}
