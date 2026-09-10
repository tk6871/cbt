import type { Question } from './types';

/** Describe recorded provenance; a source label is never a claim of factual verification. */
export function explanationSource(question: Question): { label: string; detail: string; url?: string } {
  const provenance = question.explanationProvenance || '';
  const explanation = question.explanationHtml || question.explanation || '';
  const source = question.source || '';
  if (!explanation.trim()) return { label: '해설 미등록', detail: '이 문제에는 상세 해설이 등록되어 있지 않습니다.' };
  if (question.explanationType === 'ai-reference') return { label: 'AI 보강 해설', detail: '학습용으로 작성한 설명입니다. 공식 해설·공식 채점 기준이 아닙니다.' };
  if (/authored|^manual|concise-answer-guide/.test(provenance)) return { label: '학습용 작성 해설', detail: '기존 문제를 바탕으로 작성·보강한 설명입니다. 공식 해설이 아닙니다.' };
  if (/cross-catalog:|^hvac-\d+:|^matched$/.test(provenance)) return { label: '기존 문항 연결 해설', detail: `연결 기록: ${provenance}${question.explanationMatchScore != null ? ` · 매칭값 ${question.explanationMatchScore}` : ''}. 문제 조건·보기 변경 여부를 함께 확인하세요.` };
  if (provenance === 'comcbt-exact-duplicate') return { label: 'COMCBT 동일 문항 해설', detail: '문제·보기·정답이 같은 다른 회차에서 가져온 해설입니다. COMCBT 이용자 해설이며 공식 해설이 아닙니다.' };
  const url = [question.problemUrl, question.source, question.sourcePage].find(value => /^https?:\/\//i.test(value || ''));
  if (/comcbt/.test(provenance) || (/comcbt/i.test(source) && /해설작성자/.test(explanation))) {
    return { label: /해설작성자/.test(explanation) ? 'COMCBT 이용자 해설' : 'COMCBT 시험 화면 자료', detail: '수집한 시험 화면의 해설·정답 안내입니다. 상세 해설이 없는 문항도 있습니다.', url };
  }
  return { label: '기존 해설 · 출처 확인 필요', detail: '문제 출처와 해설 작성 출처는 다를 수 있습니다. 확인되지 않은 출처를 임의로 지정하지 않았습니다.' };
}
