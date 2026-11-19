import {useState, type ReactNode} from 'react';
import type {StudyMode} from '../cbt/types';

export type FinalSubject = 'cooling' | 'energy';
export function FinalExams({start, archive, children}: {
  start: (subject: FinalSubject, mode: StudyMode) => Promise<void>;
  archive: (subject: FinalSubject) => void;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState<FinalSubject | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  async function study(subject: FinalSubject, mode: StudyMode) {
    if (busy) return;
    setBusy(subject);
    try { await start(subject, mode); } finally { setBusy(null); }
  }
  return <section aria-label="기말고사" className="finals-hub">
    <h1>기말고사</h1>
    <div className="round-grid">{(['cooling','energy'] as const).map(subject =>
      <article key={subject} className="round-card"><h2>{subject === 'cooling' ? '냉동공학' : '에너지설비'}</h2>
        <p>{subject === 'cooling' ? '예정 범위 · 한솔 냉동냉장설비 기출 중 2024년 1회까지' : '예정 범위 · 에너지 교재 전체 수록 문제'}</p>
        <footer>{(['learn','exam'] as const).map(mode =>
          <button type="button" className="round-mode-button" key={mode} disabled={!!busy}
            onClick={()=>void study(subject, mode)}>{mode === 'learn' ? '학습모드' : 'CBT 시험모드'}</button>)}</footer>
        {busy===subject && <small role="status">문제를 준비하고 있습니다…</small>}
      </article>)}</div>
    <details onToggle={e=>setShowArchive(e.currentTarget.open)}><summary>내 학교 시험 자료 · 이전 시험</summary>
      {showArchive && <><button type="button" onClick={()=>archive('cooling')}>냉동공학 중간고사 자료</button>
        <button type="button" onClick={()=>archive('energy')}>에너지설비 중간고사 자료</button>{children}</>}
    </details>
  </section>;
}
