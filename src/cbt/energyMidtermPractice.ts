/** Cover each note topic once; vary the chosen source question and presentation order. */
export function energyMidtermPractice<T>(topicPools: readonly (readonly T[])[], random = Math.random): T[] {
  const selected = topicPools.filter(pool => pool.length > 0)
    .map(pool => pool[Math.floor(random() * pool.length)]);
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [selected[i], selected[j]] = [selected[j], selected[i]];
  }
  return selected;
}
