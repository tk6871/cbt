export type QualificationScoring = 'subject-average' | 'total-only';

export type QualificationRule = {
  scoring: QualificationScoring;
  passScore: number;
  subjectMinimum?: number;
  questionsPerSubject?: number;
  totalQuestions?: number;
  examMinutes: number;
  officialName: string;
  officialSource: string;
  note: string;
};

const industrialRule = (officialName: string, officialSource: string): QualificationRule => ({
  scoring: 'subject-average',
  passScore: 60,
  subjectMinimum: 40,
  questionsPerSubject: 20,
  examMinutes: 90,
  officialName,
  officialSource,
  note: '과목당 100점 환산 40점 이상, 전 과목 평균 60점 이상',
});

const engineerRule = (officialName: string, officialSource: string): QualificationRule => ({
  scoring: 'subject-average',
  passScore: 60,
  subjectMinimum: 40,
  questionsPerSubject: 20,
  examMinutes: 150,
  officialName,
  officialSource,
  note: '과목당 100점 환산 40점 이상, 전 과목 평균 60점 이상',
});

const totalRule = (officialName: string, officialSource: string): QualificationRule => ({
  scoring: 'total-only',
  passScore: 60,
  totalQuestions: 60,
  examMinutes: 60,
  officialName,
  officialSource,
  note: '100점 만점으로 환산하여 60점 이상(과목별 과락 없음)',
});

export const qualificationRules: Record<string, QualificationRule> = {
  hvac: industrialRule('공조냉동기계산업기사', 'https://www.q-net.or.kr/crf005.do?id=crf00503&jmCd=2590'),
  'hvac-hansol': industrialRule('공조냉동기계산업기사', 'https://www.q-net.or.kr/crf005.do?id=crf00503&jmCd=2590'),
  safety: industrialRule('산업안전산업기사', 'https://www.q-net.or.kr/crf005.do?id=crf00503s02&jmCd=2381&jmInfoDivCcd=B0'),
  energy: industrialRule('에너지관리산업기사', 'https://www.q-net.or.kr/crf005.do?id=crf00503s02&jmCd=2960&jmInfoDivCcd=B0'),
  maintenance: industrialRule('설비보전산업기사', 'https://www.q-net.or.kr/crf005.do?id=crf00503s02&jmCd=2035&jmInfoDivCcd=B0'),
  'electric-craftsman': totalRule('전기기능사', 'https://www.q-net.or.kr/crf005.do?gId=&gSite=Q&id=crf00503s02&jmCd=7780&jmInfoDivCcd=B0'),
  'gas-craftsman': totalRule('가스기능사', 'https://www.q-net.or.kr/crf005.do?gId=&gSite=Q&id=crf00503s02&jmCd=6335&jmInfoDivCcd=B0'),
  'hazardous-craftsman': totalRule('위험물기능사', 'https://www.q-net.or.kr/crf005.do?gId=&gSite=Q&id=crf00503s02&jmCd=6697&jmInfoDivCcd=B0'),
  'information-engineer': engineerRule('정보처리기사', 'https://www.q-net.or.kr/crf005.do?id=crf00503s02&jmCd=1320&jmInfoDivCcd=B0'),
  'gem-appraiser-target': industrialRule('보석감정산업기사', 'https://www.q-net.or.kr/cst006.do?artlSeq=5213416&brdId=Q006&code=1202&gId=&gSite=Q&id=cst00602'),
  'gem-appraiser': totalRule('보석감정사', 'https://www.q-net.or.kr/crf005.do?id=crf00503s02&jmCd=7980&jmInfoDivCcd=B0'),
  'precious-industrial': industrialRule('귀금속가공산업기사', 'https://www.q-net.or.kr/crf005.do?id=crf00503&jmCd=2760'),
  'precious-craftsman': totalRule('귀금속가공기능사', 'https://www.q-net.or.kr/crf005.do?id=crf00503s02&jmCd=7460&jmInfoDivCcd=B0'),
  'precious-master': totalRule('귀금속가공기능장', 'https://www.q-net.or.kr/crf005.do?id=crf00503s02&jmCd=3770&jmInfoDivCcd=B0'),
};

export function qualificationRuleFor(key: string): QualificationRule | null {
  return qualificationRules[key] || null;
}
