import type { Question, Round } from './types';
export type EnergySourceMode = 'textbook' | 'combined';
export const energySourceLabel = (mode: EnergySourceMode): string => mode === 'textbook' ? '에너지 교재 문제' : 'CBT + 에너지 교재';
export function energyQuestionKey(q: Question): string { return `${q._originRoundId}:${q._originalNumber}`; }

/** Filter only new draws. The catalog retains every original ID for restoration. */
export function energySourceRounds(rounds: readonly Round[], mode: EnergySourceMode): Round[] {
 return rounds.map(r => ({...r, questions:r.questions.filter(q => !q.midtermDuplicateOf
  && (mode === 'textbook' ? q.midtermTextbook : !q.midtermTextbook))}));
}
