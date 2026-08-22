import type { QuestionItem } from './types';

type PredictionTheme = {
  subject: string;
  label: string;
  keywords: string[];
};

export const hvacPredictionThemes: PredictionTheme[] = [
  { subject: '공기조화설비', label: '방열기 표시·난방', keywords: ['방열기', '섹션', 'section', '난방'] },
  { subject: '공기조화설비', label: '송풍기 상사법칙', keywords: ['송풍기', '상사법칙', '풍량', '정압'] },
  { subject: '공기조화설비', label: '덕트·취출구', keywords: ['덕트', '아연도금', '취출구', '마찰손실'] },
  { subject: '공기조화설비', label: '클린룸·공기필터', keywords: ['클린룸', 'HEPA', '필터', 'DOP법', '활성탄'] },
  { subject: '공기조화설비', label: '습공기·공조과정', keywords: ['습공기', '상대습도', '절대습도', '노점', '현열'] },
  { subject: '공기조화설비', label: '열부하·열교환', keywords: ['냉방부하', '난방부하', '열관류', '열통과율', '외기부하'] },
  { subject: '공기조화설비', label: '환기·공조방식', keywords: ['환기', 'VAV', '팬코일', '전공기', '공조방식'] },
  { subject: '공기조화설비', label: '냉각탑·냉각수', keywords: ['냉각탑', '냉각수', '습구온도'] },

  { subject: '냉동냉장설비', label: '냉매 번호·특성', keywords: ['R-12', 'R-21', 'R-22', 'R-14', 'R-717', '냉매'] },
  { subject: '냉동냉장설비', label: '냉매와 냉동기유', keywords: ['냉동기유', '윤활유', '오일', '용해'] },
  { subject: '냉동냉장설비', label: '빙축열·브라인', keywords: ['빙축열', '제빙', '브라인', '축열'] },
  { subject: '냉동냉장설비', label: '팽창밸브·과열도', keywords: ['팽창밸브', '과열도', '리퀴드백', '교축'] },
  { subject: '냉동냉장설비', label: '냉동사이클·COP', keywords: ['냉동사이클', '성적계수', 'COP', '냉동효과'] },
  { subject: '냉동냉장설비', label: '압축기·응축기·증발기', keywords: ['압축기', '응축기', '증발기', '수액기'] },
  { subject: '냉동냉장설비', label: '이상기체·열역학', keywords: ['이상기체', '등압', '등적', '엔트로피', '엔탈피'] },
  { subject: '냉동냉장설비', label: '선도·냉동능력', keywords: ['몰리에르', 'P-i', '선도', '냉동능력', '냉동톤'] },

  { subject: '공조냉동설치운영', label: '펌프·캐비테이션', keywords: ['펌프', '캐비테이션', '공동현상', '흡입양정'] },
  { subject: '공조냉동설치운영', label: '배관·밸브', keywords: ['배관', '역지밸브', '체크밸브', '안전밸브', '감압밸브'] },
  { subject: '공조냉동설치운영', label: '배관 재료·이음', keywords: ['강관', '동관', '배관재료', '플랜지', '용접'] },
  { subject: '공조냉동설치운영', label: '자동제어·검출기', keywords: ['자동제어', '압력스위치', '온도조절기', '유량스위치', '시퀀스'] },
  { subject: '공조냉동설치운영', label: '전기·전동기', keywords: ['전동기', '3상', '역률', '전력', '회로'] },
  { subject: '공조냉동설치운영', label: '안전·법규', keywords: ['안전장치', '고압가스', '안전관리', '검사', '보호장치'] },
  { subject: '공조냉동설치운영', label: '보온·시공', keywords: ['보온', '단열', '시공', '기밀시험', '누설시험'] },
  { subject: '공조냉동설치운영', label: '설비 운전·고장', keywords: ['운전', '고장', '압력상승', '압력저하', '이상현상'] },
];

