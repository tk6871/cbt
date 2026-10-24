import type { PracticalPrompt } from './hvacPracticalTypes';
import { additionalMockCandidate, type MockCandidate } from './practicalMockCandidates';

export type MockKind = 'calculation' | 'sequence' | 'air' | 'device' | 'piping' | 'theory' | 'formula';
export const mockKindLabels: Record<MockKind, string> = { calculation: '수치 계산', sequence: '시퀀스·제어', air: '공조·선도', device: '기기·계측', piping: '배관·시공', theory: '원리·서술', formula: '공식 쓰기' };
type Slot = { id: string; round: string; number: number; kind: MockKind; topic: string };
type Entry = [number, MockKind, string];
// Book-number-based manual review of all 108 stems/answers, not category keyword inference.
// 2023-2 has an unmatched supplemental item: do not treat it as a complete template.
const reviewed: Record<string, Entry[]> = {
  '2023-3': [[1,'calculation','heat-phase'],[2,'device','dps'],[3,'theory','tev'],[4,'device','solenoid'],[5,'calculation','shf'],[6,'air','psychrometric-lines'],[7,'piping','check-valve'],[8,'air','erv'],[9,'piping','elbow'],[10,'piping','joint-symbols'],[11,'sequence','self-hold-reset'],[12,'sequence','control-flow']],
  '2024-1': [[1,'device','reciprocating-compressor'],[2,'calculation','refrigerant-flow'],[3,'device','overload-sensor'],[4,'piping','flare-tool'],[5,'theory','tev'],[6,'air','psychrometric-change'],[7,'air','psychrometric-cycle'],[8,'calculation','mixed-air'],[9,'theory','dew-condensation'],[10,'piping','strainer'],[11,'device','clamp-meter'],[12,'sequence','manual-auto']],
  '2024-2': [[1,'device','manifold'],[2,'device','evaporative-condenser'],[3,'device','capillary'],[4,'device','flooded-evaporator'],[5,'calculation','floor-transfer'],[6,'calculation','cooling-load'],[7,'formula','bf-cf'],[8,'piping','flange'],[9,'piping','strainer'],[10,'device','timer-device'],[11,'sequence','self-hold-start-stop'],[12,'sequence','contact-symbols']],
  '2024-3': [[1,'theory','ammonia-moisture'],[2,'device','finned-evaporator'],[3,'theory','seebeck'],[4,'device','accumulator'],[5,'piping','expander-tool'],[6,'air','ventilation'],[7,'calculation','mixed-air'],[8,'air','outlets'],[9,'piping','reducer'],[10,'formula','threaded-pipe-length'],[11,'sequence','timer-contacts'],[12,'sequence','series-parallel']],
  '2025-1': [[1,'theory','absorption'],[2,'calculation','cooling-capacity'],[3,'device','accumulator'],[4,'device','leak-detector'],[5,'air','fcu'],[6,'air','erv'],[7,'calculation','pump-power'],[8,'piping','reducing-tee'],[9,'piping','piping-plan'],[10,'device','buzzer'],[11,'sequence','time-chart'],[12,'sequence','timer-overload']],
  '2025-2': [[1,'theory','tev'],[2,'device','water-defrost'],[3,'calculation','wall-transfer'],[4,'calculation','pump-affinity'],[5,'air','psychrometric-change'],[6,'air','induction-unit'],[7,'piping','check-valve'],[8,'piping','supports'],[9,'device','vernier'],[10,'sequence','star-delta'],[11,'device','voltage-transformer'],[12,'sequence','self-hold-start-stop']],
  '2025-3': [[1,'calculation','cooling-capacity'],[2,'device','centrifugal-compressor'],[3,'air','psychrometric-cycle'],[4,'calculation','boiler-output'],[5,'air','jet-fan'],[6,'piping','steam-trap'],[7,'theory','insulation'],[8,'piping','expansion-joint'],[9,'piping','welding-gas'],[10,'device','multimeter'],[11,'sequence','flicker-chart'],[12,'sequence','self-hold-reset']],
  '2026-1': [[1,'sequence','timer-contacts'],[2,'air','psychrometric-cycle'],[3,'piping','ball-valve'],[4,'theory','absorption'],[5,'calculation','condenser-area'],[6,'calculation','bent-pipe-length'],[7,'device','insulation-meter'],[8,'theory','evap-pressure-cycle'],[9,'device','epr'],[10,'piping','canvas-joint'],[11,'device','eocr'],[12,'air','constant-volume']],
  '2026-2': [[1,'sequence','reversing-interlock'],[2,'sequence','manual-auto'],[3,'sequence','time-chart'],[4,'air','air-medium'],[5,'theory','dew-condensation'],[6,'piping','female-adapter'],[7,'theory','insulation'],[8,'theory','and-logic'],[9,'calculation','airflow'],[10,'calculation','floor-transfer'],[11,'device','liquid-circulation'],[12,'device','scroll-compressor']],
};
export const practicalMockSlots: Slot[] = Object.entries(reviewed).flatMap(([round, entries]) => entries.map(([number, kind, topic]) => ({ id: `${round}:${number}`, round, number, kind, topic })));
export const practicalMockRounds = Object.keys(reviewed);
export type PracticalPattern = { attempt: string; template: string; sourceIds: string[]; kinds: MockKind[] };
export function mockPromptId(pattern: PracticalPattern, index: number): string { return `hvac-mock-${pattern.attempt}-${index + 1}`; }
export function mockSessionPrompts(bank: PracticalPrompt[], pattern?: PracticalPattern): PracticalPrompt[] {
  if (!pattern) return [];
  const byId = new Map(bank.map(p => [p.id, p]));
  return pattern.sourceIds.flatMap((id, i) => { const p = byId.get(id); return p ? [{ ...p, id: mockPromptId(pattern, i) }] : []; });
}
export function validPracticalPattern(value: unknown): value is PracticalPattern {
  if (!value || typeof value !== 'object') return false;
  const p = value as PracticalPattern;
  return typeof p.attempt === 'string' && /^[a-z0-9-]{1,70}$/.test(p.attempt) && practicalMockRounds.includes(p.template)
    && Array.isArray(p.sourceIds) && p.sourceIds.length === 12 && new Set(p.sourceIds).size === 12
    && p.sourceIds.every(id => typeof id === 'string' && /^(?:hvac-practical-(?:restored|foundation|drill|supplement|photo)-[a-z0-9-]+|moducbt-hvac-practical-\d+)$/.test(id))
    && Array.isArray(p.kinds) && p.kinds.length === 12 && p.kinds.every(k => typeof k === 'string' && Object.prototype.hasOwnProperty.call(mockKindLabels, k));
}
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function buildPracticalPattern(bank: PracticalPrompt[], random = Math.random, template?: string): { prompts: PracticalPrompt[]; template: string; kinds: MockKind[]; topics: string[] } {
  const linked = practicalMockSlots.map(slot => ({ slot, prompt: bank.find(p => p.group === 'restored' && `${p.year}-${p.session}` === slot.round && p.number === slot.number && !p.numberLabel) }));
  if (linked.some(p => !p.prompt)) throw new Error('복원 구성표에 연결되지 않은 문제가 있습니다. 자료를 다시 불러와 주세요.');
  const round = template || practicalMockRounds[Math.floor(random() * practicalMockRounds.length)];
  const slots = practicalMockSlots.filter(s => s.round === round);
  if (slots.length !== 12) throw new Error('실전 구성표를 찾지 못했습니다.');
  const recentIds = new Set(linked.map(x => x.prompt!.id));
  const pool: MockCandidate[] = [
    ...linked.map(x => ({ prompt:x.prompt!, kind:x.slot.kind, topic:x.slot.topic })),
    ...bank.filter(p => !recentIds.has(p.id)).flatMap(p => { const candidate=additionalMockCandidate(p); return candidate ? [candidate] : []; }),
  ];
  const chosen: MockCandidate[] = [], seenTopics = new Set<string>(), seenContent = new Set<string>();
  const hasAdditional = pool.some(x => x.prompt.group !== 'restored' && slots.some(s => s.kind === x.kind));
  // Topics are selected uniformly first; a repeatedly restored question does not
  // gain weight merely because it appears in several rounds. Never relax uniqueness.
  for (const slot of slots) {
    let available = pool.filter(x => x.kind === slot.kind && !seenTopics.has(x.topic) && !seenContent.has(contentKey(x.prompt)));
    if (hasAdditional && !chosen.some(x => x.prompt.group !== 'restored')) {
      const extras = available.filter(x => x.prompt.group !== 'restored');
      if (extras.length) available = extras;
    }
    const topics = [...new Set(available.map(x => x.topic))];
    const topic = shuffled(topics, random)[0];
    const candidate = shuffled(available.filter(x => x.topic === topic), random)[0];
    if (!candidate) throw new Error('중복 없이 12문제를 구성하지 못했습니다. 다시 시작해 주세요.');
    chosen.push(candidate); seenTopics.add(topic); seenContent.add(contentKey(candidate.prompt));
  }
  return { prompts: chosen.map(x => x.prompt), template: round, kinds: slots.map(s => s.kind), topics: chosen.map(x => x.topic) };
}
function contentKey(p: PracticalPrompt): string { return `${p.question}|${p.answer}`.normalize('NFKC').replace(/\s+/g, ''); }
export function practicalPatternSummary(kinds: MockKind[]): string {
  return (Object.keys(mockKindLabels) as MockKind[]).flatMap(k => { const n = kinds.filter(kind => kind === k).length; return n ? [`${mockKindLabels[k]} ${n}`] : []; }).join(' · ');
}
