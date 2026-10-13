import type { Question, Round } from './types';
export type EnergySourceMode = 'textbook' | 'combined';
export const energySourceLabel = (mode: EnergySourceMode): string => mode === 'textbook' ? '에너지 교재 문제' : 'CBT + 에너지 교재';
export function energyQuestionKey(q: Question): string { return `${q._originRoundId}:${q._originalNumber}`; }

/** Filter only new draws. The catalog retains every original ID for restoration. */
export function energySourceRounds(rounds: readonly Round[], mode: EnergySourceMode): Round[] {
 const textbook = rounds.flatMap(r => r.questions).filter(q => q.midtermTextbook && !q.midtermDuplicateOf);
 const equivalents = new Set(textbook.flatMap(q => q.midtermLegacyEquivalentIds || []));
 return rounds.map(r => ({...r, questions:r.questions.filter(q => !q.midtermDuplicateOf
  && (q.midtermTextbook || (mode === 'combined' && !equivalents.has(energyQuestionKey(q)))))}));
}
