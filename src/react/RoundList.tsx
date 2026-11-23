import {Fragment,useState} from 'react';
import {LayoutGrid, List} from 'lucide-react';
import type {VisualStyle} from '../cbt/storage';
import {roundPhoto} from './themePhotos';
export interface StudyRound {
  id:string; title:string; qualification:string; year:number; school:boolean; restored:boolean;
  description:string; scope:string; subjects:string[]; hint?:string;
  record?:{score:number;date:string;latest:boolean};
  calculation?:{count:number;included:boolean;set:(included:boolean)=>void};
  answered:number; total:number; progress:number; wrong:number; canReset:boolean;
  start:(s?:string)=>void; reset:()=>void; openWrong:()=>void; exam:(s?:string)=>void;
}
function RoundCard({r, theme}: {r: StudyRound; theme: VisualStyle}) {
  const [only,setOnly]=useState('');
  const cover = theme === 'default' ? undefined : roundPhoto(theme, r.id);
  const compact=theme==='default' && !r.school && r.year>0;
  const shortTitle=r.title.replace(/^.*?[：:]\s*/,'').replace(new RegExp('^'+r.year+'년\\s*'),'').replace(/\s*기출문제$/,'').trim();
  return (
    <article id={'round-card-'+r.id} className={'round-card'+(r.school?' energy-topic-card':'')}>
      {cover && <img className="round-theme-photo" src={cover.small} style={{objectPosition: cover.position}} alt="" loading="lazy" decoding="async"/>}
      <header><span>{r.qualification}</span><div className="round-header-actions">{!r.school&&<b>{r.year}년</b>}
        <button type="button" className="round-reset" aria-label={r.title+' 학습 초기화'} disabled={!r.canReset} onClick={r.reset}>초기화</button>
      </div></header>
      {r.record&&<div className={'round-record-badge'+(r.record.latest?' latest':'')}><span>{r.record.latest?'마지막으로 푼 회차':'최근 CBT 기록'}</span>
        <strong>{r.record.score}점</strong><small>{r.record.date}</small></div>}
      {r.restored&&<em className="round-restored">CBT 복원문제 · 원문 이미지</em>}
      <h2 aria-label={r.title}>{compact ? shortTitle || r.title : r.title}</h2><p>{r.description}</p>{r.scope&&<small>{r.scope}</small>}
      {r.calculation&&<label className="energy-topic-calculation"><input type="checkbox" checked={r.calculation.included} aria-label={r.title+' 계산 문제 포함'} onChange={e=>r.calculation?.set(e.target.checked)}/>계산{r.calculation.count}문제 {r.calculation.included?'On · 포함':'Off · 제외'}</label>}
      {!r.school&&r.subjects.length>1?<label className="round-paper-filter">풀이 과목 <select value={only} onChange={e=>setOnly(e.target.value)}><option value="">전체 과목</option>{r.subjects.map((s,i)=><option key={i} value={s}>{i+1}과목 · {s}</option>)}</select></label>:r.subjects.length>0&&<div className="round-subjects">{r.subjects.map((s,i)=><span key={i}>{s}</span>)}</div>}
      {r.hint&&<details className="energy-topic-note"><summary>자료 대조 안내</summary><p>{r.hint}</p></details>}
      {r.answered>0&&<><div className="round-progress"><span><i style={{width:r.progress+'%'}}/></span></div><small className="round-progress-copy">{r.answered}/{r.total} 학습 중</small></>}
      <footer><button type="button" className="round-mode-button" onClick={()=>r.start(only||undefined)}>{r.answered&&!only?'이어 학습':'학습모드'}</button>
        <button type="button" className="round-mode-button" onClick={()=>r.exam(only||undefined)}>CBT 시험모드</button>
        {r.wrong>0&&<button type="button" className="round-mode-button round-wrong-button" onClick={r.openWrong}>오답 {r.wrong}개</button>}
      </footer>
    </article>);
}
export function RoundList({rows, theme}: {rows: StudyRound[]; theme: VisualStyle}) {
  const [list, setList] = useState(() => {
    try { return localStorage.getItem('cbt-round-view') === 'list'; } catch { return false; }
  });
  function select(list: boolean) {
    setList(list);
    try { localStorage.setItem('cbt-round-view', list ? 'list' : 'cards'); } catch { /* Session-only choice. */ }
  }
  const [year,setYear]=useState(0);
  const years=new Map<number,StudyRound[]>();
  const grouped=theme==='default' && rows.length>0 && rows.every(row=>!row.school && row.year>0);
  if(grouped) for(const row of rows){
    const entries=years.get(row.year);
    if(entries)entries.push(row);else years.set(row.year,[row]);
  }
  const selectedYear=years.has(year)?year:0;
  return <div className={grouped?'round-library':'round-library-plain'}>
    <div className="round-library-tools">
    {grouped && <label className="round-year-picker">연도
      <select value={selectedYear} onChange={e=>setYear(Number(e.target.value))}>
        <option value={0}>전체 · {rows.length}회차</option>
        {[...years].map(([y,items])=><option key={y} value={y}>{y}년 · {items.length}회차</option>)}
      </select></label>}
    <div className="round-view-options" role="group" aria-label="회차 보기 방식">
      <button type="button" aria-pressed={!list} onClick={() => select(false)}><LayoutGrid size={15} aria-hidden="true"/>카드</button>
      <button type="button" aria-pressed={list} onClick={() => select(true)}><List size={16} aria-hidden="true"/>목록</button>
    </div>
    </div>
    <div className="round-grid" data-layout={list ? 'list' : 'cards'} data-react-view="round-list">
      {grouped ? [...years].filter(([y])=>!selectedYear || y===selectedYear).map(([y,items])=><Fragment key={y}>
        <div className="round-year-heading"><h2>{y}년</h2><span>{items.length}개 회차</span></div>
        {items.map(r=><RoundCard key={r.id} r={r} theme={theme}/>)}
      </Fragment>) : rows.map(r=><RoundCard key={r.id} r={r} theme={theme}/>)}
    </div>
  </div>;
}
