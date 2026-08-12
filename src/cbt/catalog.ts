import type { Catalog, CurriculumScope, Question, QuestionItem, Round } from './types';
import { hvacAnswerHotspots } from './generatedHvacHotspots';
import { hvacAnswerSegments } from './generatedHvacAnswerSegments';
import { reviewedHvacHotspots } from './reviewedHvacHotspots';

const primaryKeys = ['hvac', 'safety', 'energy', 'maintenance'];

export const GEM_APPRAISER_TARGET_KEY = 'gem-appraiser-target';
export const gemAppraiserTargetSubjects = ['보석 특성', '보석 감별', '다이아몬드 감정', '보석 가공'];

const legacyGemSubjectMap: Record<string, string> = {
  보석학일반: '보석 특성',
  보석감별법: '보석 감별',
  다이아몬드감정법: '다이아몬드 감정',
  보석가공기법: '보석 가공',
};

function prepareCatalog(source: Catalog): Catalog {
  const rounds = (source.rounds || []).map((round) => ({
    ...round,
    qualificationKey: source.key,
    qualification: round.qualification || source.name,
    shortQualification: round.shortQualification || source.shortName || source.name,
    questions: source.key === 'hvac'
      ? round.questions.map((question) => {
          const sourceImage = question.sourceImage || '';
          const hotspots = sourceImage
            ? reviewedHvacHotspots[sourceImage] || hvacAnswerHotspots[sourceImage] || question.answerHotspots
            : question.answerHotspots;
          const segments = sourceImage ? hvacAnswerSegments[sourceImage] : undefined;
          return {
            ...question,
            answerHotspots: hotspots?.map((hotspot) => ({
              ...hotspot,
              segments: segments?.[hotspot.choice],
            })),
          };
        })
      : round.questions,
  }));
  return { ...source, rounds };
}

export function loadCatalogs(): Catalog[] {
  if (window.CBT_APP_SPACE === 'jewelry') {
    const sourceCatalogs = (window.CBT_DATA_JEWELRY || []).map(prepareCatalog);
    return [createGemAppraiserTargetCatalog(sourceCatalogs), ...sourceCatalogs];
  }
  const sources = [
    window.CBT_DATA_HVAC,
    window.CBT_DATA_SAFETY,
    window.CBT_DATA_ENERGY,
    window.CBT_DATA_MAINTENANCE,
  ].filter((item): item is Catalog => Boolean(item));

  return sources
    .filter((item) => primaryKeys.includes(item.key))
    .map(prepareCatalog);
}

function targetSubjectFor(sourceCatalog: Catalog, question: Question): string {
  if (sourceCatalog.key === 'gem-appraiser') {
    return legacyGemSubjectMap[question.sourceSubject || ''] || question.targetSubject || '보석 특성';
  }
  return question.targetSubject || '보석 특성';
}

function createGemAppraiserTargetCatalog(sourceCatalogs: Catalog[]): Catalog {
  const rounds: Round[] = sourceCatalogs.flatMap((sourceCatalog) => sourceCatalog.rounds.flatMap((sourceRound) => {
    const targetMapping: NonNullable<Question['targetMapping']> = sourceCatalog.key === 'gem-appraiser'
      ? 'legacy-subject'
      : 'related-concept';
    const questions = sourceRound.questions
      .filter((question) => question.targetRelevance !== 'peripheral')
      .map((question) => ({
        ...question,
        _originRoundId: question._originRoundId || sourceRound.id,
        _originalNumber: question._originalNumber || question.number,
        _subject: targetSubjectFor(sourceCatalog, question),
        targetSubject: targetSubjectFor(sourceCatalog, question),
        targetMapping,
        sourceQualification: sourceRound.shortQualification || sourceRound.qualification || sourceCatalog.shortName || sourceCatalog.name,
      }));
    if (!questions.length) return [];
    return [{
      ...sourceRound,
      id: `${GEM_APPRAISER_TARGET_KEY}-${sourceRound.id}`,
      qualificationKey: GEM_APPRAISER_TARGET_KEY,
      qualification: '보석감정산업기사 모의시험',
      shortQualification: '보석감정산업기사',
      subjects: gemAppraiserTargetSubjects,
      questions,
      sourceQualification: sourceRound.shortQualification || sourceRound.qualification || sourceCatalog.shortName || sourceCatalog.name,
    }];
  }));

  return {
    key: GEM_APPRAISER_TARGET_KEY,
    name: '보석감정산업기사 모의시험',
    shortName: '보석감정산업기사',
    isVirtual: true,
    rounds,
  };
}

