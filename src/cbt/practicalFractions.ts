/** Explicitly reviewed fraction layouts shared by the web and printable booklet. */
export type MathPart = string | { top: MathPart[]; bottom: MathPart[] };
export type FractionLine = { parts: MathPart[]; note?: string };
const frac = (top: string | MathPart[], bottom: string | MathPart[]): MathPart => ({ top: typeof top === 'string' ? [top] : top, bottom: typeof bottom === 'string' ? [bottom] : bottom });
const line = (left: string, top: string | MathPart[], bottom: string | MathPart[], right = '', note?: string): FractionLine => ({ parts: [left, frac(top, bottom), right], note });
const normalize = (value: string) => value.replace(/\s/g, '');
const formulas = new Map<string, FractionLine[]>();
function add(names: string[], rows: FractionLine[]) { for (const name of names) formulas.set(normalize(name), rows); }

add(['COP = Qe ÷ L', 'COP = Qe ÷ L, Qc = Qe + L'], [line('COP = ', 'Qe', 'L', '', '위(분자)는 얻는 냉동능력, 아래(분모)는 넣는 압축기 동력입니다.'), { parts:['Qc = Qe + L'] }]);
add(['냉동 COP = Qe ÷ L, 난방 COP = Qc ÷ L'], [line('냉동 COP = ', 'Qe', 'L'), line('난방 COP = ', 'Qc', 'L', '', '냉동은 Qe, 난방은 Qc를 위에 놓습니다. 아래는 둘 다 입력동력 L입니다.')]);
add(['COP = (h흡입 - h팽창밸브입구) ÷ (h토출 - h흡입)'], [line('COP = ', 'h흡입 − h팽창밸브입구', 'h토출 − h흡입', '', '위의 뺄셈과 아래의 뺄셈을 각각 끝낸 뒤, 위 결과를 아래 결과로 나눕니다.')]);
add(['BF = (t출구 - t코일) ÷ (t입구 - t코일)', 'BF = (t출구-t코일) ÷ (t입구-t코일), CF = 1-BF'], [line('BF = ', 't출구 − t코일', 't입구 − t코일', '', '위는 출구에 남은 온도차, 아래는 입구에서 코일까지의 전체 온도차입니다.'), { parts:['CF = 1 − BF'] }]);
add(['G = Qe ÷ (h출구 - h입구)', 'G = Qe ÷ (h증발기출구 - h증발기입구)'], [line('G = ', 'Qe', 'h증발기출구 − h증발기입구', '', '아래는 증발기 출구에서 입구 엔탈피를 뺀 값입니다. Qe를 출구값 하나로만 나누지 않습니다.')]);
add(['V = Qs ÷ (ρ × c × Δt)', 'Q = ρ × V × c × Δt, V = Q ÷ (ρ × c × Δt)'], [{ parts:['Q현열 = ρ × V × c × Δt'] }, line('V = ', 'Q현열', 'ρ × c × Δt', '', '밀도·비열·온도차를 모두 곱한 값을 아래에 놓습니다. 현열 Qs를 쓰는 식입니다.')]);
add(['SHF = Qs ÷ (Qs + Ql)', 'SHF = 현열 ÷ (현열 + 잠열)'], [line('SHF = ', '현열 Qs', '현열 Qs + 잠열 Ql', '', '아래는 현열과 잠열을 더한 전체 열입니다. 전열이 이미 주어졌다면 그 값이 바로 분모입니다.')]);
add(['혼합값 = (외기값 × 외기량 + 실내값 × 실내공기량) ÷ 전체 공기량'], [line('혼합값 = ', '외기값 × 외기량 + 실내값 × 실내공기량', '외기량 + 실내공기량', '', '위에서는 각 값에 공기량을 곱해 더하고, 아래에서는 공기량만 더합니다.')]);
add(['Q = K × A × Δt, K = Q ÷ (A × Δt)'], [{ parts:['Q = K × A × Δt'] }, line('K = ', 'Q', 'A × Δt', '', '면적과 온도차를 먼저 곱한 뒤 열량을 나눕니다.')]);
add(['K = 1 ÷ (1/α바깥 + δ/λ + 1/α안)'], [line('K = ', '1', [frac('1', 'α바깥'), ' + ', frac('δ', 'λ'), ' + ', frac('1', 'α안')], '', '아래의 작은 분수 세 개를 각각 계산해 더합니다. 마지막으로 1을 그 합으로 나눕니다.')]);
add(['Q = Gc(t출구-t입구), A = Q ÷ (K × Δt평균)'], [{ parts:['Q = G × c × (t출구 − t입구)'] }, line('A = ', 'Q', 'K × Δt평균', '', '여기서 Δt평균은 냉매와 물의 온도차 평균입니다. 물 자체의 출구−입구 온도차와 구별합니다.')]);
add(['L = a + b + 2 × π × R × (θ ÷ 360)'], [line('L = a + b + 2 × π × R × ', 'θ', '360', '', 'θ/360은 원 한 바퀴 중 쓰는 몫입니다. 90도라면 90/360 = 1/4입니다.')]);
add(['Qe = G × (1-x) × r, RT = Qe ÷ (문제의 kW/RT)'], [{ parts:['Qe = G × (1 − x) × r'] }, line('RT = ', 'Qe (kW)', '문제에서 준 1 RT의 kW값', '', '분모에는 문제의 환산값을 넣습니다. 이 자료의 해당 문제에서는 3.86입니다.')]);
add(['총열량 E = m × c × Δt, 냉동능력 Q = E ÷ 시간(s)'], [{ parts:['E = m × c × Δt'] }, line('Q = ', 'E (kJ)', '시간 (s)', '', '총열량을 걸린 초로 나누면 kJ/s = kW가 됩니다.')]);
add(['L = γ × Q × H ÷ (1,000 × η)'], [line('L = ', 'γ × Q × H', '1,000 × η', '', '위 세 값을 곱하고, 아래의 1,000과 효율도 곱한 뒤 나눕니다. γ는 감마이며 알파벳 y가 아닙니다.')]);
add(['N₂ = N₁ × (Q₂ ÷ Q₁)'], [line('N₂ = N₁ × ', 'Q₂', 'Q₁', '', '새 유량이 위, 옛 유량이 아래입니다. 구한 배수를 옛 회전수에 곱합니다.')]);
add(['RT = 냉방부하 합계(kW) ÷ (문제의 kW/RT)'], [line('RT = ', '냉방부하 합계 (kW)', '문제에서 준 1 RT의 kW값')]);
add(['P절대 = (760 - P진공) × 101.325 ÷ 760'], [line('P절대 = ', '(760 − P진공) × 101.325', '760', ' kPa', '760−진공압으로 남은 mmHg를 구한 뒤, 101.325/760을 곱해 kPa로 바꿉니다.')]);
add(['회전수 a배 → 유량 a배 · 양정 a²배 · 동력 a³배'], [line('a = ', '새 회전수', '옛 회전수'), { parts:['유량 a배 · 양정 a²배 · 동력 a³배'] }]);

