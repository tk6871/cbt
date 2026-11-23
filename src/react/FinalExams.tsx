import {useEffect,useMemo,useState, type ReactNode} from 'react';
import type {QuestionItem,StudyMode} from '../cbt/types';

import {finalNames,type FinalSubject} from '../cbt/finalCourseBank';
import {sampleSize,finalRanges,selectFinalItems,drawnIds,storeDraw,type FinalOptions} from '../cbt/finalSelection';
const descriptions={cooling:'부록 4-7~5-108쪽 · 각 회 냉동냉장설비 21~40번',sports:'수업 요약본 7개 단원 · 운동·체력·리더십·윤리',metal:'철–탄소 상태도 · 항온변태곡선 · 열처리 중심',energy:'교재 321~644쪽 · 2018~2025년 수록 21회 · 1,680문제'};
const pdfs={sports:['sports-leadership-final','시험범위 PDF 열기'],metal:['metal-curves-final','곡선 입문 PDF 열기']} as const;
type Props={
  start: (subject: FinalSubject, mode: StudyMode,options:FinalOptions) => Promise<void>;
  pool:(s:FinalSubject)=>Promise<QuestionItem[]>;
  choice:(i:QuestionItem)=>number;
  written:()=>void;
  archive: (subject: 'cooling'|'energy') => void;
  children: ReactNode;
};
type Scope='all'|'range'|'pick';
function Course({subject,start,pool,choice,written,locked,lock}:Pick<Props,'start'|'pool'|'choice'|'written'>&{subject:FinalSubject,locked:boolean,lock:(v:boolean)=>void}){
  const storage='final-range-v1:'+subject;
  const [scope,setScope]=useState<Scope>(()=>sessionStorage.getItem(storage+':mode')==='range'?'range':'all');
  const [index,setIndex]=useState(()=>Number(sessionStorage.getItem(storage))||0);
  const [count,setCount]=useState(String(sampleSize)),[exclude,setExclude]=useState(false);
  const [skipDrawn,setSkipDrawn]=useState(false),[drawRevision,setDrawRevision]=useState(0);
  const [items,setItems]=useState<QuestionItem[]|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
  useEffect(()=>{if(scope==='all'||items)return;let live=true;
    setError(false);pool(subject).then(rows=>{if(live)setItems(rows);},()=>{if(live)setError(true);});
    return ()=>{live=false;};
  },[scope,pool,subject,items,retry]);
  const ranges=useMemo(()=>items?finalRanges(items):[],[items]);
  const max=useMemo(()=>{
    if(scope!=='pick'||!items)return 0;
    const seen=skipDrawn?drawnIds(subject):new Set<string>();
    return selectFinalItems(items.filter(i=>!seen.has(i.id)),subject,{expected:true,exclude,count:items.length}).length;
  },[scope,items,subject,exclude,skipDrawn,drawRevision]);
  const n=Math.min(Number(count),max);
  const disabled=locked||(scope==='pick'&&(!Number.isInteger(n)||n<1))||(scope==='range'&&!ranges[index]);
  async function go(mode:StudyMode){if(disabled)return;lock(true);try{
    await start(subject,mode,{expected:scope==='pick',exclude,count:n,skipDrawn,range:scope==='range'?index:undefined});
  }finally{setDrawRevision(r=>r+1);lock(false);}}
  return <article className="round-card final-course"><h2>{finalNames[subject]}</h2><p>{descriptions[subject]}</p>
    <label>문제 범위 <select value={scope} onChange={e=>{const s=e.target.value as Scope;setScope(s);setExclude(s==='pick');sessionStorage.setItem(storage+':mode',s);}}>
      <option value="all">전체 문제</option><option value="range">회차별 범위 선택</option><option value="pick">예상 랜덤</option></select></label>
    {scope!=='all'&&!items&&(error?<button onClick={()=>setRetry(retry+1)}>자료 다시 불러오기</button>:<small role="status">범위를 불러오는 중…</small>)}
    {scope==='range'&&items&&<label>연습 회차 <select value={index} onChange={e=>{setIndex(+e.target.value);sessionStorage.setItem(storage,e.target.value);}}>
      {ranges.map(r=><option key={r.index} value={r.index}>{r.index+1}회 · {r.label} · 풀이 {r.items.filter(i=>choice(i)).length}/{r.items.length}</option>)}</select></label>}
    <label><input type="checkbox" checked={exclude} onChange={e=>setExclude(e.target.checked)}/> 중복·비슷한 문제 제외</label>
    {scope==='pick'&&<label><input type="checkbox" checked={skipDrawn} onChange={e=>setSkipDrawn(e.target.checked)}/> 이전 추첨 문제 제외</label>}
    {scope==='pick'&&skipDrawn&&drawnIds(subject).size>0&&<button onClick={()=>{if(window.confirm('이 과목의 추첨 기록만 지울까요? 풀이 기록은 유지됩니다.')){storeDraw(subject,[]);setDrawRevision(v=>v+1);}}}>추첨 기록 초기화</button>}
    {scope==='pick'&&items&&<label>풀 문제 수 <input type="number" min="1" max={max} value={count===''?'':Math.min(+count,max)} onChange={e=>setCount(e.target.value)}/> / {max}문제</label>}
    {(subject==='metal'||subject==='sports')&&<a href={'output/pdf/'+pdfs[subject][0]+'.pdf'} target="_blank" rel="noopener">{pdfs[subject][1]} ↗</a>}
    {subject==='cooling'&&<button type="button" onClick={written}>주관식 연습 열기 · 문항당 5점 →</button>}
    <footer>{(['learn','exam'] as const).map(mode=><button type="button" className="round-mode-button" key={mode} disabled={disabled} onClick={()=>void go(mode)}>{mode==='learn'?'학습모드':'CBT 시험모드'}</button>)}</footer>
  </article>;
}
export function FinalExams({start, archive, children,pool,choice,written}:Props) {
  const [busy, setBusy] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  return <section aria-label="기말고사" className="finals-hub">
    <h1>기말고사</h1>
    <p>예상 랜덤은 수업 범위에서 선별한 후보로 구성한 연습입니다. 실제 출제 문제를 뜻하지 않습니다.</p>
    <div className="round-grid">{(['cooling','metal','sports','energy'] as const).map(subject =>
      <Course key={subject} {...{subject,start,pool,choice,written,locked:busy,lock:setBusy}}/>)}</div>
    <details onToggle={e=>setShowArchive(e.currentTarget.open)}><summary>내 학교 시험 자료 · 이전 시험</summary>
      {showArchive && <><button type="button" onClick={()=>archive('cooling')}>냉동공학 중간고사 자료</button>
        <button type="button" onClick={()=>archive('energy')}>에너지설비 중간고사 자료</button>{children}</>}
    </details>
  </section>;
}