function readable(value = ''): string {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function itemText(item: QuestionItem): string {
  return readable([
    item.question.text,
    item.question.html,
    ...item.question.choices.map((choice) => choice.text || choice.html || ''),
  ].filter(Boolean).join(' '));
}

function fingerprint(item: QuestionItem): string {
  return readable(item.question.text || item.question.html)
    .replace(/^\d+[.)\s-]*/, '')
    .replace(/[\d\s.,:;!?()[\]{}①②③④⑤⑥⑦⑧⑨⑩·'"“”‘’<>/=+×÷%℃㎜㎡㎥]+/g, '')
    .toLocaleLowerCase('ko')
    .slice(0, 120) || item.id;
}

function themeHits(item: QuestionItem, themes: PredictionTheme[]): number {
  const text = itemText(item).toLocaleLowerCase('ko');
  return themes.reduce((count, theme) => count + (theme.keywords.some((keyword) =>
    text.includes(keyword.toLocaleLowerCase('ko'))) ? 1 : 0), 0);
}

function pickRandomTop(items: QuestionItem[], count: number): QuestionItem[] {
  const pool = [...items];
  const output: QuestionItem[] = [];
  while (pool.length && output.length < count) {
    const topWindow = Math.min(5, pool.length);
    const index = Math.floor(Math.random() * topWindow);
    output.push(pool.splice(index, 1)[0]);
  }
  return output;
}

export function buildHvacPredictionSet(items: QuestionItem[]): QuestionItem[] {
  const subjects = ['공기조화설비', '냉동냉장설비', '공조냉동설치운영'];
  const sourceItems = items.filter((item) => item.round.qualificationKey === 'hvac' || item.round.qualificationKey === 'hvac-hansol');
  const repeatCounts = new Map<string, number>();
  sourceItems.forEach((item) => {
    const key = fingerprint(item);
    repeatCounts.set(key, (repeatCounts.get(key) || 0) + 1);
  });

  return subjects.flatMap((subject) => {
    const themes = hvacPredictionThemes.filter((theme) => theme.subject === subject);
    const pinned = sourceItems.filter((item) => item.subject === subject && item.round.kind === 'field-report-practice');
    const usedIds = new Set(pinned.map((item) => item.id));
    const usedFingerprints = new Set(pinned.map(fingerprint));
    const candidates = sourceItems
      .filter((item) => item.subject === subject && item.round.kind !== 'field-report-practice')
      .map((item) => {
        const hits = themeHits(item, themes);
        const repeats = repeatCounts.get(fingerprint(item)) || 1;
        const recency = item.round.year >= 2021 ? 6 : item.round.year >= 2015 ? 3 : 0;
        const score = hits * 10 + Math.min(12, Math.max(0, repeats - 1) * 3) + recency;
        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || right.item.round.year - left.item.round.year);

    const selected = [...pinned];
    themes.forEach((theme) => {
      if (selected.length >= 20) return;
      const matching = candidates
        .filter(({ item }) => !usedIds.has(item.id) && !usedFingerprints.has(fingerprint(item)))
        .filter(({ item }) => {
          const text = itemText(item).toLocaleLowerCase('ko');
          return theme.keywords.some((keyword) => text.includes(keyword.toLocaleLowerCase('ko')));
        })
        .slice(0, 8)
        .map(({ item }) => item);
      const picked = pickRandomTop(matching, 1)[0];
      if (!picked) return;
      selected.push(picked);
      usedIds.add(picked.id);
      usedFingerprints.add(fingerprint(picked));
    });

    const fillPool = candidates
      .filter(({ item }) => !usedIds.has(item.id) && !usedFingerprints.has(fingerprint(item)))
      .slice(0, 100)
      .map(({ item }) => item);
    pickRandomTop(fillPool, 20 - selected.length).forEach((item) => {
      selected.push(item);
      usedIds.add(item.id);
      usedFingerprints.add(fingerprint(item));
    });

    return selected.slice(0, 20).sort(() => Math.random() - .5);
  });
}
