/** Conservative SI quantity comparison, not an official marking rule.
 * Prefixes: https://www.nist.gov/pml/owm/metric-si-prefixes
 * Compound dimensions stay distinct; no gauge/absolute pressure or C/K inference.
 */
const units: Record<string, [string, number]> = {
  W: ['power', 1], kW: ['power', 1000], MW: ['power', 1e6],
  J: ['energy', 1], kJ: ['energy', 1000], MJ: ['energy', 1e6],
  Pa: ['pressure', 1], kPa: ['pressure', 1000], MPa: ['pressure', 1e6],
  m: ['length', 1], cm: ['length', .01], mm: ['length', .001],
  m2: ['area', 1], cm2: ['area', 1e-4], mm2: ['area', 1e-6],
  m3: ['volume', 1], L: ['volume', .001],
  kg: ['mass', 1], g: ['mass', .001],
  'kg/s': ['mass-flow', 1], 'kg/min': ['mass-flow', 1 / 60], 'kg/h': ['mass-flow', 1 / 3600],
  'm3/s': ['volume-flow', 1], 'm3/min': ['volume-flow', 1 / 60], 'm3/h': ['volume-flow', 1 / 3600],
  'J/kg': ['specific-energy', 1], 'kJ/kg': ['specific-energy', 1000],
  'm/s': ['velocity', 1], 'cm/s': ['velocity', .01],
  '°C': ['celsius', 1], K: ['kelvin', 1],
};
const unitPattern = Object.keys(units).sort((a, b) => b.length - a.length).map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
export type PracticalQuantity = { text: string; value: number; unit: string; dimension: string; baseValue: number };

export function practicalQuantities(value: string): PracticalQuantity[] {
  const text = value.normalize('NFKC').replace(/−/g, '-').replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, '').replace(/\b(m|cm|mm)\^([23])/g, '$1$2').replace(/\s*\/\s*/g, '/');
  const pattern = new RegExp(`(?<![\\w./^+-])([+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:[eE][+-]?\\d+)?)\\s*(${unitPattern})(?![a-zA-Z0-9/²³·^])`, 'g');
  return [...text.matchAll(pattern)].map(match => ({
    text: match[0], value: Number(match[1]), unit: match[2],
    dimension: units[match[2]]![0], baseValue: Number(match[1]) * units[match[2]]![1],
  })).filter(row => Number.isFinite(row.baseValue));
}

export function comparePracticalQuantities(answer: string, draft: string) {
  const candidates = practicalQuantities(draft);
  return practicalQuantities(answer).map(expected => ({
    expected,
    match: candidates.find(actual => actual.dimension === expected.dimension
      && Math.abs(actual.baseValue - expected.baseValue) <= Math.max(1e-12, Math.abs(expected.baseValue) * 1e-9)),
  }));
}
