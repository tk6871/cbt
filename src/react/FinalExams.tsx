import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {ArrowRight,BookOpen,Flame,Forklift,Layers,Snowflake,Trophy,Shuffle} from 'lucide-react';
import type {QuestionItem,StudyMode} from '../cbt/types';
import {finalNames,type FinalSubject} from '../cbt/finalCourseBank';
import {sampleSize,finalRanges,selectFinalItems,drawnIds,storeDraw,type FinalOptions} from '../cbt/finalSelection';
import type {StudyView} from './studyRoutes';

const subjects=['cooling','metal','sports','energy','forklift'] as const;
const icons={cooling:Snowflake,metal:Layers,sports:Trophy,energy:Flame,forklift:Forklift};
const scopes={cooling:'부록 4-7~5-108쪽 · 냉동냉장설비',metal:'철–탄소 상태도와 열처리',sports:'운동·체력·리더십·윤리',energy:'교재 321~644쪽 · 전 회차',forklift:'객관식 15문제 · 지게차 5 / 엔진 5 / 법규 2 / 일반안전 3 · 도로교통법규 제외'};
const pdfs={metal:['metal-curves-final','곡선 입문 PDF 열기'],sports:['sports-leadership-final','시험범위 PDF 열기']};
export function finalSubjectFor(view:StudyView){return subjects.find(s=>view==='school-'+s);}
type Props={pool:(s:FinalSubject)=>Promise<QuestionItem[]>;choice:(i:QuestionItem)=>number;start:(s:FinalSubject,m:StudyMode,o:FinalOptions)=>Promise<void>;
 open:(v:StudyView)=>void;archive:(s:'energy'|'cooling')=>void;children:ReactNode;subject?:FinalSubject};

