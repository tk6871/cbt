import {useState, type ReactNode} from 'react';
import type {StudyMode} from '../cbt/types';

import {finalNames,type FinalSubject} from '../cbt/finalCourseBank';
import {sampleSize,type FinalOptions} from '../cbt/finalSelection';
import {CoolingFinalWritten} from './CoolingFinalWritten';
const descriptions={cooling:'부록 4-7~5-108쪽 · 각 회 냉동냉장설비 21~40번',sports:'수업 요약본 7개 단원 · 운동·체력·리더십·윤리',metal:'예상 연습: 철–탄소 상태도 5 · 항온변태곡선 3 · 뜨임·불림 등 열처리 2',energy:'교재 321~644쪽 · 2018~2025년 수록 21회 · 1,680문제'};
const pdfs={sports:['sports-leadership-final','시험범위 PDF 열기'],metal:['metal-curves-final','곡선 입문 PDF 열기']} as const;
export function FinalExams({start, archive, children}: {
  start: (subject: FinalSubject, mode: StudyMode,options:FinalOptions) => Promise<void>;
  archive: (subject: 'cooling'|'energy') => void;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState<FinalSubject | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [settings,setSettings]=useState<Partial<Record<FinalSubject,FinalOptions>>>({});
  const get=(s:FinalSubject)=>settings[s]??{expected:false,exclude:false};
  const change=(s:FinalSubject,opts:Partial<FinalOptions>)=>setSettings(prev=>({...prev,[s]:{...get(s),...opts}}));
  async function study(subject: FinalSubject, mode: StudyMode) {
    if (busy) return;
    setBusy(subject);
    try { await start(subject, mode,get(subject)); } finally { setBusy(null); }
  }
  return <section aria-label="기말고사" className="finals-hub">
    <h1>기말고사</h1>
    <p>예상 랜덤은 수업 범위에서 선별한 후보로 구성한 연습입니다. 실제 출제 문제를 뜻하지 않습니다.</p>
    <div className="round-grid">{(['cooling','metal','sports','energy'] as const).map(subject =>
      <article key={subject} className="round-card final-course"><h2>{finalNames[subject]}</h2>
        <p>{descriptions[subject]}</p>
        <label>문제 범위 <select value={get(subject).expected?'pick':'all'} onChange={e=>change(subject,{expected:e.target.value==='pick',exclude:e.target.value==='pick'})}>
          <option value="all">전체 문제</option><option value="pick">예상 랜덤 · {sampleSize}문제</option></select></label>
        <label><input type="checkbox" checked={get(subject).exclude} onChange={e=>change(subject,{exclude:e.target.checked})}/> 중복·비슷한 문제 제외</label>
        {(subject==='metal'||subject==='sports')&&<a href={'output/pdf/'+pdfs[subject][0]+'.pdf'} target="_blank" rel="noopener">{pdfs[subject][1]} ↗</a>}
        {subject==='cooling'&&<details><summary>주관식 연습 · 5점짜리 2문제</summary><CoolingFinalWritten/></details>}
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
