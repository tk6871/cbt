export const practicalBatchOptions = [2, 4, 6, 8, 10, 12, 0] as const;
export function restorePracticalBatch(value: string | null): number {
  const n = value === null || !value.trim() ? NaN : Number(value);
  return practicalBatchOptions.some(option => option === n) ? n : 2;
}
export function restorePracticalMode(value: string | null): 'type' | 'memorize' {
  // Retired handwrite preferences fall back without removing any stored ink.
  return value === 'memorize' ? 'memorize' : 'type';
}
