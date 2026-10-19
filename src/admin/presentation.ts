export function adminViewLabel(value: string | null): string {
  const key = (value || '').replace(/^next-/, '');
  const labels: Record<string, string> = {
    home: '학습 홈', rounds: '회차별 문제', learning: '학습모드', learn: '학습모드',
    exam: 'CBT 시험', wrong: '오답노트', search: '문제 검색', stats: '학습 분석',
    updates: '패치노트', school: '학교 시험 준비', history: '학습 내역',
    calculation: '계산문제', guide: '시험 자료실', coach: '합격 엔진',
    beta: '베타 학습 도구', settings: '전체 설정', showcase: '신기술 체험관',
  };
  return labels[key] || value || '-';
}

// admin.html lives beside assets/, not inside an admin/ directory.
export function issueImageUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const path = value.replace(/^\.\//, '');
  if (!path.startsWith('assets/') || path.split('/').includes('..') || /[\\?#]/.test(path)) return undefined;
  return `./${path}`;
}

export function issueTypeLabel(value: string): string {
  return ({ 'missing-image': '그림 없음', 'wrong-image': '그림 오류·잘림',
    'answer-hotspot': '답안 클릭 영역', answer: '정답 오류', explanation: '해설 오류·부족',
    'text-ocr': '글자·수식 오류', layout: '화면 배치', other: '기타',
  } as Record<string, string>)[value] || value;
}

export function issueStatusLabel(value: string): string {
  return ({ open: '대기', reviewing: '확인 중', resolved: '수정 완료', deferred: '보류' } as Record<string, string>)[value] || value;
}

export function seoulDayStart(now: number): number {
  const offset = 9 * 60 * 60 * 1000;
  return Math.floor((now + offset) / 86_400_000) * 86_400_000 - offset;
}

export function resultModeLabel(mode: string | null): string {
  return mode === 'exam' ? 'CBT' : mode === 'learn' ? '학습' : mode || '미확인';
}

export function resultResponseLabel(unanswered: number): string {
  // Unanswered questions do not prove that the user left without submitting.
  return unanswered > 0 ? `미응답 ${unanswered}문제 포함` : '전체 응답';
}

export function paginate<T>(rows: T[], requested: number, size = 50) {
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(pageCount, Math.max(1, Math.floor(requested) || 1));
  return { page, pageCount, rows: rows.slice((page - 1) * size, page * size) };
}
