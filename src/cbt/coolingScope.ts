import type { QuestionItem } from './types';

// Textbook contents/coverage supplied by the user. Match the stem only;
// words appearing solely in answers/explanations must not widen the scope.
export function coolingStem(item: QuestionItem): string {
  return (item.question.text || item.question.html || item.question.ocrText || '')
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, '');
}

export function coolingSourceAllowed(item: QuestionItem): boolean {
  const year = Number(item.round.year);
  // Legacy rounds store a date (not an ordinal session). 2006 session 3
  // is the existing 2006-08-16 round; parsing "2006.03.05" as 2006 is wrong.
  const date = String(item.round.date || item.round.session).replace(/\D/g, '');
  const withinLowerBound = year > 2006 || (year === 2006 && date >= '20060816');
  return withinLowerBound && item.round.kind !== 'field-report-practice' && ((item.round.qualificationKey === 'hvac-hansol'
    && year >= 2017
    && (Number(item.round.year) < 2023 || (Number(item.round.year) === 2023 && parseInt(String(item.round.session), 10) <= 3)))
    || (item.round.qualificationKey === 'hvac' && Number(item.round.year) < 2017));
}

export function coolingSafetyKind(item: QuestionItem): 'management' | 'protection' | 'leak' | undefined {
  const text = coolingStem(item);
  if (/법규|법령|법률|법상|기계설비법|안전관리법|안전.*관리|안전을고려|액봉|산업안전|안전보건|유해위험|유해[·ㆍ・]?위험|방호조치|안전기준|검사주기|안전관리자|제조허가|제조신고|제조등록/.test(text)) return 'management';
  if (/안전장치|안전밸브|압축기의보호|가용전|장치보호.*스위치/.test(text)) return 'protection';
  // Detection of an external refrigerant leak is safety/inspection. Internal
  // compressor-valve leakage and its efficiency effect remain structure topics.
  if (/(?:할|헬)라이드|전자누설|누설(?:을)?(?:탐지|검사|감지|검지)|누설.*(?:리트머스|시험지|페놀프탈렌)|암모니아.*(?:누설|새고)|냉매.*누설.*장소/.test(text)) return 'leak';
  return undefined;
}

export function coolingSafety(item: QuestionItem): boolean {
  return coolingSafetyKind(item) !== undefined;
}

export function coolingSupplementChapter(item: QuestionItem): number | undefined {
  const text = coolingStem(item);
  // Reviewed ambiguous stems: air-side load/psychrometrics, heating controls
  // and exhaust heat recovery are outside this textbook chapter selection.
  const excluded = new Set(['hvac-20030831:12', 'hvac-20050306:20', 'hvac-20060305:17',
    'hvac-20060305:18', 'hvac-20120520:2', 'hvac-20130602:7']);
  if (excluded.has(item.id.replace(/^school-cooling::/, ''))) return undefined;
  if (/냉각탑/.test(text)) return 5;
  if (/냉매.*(?:배관|관재료|배관재료)|(?:배관|관).*냉매|냉동(?:장치|설비).*배관|압축기.*응축기.*배관|오일회수|오일트랩|역루프|(?:냉동기|흡수식).*주변배관/.test(text)) return 4;
  if (/냉장설비.*단열|냉동기.*(?:배관|강관)|냉각수.*펌프/.test(text)) return 4;
  if (/(?:히트펌프|열펌프).*유지관리/.test(text)) return 5;
  if (/흡수식.*(?:냉동기|냉온수)|빙축열|축냉식|히트펌프|열펌프/.test(text)) return 2;
  if (/압축기|증발기|응축기|냉동장치|냉동기.*종류|대용량냉동기/.test(text)) return 1;
  if (/냉매방식|팬코일|F\.?C\.?U|공조방식|공기조화방식|패키지|전수식|전공기식/.test(text)) return 5;
  if (/냉각수.*(?:순환|처리열량)|냉수.*순환펌프/.test(text)) return 5;
  return undefined;
}

export function coolingScopeCandidate(item: QuestionItem, normalizedSubject: string): boolean {
  return coolingSourceAllowed(item) && (normalizedSubject.replace(/\s/g, '') === '냉동냉장설비'
    || coolingSupplementChapter(item) !== undefined
    || (coolingSafety(item) && /냉동|냉장|냉매|기계설비|산업안전보건법/.test(coolingStem(item))));
}