export const fractionBasics: FractionLine[] = [
  line('', '12', '3', ' = 12 ÷ 3 = 4', '분수선은 나누기입니다. 위는 분자, 아래는 분모. 위의 값을 아래의 값으로 나눕니다.'),
  line('', '24', '2 × 3', ' = 24 ÷ (2 × 3) = 4', '분모 전체가 한 묶음입니다. 24÷2×3처럼 괄호 없이 입력하면 다른 값이 됩니다.'),
];
export function fractionFormula(formula: string): FractionLine[] { return formulas.get(normalize(formula)) || []; }
export const workedFractions: Record<string, FractionLine[]> = {
  'foundation-2':[line('COP = ', '12', '3', ' = 4 (단위 없음)')],
  'drill-07':[line('COP = ', '24', '6', ' = 4 (단위 없음)')],
  'drill-09':[line('COP = ', '400 − 250', '450 − 400', ' = 3')],
  'restored-2024-2-10':[line('BF = ', '② − ③', '① − ③'), line('CF = ', '① − ②', '① − ③')],
  'foundation-11':[line('P절대 = ', '(760 − 300) × 101.325', '760', ' ≈ 61.33 kPa')],
  'drill-14':[line('P절대 = ', '(760 − 380) × 101.325', '760', ' ≈ 50.66 kPa')],
  'drill-08':[line('G = ', '75', '400 − 250', ' = 0.50 kg/s')],
  'drill-12':[line('SHF = ', '21', '30', ' = 0.70')],
  'drill-28':[line('혼합온도 = ', '10 × 32 + 30 × 24', '10 + 30', ' = 26 °C')],
  'restored-2026-2-09':[line('V = ', '25', '1.2 × 1.01 × (26 − 15)', ' ≈ 1.87519 m³/s')],
  'restored-2025-1-11':[line('Q = ', '10,000 × 4.2 × (35 − 2)', '2 × 3,600', ' = 192.5 kW'), line('RT = ', '192.5', '3.86', ' ≈ 49.87 RT')],
  'restored-2025-3-06':[line('RT = ', '1.3 × (1 − 0.1) × 1,675', '3.86', ' ≈ 507.71 RT')],
  'restored-2026-2-10':[line('K = ', '490', '(10 × 10) × (20 − 10.2)', ' = 0.50 W/(m²·K)')],
  'restored-2026-1-05':[line('G = ', '200', '60', ' kg/s'), line('Δt평균 = ', '(40 − 28) + (40 − 31)', '2', ' = 10.5 K'), line('A = ', '42', '0.95 × 10.5', ' ≈ 4.21 m²')],
  'restored-2026-1-06':[line('L = 350 + 500 + 2 × π × 150 × ', '90', '360', ' ≈ 1,085.62 mm')],
  'restored-2025-3-07':[line('L = ', '28,500 × 1.5 × 1.5', '1,000', ' = 64.125 kW')],
  'restored-2025-2-07':[line('K = ', '1', [frac('1', '0.05'), ' + ', frac('0.10', '0.000025'), ' + ', frac('1', '0.009')], ' ≈ 0.000242 W/(m²·K)')],
  'restored-2025-2-08':[line('N₂ = 800 × ', '2', '1.5', ' ≈ 1,066.67 rpm')],
  'restored-2025-1-04':[line('Q = ', '1,500', '3,600', ' m³/s'), line('L = ', ['9,800 × ', frac('1,500','3,600'), ' × 10'], '1,000 × 0.7', ' ≈ 58.33 kW')],
  'restored-2024-3-07':[line('온도 = ', '−8 × 1 + 24 × 3', '1 + 3', ' = 16 °C'), line('절대습도 = ', '0.001 × 1 + 0.008 × 3', '1 + 3', ' = 0.00625 kg/kg(DA)')],
  'restored-2024-2-08':[line('RT = ', '22.1', '3.86', ' ≈ 5.73 RT')],
  'restored-2024-1-06':[line('G = ', '12 × 3.86 × 3,600', '1,630 − 545', ' ≈ 153.69 kg/h')],
  'restored-2024-1-09':[line('온도 = ', '−5 × 1 + 20 × 4', '1 + 4', ' = 15 °C'), line('절대습도 = ', '0.001 × 1 + 0.005 × 4', '1 + 4', ' = 0.0042 kg/kg(DA)')],
  'restored-2023-3-04':[line('SHF = ', '8.3', '8.3 + 2.8', ' ≈ 0.75')],
  'restored-2023-2-12':[line('기존 복원 효율 = ', '3,978,540', '130 × 40,000', ' × 100 ≈ 76.51%', '기존 복원답안의 정격출력 기준입니다. 효율의 출력 기준에 관한 기존 주의를 함께 읽으세요.')],
};
export function fractionsForProblem(id: string): FractionLine[] { return workedFractions[id.replace(/^hvac-practical-/, '')] || []; }
export function fractionText(parts: MathPart[]): string { return parts.map(p => typeof p === 'string' ? p : `(${fractionText(p.top)}) ÷ (${fractionText(p.bottom)})`).join(''); }
export function fractionTex(parts: MathPart[]): string {
  const symbols: Record<string,string> = { γ:'\\gamma{}', ρ:'\\rho{}', η:'\\eta{}', α:'\\alpha{}', δ:'\\delta{}', λ:'\\lambda{}', θ:'\\theta{}', Δ:'\\Delta{}', π:'\\pi{}', '²':'{}^{2}', '³':'{}^{3}' };
  for (const [index,char] of [...'₀₁₂₃₄₅₆₇₈₉'].entries()) symbols[char] = `{}_{${index}}`;
  for (const [index,char] of [...'①②③'].entries()) symbols[char] = `\\text{(${index+1})}`;
  const text = (s: string) => s.split(/([γρηαδλθΔπ²³₀₁₂₃₄₅₆₇₈₉①②③])/).filter(Boolean).map(chunk => symbols[chunk] || `\\text{${chunk.replace(/[\\{}%$#_^&~]/g, c => `\\${c}`)}}`).join('');
  return parts.map(p => typeof p === 'string' ? text(p) : `\\frac{${fractionTex(p.top)}}{${fractionTex(p.bottom)}}`).join('');
}