function ModeButtons({go,disabled=false}:{go:(m:StudyMode)=>void;disabled?:boolean}){
 return <div className="final-mode-actions">{(['learn','exam'] as const).map(m=><button type="button" key={m} disabled={disabled} onClick={()=>go(m)}>{m==='learn'?'학습모드':'CBT 시험모드'}</button>)}</div>;
}
function SubjectRoom({subject,open,pool,choice,start}:Pick<Props,'open'|'pool'|'choice'|'start'>&{subject:FinalSubject}){
 const [items,setItems]=useState<QuestionItem[]|null>(null),[retry,setRetry]=useState(0),[error,setError]=useState(false);
 const [busy,setBusy]=useState(false),[random,setRandom]=useState(false),[exclude,setExclude]=useState(true),[skip,setSkip]=useState(false);
 const [count,setCount]=useState(String(sampleSize)),[revision,refresh]=useState(0),[rangeExclude,setRangeExclude]=useState(false);
 useEffect(()=>{let active=true;setError(false);
   pool(subject).then(list=>{if(active)setItems(list);},()=>{if(active)setError(true);});return ()=>{active=false;};
 },[pool,subject,retry]);
 const ranges=useMemo(()=>items?finalRanges(items):[],[items]);
 const maximum=useMemo(()=>{
   if(!random||!items)return 0;
   const used=skip?drawnIds(subject):new Set<string>();
   return selectFinalItems(items.filter(i=>!used.has(i.id)),subject,{expected:true,exclude,count:items.length}).length;
 },[items,random,subject,exclude,skip,revision]);
 const n=Math.min(+count,maximum);
 const openedKey='final-range-v1:'+subject;
 async function launch(mode:StudyMode,opts:FinalOptions){
   if(busy||!items?.length)return;
   if(opts.range!==undefined)sessionStorage.setItem(openedKey,String(opts.range));
   setBusy(true);try{await start(subject,mode,opts);}finally{setBusy(false);refresh(v=>v+1);}
 }
 const last=sessionStorage.getItem(openedKey);
 const pdf=subject==='metal'||subject==='sports'?pdfs[subject]:null;
 return <section className="finals-hub final-room" aria-label={finalNames[subject]+' 기말 연습'}>
   <button type="button" className="final-back" onClick={()=>open('school')}>← 기말고사 과목 목록</button>
   <header><h1>{finalNames[subject]}</h1><p>{scopes[subject]}</p></header>
   {pdf&&<a href={'output/pdf/'+pdf[0]+'.pdf'} target="_blank" rel="noopener">{pdf[1]} ↗</a>}
   {subject==='cooling'&&<button className="final-back" onClick={()=>open('school-written')}>주관식 연습 열기 · 문항당 5점 →</button>}
   {subject==='forklift'&&<><button className="final-back" onClick={()=>open('school-forklift-written')}>주관식 2문제 · 윤활유와 등화장치 →</button>
   <small>법규 예상 범위: <a href="https://www.law.go.kr/법령/건설기계관리법/제13조" target="_blank" rel="noreferrer">건설기계 검사</a> · <a href="https://www.law.go.kr/법령/산업안전보건기준에관한규칙/제178조" target="_blank" rel="noreferrer">사업장 지게차 안전기준</a></small></>}
   {!items?(error?<button onClick={()=>setRetry(v=>v+1)}>문제 다시 불러오기</button>:<p role="status">연습 회차를 불러오는 중…</p>):!items.length?<p>준비된 문제가 없습니다.</p>:<>
     <details className="final-tool" onToggle={e=>setRandom(e.currentTarget.open)}><summary><Shuffle size={17}/> 예상 랜덤</summary>
       {random&&<div className="final-inline">{subject==='forklift'?<span>실전 구성 · 객관식 15문제 고정</span>:<><label>풀 문제 수 <input type="number" min={1} max={maximum} value={count===''?'':n} onChange={e=>setCount(e.target.value)}/> / {maximum}</label>
         <label><input type="checkbox" checked={exclude} onChange={e=>setExclude(e.target.checked)}/> 중복·비슷한 문제 제외</label></>}
         <label><input type="checkbox" checked={skip} onChange={e=>setSkip(e.target.checked)}/> 이전 추첨 문제 제외</label>
         {skip&&drawnIds(subject).size>0&&<button onClick={()=>{if(window.confirm('풀이 기록을 유지하고 추첨 기록만 지울까요?')){storeDraw(subject,[]);refresh(v=>v+1);}}}>추첨 기록 초기화</button>}
         {subject==='forklift'&&!maximum&&<small>이전 문제를 제외하면 15문제를 구성할 수 없습니다. 추첨 기록을 초기화하거나 제외를 해제하세요.</small>}
         <ModeButtons disabled={busy||!Number.isInteger(n)||n<1} go={m=>void launch(m,{expected:true,exclude:subject==='forklift'?false:exclude,skipDrawn:skip,count:subject==='forklift'?15:n})}/></div>}
     </details>
     <div className="final-range-title"><h2>연습 회차 <small>{ranges.length}회</small></h2><label><input type="checkbox" checked={rangeExclude} onChange={e=>setRangeExclude(e.target.checked)}/> 중복·비슷한 문제 제외</label></div>
     <div className="final-range-grid">{ranges.map(r=>{
       const done=r.items.filter(i=>choice(i)).length;
       return <article key={r.index} aria-label={r.index+1+'회 연습'} className="final-range">
         <header><h3>{r.index+1}회</h3>{last===String(r.index)&&<small>최근 선택</small>}</header>
         <p>{r.label}</p><small>풀이 {done}/{r.items.length}</small><progress aria-label="회차 진도" value={done} max={r.items.length}/>
         <ModeButtons disabled={busy} go={m=>void launch(m,{range:r.index,expected:false,exclude:rangeExclude})}/></article>;
     })}</div>
     <details className="final-tool"><summary><BookOpen size={17}/> 전체 문제 · {items.length}문제</summary><ModeButtons disabled={busy} go={m=>void launch(m,{expected:false,exclude:rangeExclude})}/></details>
   </>}
 </section>;
}
export function FinalExams(props:Props){
 const [archive,setArchive]=useState(false);
 if(props.subject)return <SubjectRoom key={props.subject} {...props} subject={props.subject}/>;
 return <section className="finals-hub final-library" aria-label="기말고사"><h1>기말고사</h1><p>공부할 과목을 선택하세요.</p>
   <div className="final-subjects">{subjects.map(s=>{const Icon=icons[s];return <button key={s} onClick={()=>props.open(`school-${s}`)}><Icon aria-hidden="true"/><strong>{finalNames[s]}</strong><ArrowRight size={17} aria-hidden="true"/></button>;})}</div>
   <details onToggle={e=>setArchive(e.currentTarget.open)}><summary>내 학교 시험 자료 · 이전 시험</summary>{archive&&<><button onClick={()=>props.archive('cooling')}>냉동공학 중간고사 자료</button><button onClick={()=>props.archive('energy')}>에너지설비 중간고사 자료</button>{props.children}</>}</details>
 </section>;
}
