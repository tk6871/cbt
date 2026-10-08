import { mappedSubject, subjectFor } from './catalog';
import type { QuestionItem } from './types';
import { coolingSafety, coolingScopeCandidate, coolingSupplementChapter } from './coolingScope';
import { coolingContextPlacement, coolingReviewedPlacement, coolingSectionContext } from './coolingBookPlacement';

export const coolingMidtermTitle = '냉동공학 중간고사';
export const coolingRecordPrefix = 'school-cooling::';
export const coolingRecordId = (id: string) => id.startsWith(coolingRecordPrefix) ? id : `${coolingRecordPrefix}${id}`;
export const isCoolingRecord = (id: string) => id.startsWith(coolingRecordPrefix);
export const coolingOriginalId = (id: string) => isCoolingRecord(id) ? id.slice(coolingRecordPrefix.length) : id;
export function coolingRecordItem(item: QuestionItem): QuestionItem {
  return { ...item, id: coolingRecordId(item.id), subject: '냉동냉장설비' };
}

// User's textbook contents and coverage table; chapter 6 uses their confirmed name.
export const coolingBookChapters = [
  { title: '냉동이론', summary: '냉매·브라인 / 냉동사이클 / 열역학', sections: ['냉동의 기초와 원리', '냉매와 브라인', '냉매선도와 냉동 사이클', '각종 냉동 사이클', '기초열역학', '열역학의 법칙'] },
  { title: '냉동장치의 구조', summary: '압축기·응축기·증발기 / 밸브·부속·제어기기', sections: ['압축기 구성 기기와 특징', '응축기 구성 기기와 특징', '증발기 구성 기기와 특징', '냉동장치 구성 기기(팽창밸브)', '냉동장치 구성 기기(부속기기)', '냉동장치 구성 기기(제어기기)'] },
  { title: '냉동장치의 응용', summary: '제빙·동결 / 열펌프·축열 / 흡수식 · 안전관리는 별도', sections: ['냉동장치의 응용(제빙 및 동결장치)', '냉동장치의 응용(열펌프 및 축열장치)', '냉동장치의 응용(흡수식 냉동장치)'] },
  { title: '냉동냉장 부하계산', summary: '냉동·냉장 부하 / 침입열·저장품 열량', sections: ['냉동냉장부하 계산'] },
  { title: '냉동설비의 설치', summary: '냉동·냉각설비 / 배관·시험·냉매 충전', sections: ['냉동설비의 설치'] },
  { title: '냉방설비운영', summary: '냉방설비 설치 / 냉동기 유지보수 / 냉각탑', sections: ['냉방설비의 설치', '냉동기 관리·유지보수', '냉동기부속장치 점검·유지보수', '냉각탑 점검·종류·특성·수질관리'] },
] as const;
export const coolingTopics = coolingBookChapters.map(chapter => chapter.title);
const topicTerms: Array<RegExp> = [
  /냉동사이클|성적계수|엔탈피|엔트로피|열역학|카르노|절대압|진공압|비열|냉매.*(?:특성|특징|성질|종류|조건|분류)|냉매선도|공비|비공비|천연냉매|자연냉매|신냉매|냉매번호|R-?\d{2,3}[a-z]?|브라인|냉동유|냉동기유|몰리에르|증기압|임계온도|압축비|과열도|과냉각|포화(?:온도|압력)|이상기체|등온|단열과정|등압|등적|내부에너지|열당량|잠열|현열|냉동톤|냉동능력|열전달/gi,
  /압축기|응축기|증발기|팽창밸브|수액기|유분리기|액분리기|압축방식|왕복동|스크루|스크롤|모세관|역지밸브|전자밸브|솔레노이드|건조기|드라이어|커넥팅로드|크랭크|피스톤|디퓨(?:저|져)|임펠러|축봉|감온통|자동제어|압력스위치|온도조절기|냉동장치의구성/g,
  /안전밸브|안전관리|안전기준|관련법규|고압가스|중독|동상|제빙|빙축열|축열장치|급속동결|동결장치|냉동창고|냉장창고|콜드체인|식품|방폭|보호구|흡수식|흡착식|열전냉동|펠티어|히트펌프|열펌프/g,
  /냉동부하|냉장부하|냉방부하|냉동냉장부하|부하계산|전열면적|열관류|열통과|침입열|침입공기|저장품|단열두께|환기량|냉각열량/g,
  /배관|관경|관지름|배관길이|이중입상관|오일트랩|기밀시험|내압시험|진공건조|진공펌프|냉매충전|냉매 충전|설치장소|방진|지지대|납땜|용접|수압시험|플레어/g,
  /냉방설비|냉방방식|냉각탑|냉각수|냉수|공조기|팬코일|냉수펌프|수온|수질관리|유지보수|정기점검|냉동기.*(?:운전|정지|관리)|펌프다운|제상|운전순서|고압차단|저압차단/g,
];
export function coolingTopic(item: QuestionItem): string {
  const manual = coolingReviewedPlacement(item);
  if (manual) return coolingTopics[manual.placement[0]];
  const originalSubject = mappedSubject(item.round.qualificationKey || '', subjectFor(item.round, item.question));
  if (originalSubject.replace(/\s/g, '') !== '냉동냉장설비') {
    const chapter = coolingSupplementChapter(item);
    if (chapter !== undefined) return coolingTopics[chapter];
  }
  const q = item.question;
  const plain = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, '');
  const text = plain([...new Set([q.text || q.html, q.ocrText].filter(Boolean))].join(' '));
  const choices = plain(q.choices.map(choice => choice.text || choice.html || '').join(' '));
  const explanation = plain(q.explanation || q.explanationHtml || '');
  // Explicit task context takes precedence over component/refrigerant words within it.
  if (/(?:냉동|냉장|냉동냉장)부하|침입열|저장품.*열량/.test(text)) return coolingTopics[3];
  if (/기밀시험|내압시험|진공건조|냉매충전|오일트랩|이중입상관/.test(text)) return coolingTopics[4];
  if (/냉각탑|수질관리|유지보수|냉방설비.*설치/.test(text)) return coolingTopics[5];
  if (/열펌프|히트펌프|빙축열|흡수식|제빙|동결장치/.test(text)) return coolingTopics[2];
  const scores = topicTerms.map(pattern => (text.match(pattern)?.length || 0) * 4
    + Math.min(2, choices.match(pattern)?.length || 0) + Math.min(1, explanation.match(pattern)?.length || 0));
  const best = Math.max(...scores);
  const ranked = scores.map((score, index) => ({ score, index })).sort((a, b) => b.score - a.score);
  if (best >= 4 && ranked[0].score > ranked[1].score) return coolingTopics[ranked[0].index];
  const context = coolingContextPlacement(item);
  return context ? coolingTopics[context.placement[0]] : '분류 미확인';
}

