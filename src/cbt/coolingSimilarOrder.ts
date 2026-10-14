import type { QuestionItem } from './types';
import { coolingStem } from './coolingScope';
import { coolingBookSection, coolingTopic } from './schoolQuestionBank';

// Ordering hints, not new scope/duplicate/answer verdicts. Use only the stem:
// a distractor or explanation mentioning brine must not move a question there.
const concepts: Array<[string, RegExp]> = [
  ['브라인', /브라인/],
  ['냉동유', /냉동유|냉동기유|윤활유/],
  ['냉매선도', /몰리에르|냉매선도|p[－-]?h선도|압력엔탈피/i],
  ['냉매', /냉매.*(?:특성|특징|성질|조건|종류|명명|번호|구비)|공비|비공비|천연냉매|자연냉매|신냉매|R[-－]?\d{2,3}[a-z]?/i],
  ['압력', /진공압|절대압|게이지압|표준대기압/],
  ['열전달', /열전달|열관류|열통과|대수평균|전열면적/],
  ['열량·비열', /잠열|현열|비열|열당량/],
  ['냉동톤', /냉동톤|냉동능력.*(?:단위|RT)|미국.*냉동/],
  ['다단·다원', /다단|다원|이단압축|2단압축|캐스케이드/],
  ['카르노', /카르노|카노사이클/],
  ['과열·과냉각', /과열도|과냉각/],
  ['냉동사이클', /성적계수|냉동사이클|냉동효과|압축비/],
  ['열역학 법칙', /열역학.*법칙|제[0123일이삼]법칙|내부에너지|엔트로피|에너지보존/],
  ['기체 상태변화', /이상기체|기체상태|등온|단열과정|등압|등적|폴리트로픽/],
  ['압축기', /압축기|왕복동|스크루|스크롤|축봉|피스톤|커넥팅로드|크랭크/],
  ['응축기', /응축기/],
  ['증발기', /증발기/],
  ['팽창장치', /팽창밸브|모세관|감온통/],
  ['유분리기', /유분리기/],
  ['액분리기', /액분리기/],
  ['수액기', /수액기/],
  ['건조기', /건조기|드라이어/],
  ['제어·밸브', /압력스위치|온도조절기|자동제어|전자밸브|솔레노이드|역지밸브/],
  ['제빙·동결', /제빙|동결|식품|콜드체인/],
  ['열펌프', /열펌프|히트펌프/],
  ['축열', /축열|축냉/],
  ['흡수식', /흡수식/],
  ['부하', /냉동부하|냉장부하|냉방부하|냉동냉장부하|침입열|침입공기|저장품/],
  ['배관', /배관|관경|관지름|오일트랩|이중입상관|역루프/],
  ['시험·충전', /기밀시험|내압시험|수압시험|진공건조|냉매충전/],
  ['냉각탑', /냉각탑|수질관리/],
  ['운전·점검', /펌프다운|제상|운전순서|유지보수|정기점검|냉동기.*(?:운전|정지|관리)/],
  ['안전', /안전|법규|법령|누설|가용전/],
];

export function coolingOrderConcept(item: QuestionItem): string | undefined {
  const stem = coolingStem(item);
  return concepts.find(([, pattern]) => pattern.test(stem))?.[0];
}

function tokens(item: QuestionItem): Set<string> {
  // Number masking is only for proximity; never discard numerical variants.
  const text = coolingStem(item).toLowerCase().replace(/&[a-z]+;/g, '')
    .replace(/\d+(?:[.,]\d+)*/g, '#').replace(/[^가-힣a-z#]/g, '');
  return new Set(Array.from({ length: Math.max(0, text.length - 1) }, (_, i) => text.slice(i, i + 2)));
}

function nearestOrder(items: QuestionItem[]): QuestionItem[] {
  if (items.length < 3) return items.slice();
  const pending = items.map(item => ({ item, tokens: tokens(item) }));
  const result: QuestionItem[] = [];
  let current = pending.shift()!;
  while (true) {
    result.push(current.item);
    if (!pending.length) break;
    let best = 0, bestScore = -1;
    for (let i = 0; i < pending.length; i++) {
      const other = pending[i].tokens;
      const overlap = [...current.tokens].filter(token => other.has(token)).length;
      const score = overlap / Math.max(1, current.tokens.size + other.size - overlap);
      if (score > bestScore) { best = i; bestScore = score; }
    }
    current = pending.splice(best, 1)[0];
  }
  return result;
}

/** Reorder a NEW non-random selection; preserve every object, ID and variant. */
export function orderCoolingSimilar(items: readonly QuestionItem[]): QuestionItem[] {
  const sections = new Map<string, Map<string, QuestionItem[]>>();
  items.forEach((item, index) => {
    const chapter = coolingTopic(item);
    const sectionKey = `${chapter}\0${coolingBookSection(item, chapter)}`;
    const section = sections.get(sectionKey) || new Map<string, QuestionItem[]>();
    sections.set(sectionKey, section);
    // Unknown stems stay independent, never grouped by a guessed answer.
    const key = coolingOrderConcept(item) || `unknown:${index}`;
    const group = section.get(key) || [];
    group.push(item);
    section.set(key, group);
  });
  return [...sections.values()].flatMap(section => [...section.values()].flatMap(nearestOrder));
}