export function loadReferenceRounds(): Round[] {
  const source = window.CBT_DATA_ENERGY_ENGINEER;
  if (!source?.rounds?.length) return [];
  return source.rounds.map((round) => ({
    ...round,
    qualificationKey: 'energy',
    qualification: round.qualification || source.name,
    shortQualification: '기사 추가자료',
  }));
}

export function questionId(round: Round, question: Question): string {
  return `${question._originRoundId || round.id}:${question._originalNumber || question.number}`;
}

export function subjectFor(round: Round, question: Question): string {
  if (question._subject) return question._subject;
  if (question.sourceSubject) return question.sourceSubject;
  const subjects = round.subjects?.length ? round.subjects : ['기타'];
  const size = Math.ceil(round.questions.length / subjects.length);
  return subjects[Math.min(subjects.length - 1, Math.floor((question.number - 1) / size))] || '기타';
}

export function mappedSubject(key: string, subject: string): string {
  if (key !== 'hvac') return subject;
  if (subject === '공기조화') return '공기조화설비';
  if (subject === '냉동공학') return '냉동냉장설비';
  if (subject === '배관일반' || subject === '전기제어공학') return '공조냉동설치운영';
  return subject;
}

export function sortedRounds(catalog: Catalog): Round[] {
  return [...catalog.rounds].sort((a, b) => {
    const left = String(a.sortKey || a.date || `${a.year}${a.session || ''}`);
    const right = String(b.sortKey || b.date || `${b.year}${b.session || ''}`);
    return right.localeCompare(left, 'ko', { numeric: true });
  });
}

export function latestSubjects(catalog: Catalog): string[] {
  return sortedRounds(catalog)[0]?.subjects || [];
}

export function yearsFor(catalog: Catalog): number[] {
  return [...new Set(catalog.rounds.map((round) => Number(round.year)).filter(Number.isFinite))]
    .sort((a, b) => b - a);
}

export function roundsInRange(catalog: Catalog, from: number, to: number): Round[] {
  return sortedRounds(catalog).filter((round) => Number(round.year) >= from && Number(round.year) <= to);
}

export function questionItems(
  catalog: Catalog,
  from: number,
  to: number,
  scope: CurriculumScope,
): QuestionItem[] {
  const currentSubjects = latestSubjects(catalog);
  let rounds = roundsInRange(catalog, from, to);
  let subjectMap = (subject: string) => subject;

  if (scope === 'current') {
    rounds = rounds.filter((round) =>
      round.subjects.length === currentSubjects.length
      && round.subjects.every((subject, index) => subject === currentSubjects[index]));
  } else if (scope === 'legacy-original' && catalog.key === 'hvac') {
    rounds = rounds.filter((round) => round.subjects.length === 4);
  } else if (scope === 'all-mapped') {
    subjectMap = (subject) => mappedSubject(catalog.key, subject);
  }

  return rounds.flatMap((round) => round.questions.map((question) => ({
    round,
    question,
    subject: subjectMap(subjectFor(round, question)),
    id: questionId(round, question),
  })));
}

export function subjectsForScope(catalog: Catalog, scope: CurriculumScope): string[] {
  if (scope === 'legacy-original' && catalog.key === 'hvac') {
    return catalog.rounds.find((round) => round.subjects.length === 4)?.subjects || [];
  }
  return latestSubjects(catalog);
}

export function isImagePrimary(item: QuestionItem): boolean {
  return Boolean(item.question.sourceImage && item.round.qualificationKey === 'hvac' && Number(item.round.year) >= 2021);
}

export function shuffle<T>(items: T[]): T[] {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}