const sectionTerms: RegExp[][] = [
  [/단위|열당량|냉동톤|절대압|진공압|열전달|잠열|현열|비열/, /냉매|브라인|냉동유|냉동기유/, /몰리에르|냉매선도|상변화|압력엔탈피|p-h|ph선도/i, /냉동사이클|카르노|다단압축|다원|성적계수|과열도|과냉각/, /이상기체|기체상태|등온|단열과정|등압|등적/, /열역학.*법칙|제[0123]법칙|내부에너지|엔트로피|에너지보존/],
  [/압축기|피스톤|커넥팅로드|크랭크|스크롤|스크루|축봉|디퓨(?:저|져)|임펠러/, /응축기/, /증발기/, /팽창밸브|모세관|감온통/, /수액기|유분리기|액분리기|역지밸브|전자밸브|솔레노이드|건조기|드라이어/, /제어기기|자동제어|압력스위치|온도조절기/],
  [/제빙|동결|식품|냉동창고|냉장창고|콜드체인/, /열펌프|히트펌프|축열/, /흡수식/],
  [/부하|침입열|침입공기|저장품|열관류|전열면적|환기량|단열두께/],
  [/배관|관경|관지름|냉매충전|기밀시험|내압시험|진공건조|오일트랩|이중입상관|설치|방진|지지대|용접|납땜/],
  [/냉방설비|냉방방식|공조기|팬코일/, /냉동기.*(?:관리|운전|정지)|펌프다운|제상|운전순서|유지보수/, /부속장치|정기점검|고압차단|저압차단|냉수펌프/, /냉각탑|냉각수|수질|수온/],
];

