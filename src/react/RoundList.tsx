import {useState,type ReactNode} from 'react';
import {GlassLens} from './GlassLens';
export interface StudyRound {
  id:string; title:string; qualification:string; year:number; school:boolean; restored:boolean;
  description:string; scope:string; subjects:string[]; hint?:string;
  record?:{score:number;date:string;latest:boolean};
  calculation?:{count:number;included:boolean;set:(included:boolean)=>void};
  answered:number; total:number; progress:number; wrong:number; canReset:boolean;
  start:()=>void; reset:()=>void; openWrong:()=>void; exam:()=>void;
}
function RoundWindow({children}:{children:ReactNode}){
  const [lens,setLens]=useState(false);
  function enableLens(){
    if(matchMedia('(hover:hover) and (pointer:fine) and (min-width:821px) and (prefers-reduced-motion:no-preference)').matches &&
      !matchMedia('(prefers-reduced-transparency:reduce), (forced-colors:active)').matches)setLens(true);
  }
  return <section className="round-window" aria-label="회차 미리보기">
    <header className="round-window-toolbar"><i aria-hidden="true" className="window-lights"/><span>CBT　/　학습 공간</span></header>
    <div className="round-window-landscape photo-stage" onPointerEnter={enableLens} onFocus={enableLens}>
      {lens&&<GlassLens/>}{children}
    </div>
  </section>;
}
function RoundCard({r,featured}:{r:StudyRound;featured:boolean}){
  return (
    <article data-lens={featured?'':undefined} id={'round-card-'+r.id} className={'round-card'+(r.school?' energy-topic-card':'')}>
      <header><span>{r.qualification}</span><div className="round-header-actions">{!r.school&&<b>{r.year}년</b>}
        <button type="button" className="round-reset" aria-label={r.title+' 학습 초기화'} disabled={!r.canReset} onClick={r.reset}>초기화</button>
      </div></header>
      {r.record&&<div className={'round-record-badge'+(r.record.latest?' latest':'')}><span>{r.record.latest?'마지막으로 푼 회차':'최근 CBT 기록'}</span>
        <strong>{r.record.score}점</strong><small>{r.record.date}</small></div>}
      {r.restored&&<em className="round-restored">CBT 복원문제 · 원문 이미지</em>}
      <h2>{r.title}</h2><p>{r.description}</p>{r.scope&&<small>{r.scope}</small>}
      {r.calculation&&<label className="energy-topic-calculation"><input type="checkbox" checked={r.calculation.included} aria-label={r.title+' 계산 문제 포함'} onChange={e=>r.calculation?.set(e.target.checked)}/>계산{r.calculation.count}문제 {r.calculation.included?'On · 포함':'Off · 제외'}</label>}
      {r.subjects.length>0&&<div className="round-subjects">{r.subjects.map((s,i)=><span key={i}>{s}</span>)}</div>}
      {r.hint&&<details className="energy-topic-note"><summary>자료 대조 안내</summary><p>{r.hint}</p></details>}
      {r.answered>0&&<><div className="round-progress"><span><i style={{width:r.progress+'%'}}/></span></div><small className="round-progress-copy">{r.answered}/{r.total} 학습 중</small></>}
      <footer><button data-lens={featured?'':undefined} type="button" className="round-mode-button" onClick={r.start}>{r.answered?'이어 학습':'학습모드'}</button>
        <button data-lens={featured?'':undefined} type="button" className="round-mode-button" onClick={r.exam}>CBT 시험모드</button>
        {r.wrong>0&&<button type="button" className="round-mode-button round-wrong-button" onClick={r.openWrong}>오답 {r.wrong}개</button>}
      </footer>
    </article>);
}
export function RoundList({rows}:{rows:StudyRound[]}){
  return <div className="round-grid" data-react-view="round-list">{rows.map((r,i)=>i===0
    ? <RoundWindow key={r.id}><RoundCard r={r} featured/></RoundWindow>
    : <RoundCard key={r.id} r={r} featured={false}/>)}</div>;
}
