/** Cover each note topic once; vary the chosen source question and presentation order. */
export function energyMidtermPractice<T>(topicPools: readonly (readonly T[])[], random = Math.random,
  options?: { isCalculation: (item: T) => boolean; calculationTopics: readonly number[] }): T[] {
  const selected = topicPools.map((pool, index) => {
    const candidates = options ? pool.filter(item => options.isCalculation(item) === options.calculationTopics.includes(index + 1)) : pool;
    if (!candidates.length) throw new Error(`${index + 1}번 주제의 시험 연습 후보가 없습니다.`);
    return candidates[Math.floor(random() * candidates.length)];
  });
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [selected[i], selected[j]] = [selected[j], selected[i]];
  }
  return selected;
}