export function coolingBookSection(item: QuestionItem, chapter: string): string {
  const index = coolingTopics.indexOf(chapter as typeof coolingTopics[number]);
  if (index < 0) return '세부 분류 미확인';
  const manual = coolingReviewedPlacement(item);
  if (manual?.placement[0] === index) return coolingBookChapters[index].sections[manual.placement[1]];
  const text = (item.question.text || item.question.html || item.question.ocrText || '').replace(/<[^>]*>/g, '').replace(/\s+/g, '');
  if (index === 0 && /몰리에르|냉매선도|압력엔탈피|p-h|ph선도/i.test(text)) return coolingBookChapters[0].sections[2];
  if (index === 0 && /열역학.*법칙|제[0123]법칙/.test(text)) return coolingBookChapters[0].sections[5];
  if (index === 5 && /냉각탑|수질관리/.test(text)) return coolingBookChapters[5].sections[3];
  const matches = sectionTerms[index].map((pattern, section) => ({ section, matched: pattern.test(text) })).filter(row => row.matched);
  if (matches.length === 1) return coolingBookChapters[index].sections[matches[0].section];
  const section = coolingSectionContext(item, index);
  return section !== undefined ? coolingBookChapters[index].sections[section] : '세부 분류 미확인';
}

export function coolingSectionGroups(group: { label: string; items: QuestionItem[]; aliases: QuestionItem[] }): Array<{ label: string; items: QuestionItem[]; aliases: QuestionItem[] }> {
  const chapter = coolingBookChapters.find(chapter => chapter.title === group.label);
  if (!chapter) return [];
  const labels = new Map(group.items.map(item => [schoolItemKey(item), coolingBookSection(item, group.label)]));
  return [...chapter.sections, '세부 분류 미확인'].map(label => ({ label,
    items: group.items.filter(item => labels.get(schoolItemKey(item)) === label),
    aliases: group.aliases.filter(item => labels.get(schoolItemKey(item)) === label),
  }));
}

export function normalizedSchoolSubject(item: QuestionItem): string {
  return mappedSubject(item.round.qualificationKey || '', item.subject);
}

// Historical mixed-source sessions still resolve their original school record IDs.
// This pool is only for record lookup, not for new midterm question selection.
export function coolingRecordSourceItems(items: QuestionItem[]): QuestionItem[] {
  return items.filter(item => ['hvac', 'hvac-hansol'].includes(item.round.qualificationKey || '')
    && normalizedSchoolSubject(item).replace(/\s/g, '') === '냉동냉장설비'
    && item.round.kind !== 'field-report-practice').map(item => ({ ...item, subject: '냉동냉장설비' }));
}

export function coolingMidtermItems(items: QuestionItem[]): QuestionItem[] {
  return items.filter(item => coolingScopeCandidate(item, normalizedSchoolSubject(item)) && !coolingSafety(item));
}

export function coolingSafetyItems(items: QuestionItem[]): QuestionItem[] {
  return items.filter(item => coolingScopeCandidate(item, normalizedSchoolSubject(item)) && coolingSafety(item));
}

// Keep numerical conditions, choice order, images and answers in the key.
// Similar wording alone is not enough to merge two exam questions.
export function schoolItemKey(item: QuestionItem): string {
    const q = item.question;
    const text = (q.text || q.html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length < 8 ? coolingOriginalId(item.id) : JSON.stringify([
      text, q.choices, q.answer, q.images || [], q.sourceImage || '',
    ]);
}

export function uniqueSchoolItems(items: QuestionItem[]): QuestionItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = schoolItemKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type CoolingDrawState = { ids: string[]; resetAt: number; savedAt: number };
export function coolingTopicGroups(items: QuestionItem[]): Array<{ label: string; items: QuestionItem[]; aliases: QuestionItem[] }> {
  const unique = uniqueSchoolItems(items);
  const labelsByKey = new Map(unique.map(item => [schoolItemKey(item), coolingTopic(item)]));
  // Assign duplicate aliases to the same topic while retaining their saved record IDs.
  return [...coolingTopics, '분류 미확인'].map(label => ({
    label,
    items: unique.filter(item => labelsByKey.get(schoolItemKey(item)) === label),
    aliases: items.filter(item => labelsByKey.get(schoolItemKey(item)) === label),
  }));
}

export function coolingUnusedItems(items: QuestionItem[], all: QuestionItem[], drawn: CoolingDrawState,
  attempts: Record<string, { at: number }>): QuestionItem[] {
  const usedIds = new Set(drawn.ids);
  const usedKeys = new Set(all.filter(item => usedIds.has(item.id)
    || (attempts[item.id] && attempts[item.id].at > drawn.resetAt)).map(schoolItemKey));
  // Keep unused aliases here so narrowing to an older year or a source does not
  // accidentally hide that source's representative. Deduplicate the chosen pool.
  return items.filter(item => !usedKeys.has(schoolItemKey(item)));
}
