export const energyDefaultCalculationTopics = [6, 11] as const;
export const energyDefaultCalculationExcluded = [1, 2, 13, 15].map(n => `school-energy-topic-${n}`);

/** Correct the old implicit default once without resetting custom choices. */
export function restoreEnergyCalculationExcluded(current: unknown, legacy: unknown): string[] {
  const valid = (value: unknown): value is string[] => Array.isArray(value)
    && value.every(id => typeof id === 'string' && /^school-energy-topic-\d+$/.test(id));
  if (valid(current)) {
    const previousDefault = [1, 2, 15].map(n => `school-energy-topic-${n}`);
    if (current.length === previousDefault.length && previousDefault.every(id => current.includes(id)))
      return [...energyDefaultCalculationExcluded];
    return [...new Set(current)];
  }
  const oldDefault = [1, 11, 15].map(n => `school-energy-topic-${n}`);
  if (valid(legacy) && !(legacy.length === oldDefault.length && oldDefault.every(id => legacy.includes(id)))) {
    return [...new Set(legacy)];
  }
  return [...energyDefaultCalculationExcluded];
}

/** Cover each note topic once; vary the chosen source question and presentation order. */
export function energyMidtermPractice<T>(topicPools: readonly (readonly T[])[], random = Math.random,
  options?: { isCalculation: (item: T) => boolean; calculationTopics: readonly number[]; includeOtherCalculations?: boolean }): T[] {
  const selected = topicPools.map((pool, index) => {
    const preferred = options?.calculationTopics.includes(index + 1);
    const candidates = options ? pool.filter(item => preferred ? options.isCalculation(item) : options.includeOtherCalculations || !options.isCalculation(item)) : pool;
    if (!candidates.length) throw new Error(`${index + 1}번 주제의 시험 연습 후보가 없습니다.`);
    return candidates[Math.floor(random() * candidates.length)];
  });
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [selected[i], selected[j]] = [selected[j], selected[i]];
  }
  return selected;
}
