import type { PracticalPrompt } from './hvacPracticalTypes';

export type PracticalMaterialPeriod = 'all' | 'since-2023-2' | 'before-2023-2';

// A source-material boundary, not a claim about official exam format or review status.
export function matchesPracticalMaterialPeriod(prompt: Pick<PracticalPrompt, 'group' | 'year' | 'session'>, period: PracticalMaterialPeriod): boolean {
  if (period === 'all') return true;
  if (prompt.group !== 'restored' || !prompt.year || !prompt.session) return false;
  const recent = prompt.year > 2023 || (prompt.year === 2023 && Number(prompt.session) >= 2);
  return period === 'since-2023-2' ? recent : !recent;
}
