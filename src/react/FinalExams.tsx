import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {ArrowRight,BookOpen,Flame,Forklift,Layers,Snowflake,Trophy,Shuffle} from 'lucide-react';
import type {QuestionItem,StudyMode} from '../cbt/types';
import {finalNames,type FinalSubject} from '../cbt/finalCourseBank';
import {sampleSize,finalRanges,finalRangeSizes,selectFinalItems,drawnIds,storeDraw,type FinalOptions,type FinalRangeSize} from '../cbt/finalSelection';
import type {StudyView} from './studyRoutes';
import {emptyBookPracticeFilters} from '../cbt/textbookPracticeFilters';
import {BookPracticeFilterControls} from './BookPracticeFilterControls';
import {StudyChoiceOverlay} from './StudyChoiceOverlay';
import {questionSubject,subjectLabel} from '../cbt/printedSubject';
import {readStudyPreference,writeStudyPreference} from '../cbt/studyInputPreferences';

const subjects=['cooling','metal','sports','energy','forklift'] as const;
const icons={cooling:Snowflake,metal:Layers,sports:Trophy,energy:Flame,forklift:Forklift};
const scopes={cooling:'부록 4-7~5-108쪽 · 냉동냉장설비',metal:'시험 표시 범위 · 재료·검사·가공·상태도·열처리',sports:'운동·체력·리더십·윤리',energy:'교재 395~644쪽 · 2019년 4회~2025년 3회',forklift:'객관식 15문제 · 지게차 5 / 엔진 5 / 법규 2 / 일반안전 3 · 도로교통법규 제외'};
const pdfs={metal:['metal-marked-final','시험 표시 자료·그래프 45쪽 열기'],sports:['sports-leadership-final','시험범위 PDF 열기']};
export function finalSubjectFor(view:StudyView){return subjects.find(s=>view==='school-'+s);}
type Props={pool:(s:FinalSubject)=>Promise<QuestionItem[]>;choice:(i:QuestionItem)=>number;start:(s:FinalSubject,m:StudyMode,o:FinalOptions)=>Promise<void>;
 open:(v:StudyView)=>void;children:ReactNode;subject?:FinalSubject};

function ModeButtons({go,disabled=false}:{go:(m:StudyMode)=>void;disabled?:boolean}){
 return <div className="final-mode-actions">{(['learn','exam'] as const).map(m=><button className="round-mode-button" type="button" key={m} disabled={disabled} onClick={()=>go(m)}>{m==='learn'?'학습모드':'CBT 시험모드'}</button>)}</div>;
}
function SubjectRoom({subject,open,pool,choice,start}:Pick<Props,'open'|'pool'|'choice'|'start'>&{subject:FinalSubject}){
 const [items,setItems]=useState<QuestionItem[]|null>(null),[retry,setRetry]=useState(0),[error,setError]=useState(false);
 const [busy,setBusy]=useState(false),[random,setRandom]=useState(false),[exclude,setExclude]=useState(true),[skip,setSkip]=useState(false);
 const [count,setCount]=useState(String(sampleSize)),[revision,refresh]=useState(0),[rangeExclude,setRangeExclude]=useState(false);
 const useBookFilters=subject==='cooling'||subject==='energy';
 const settingsKey='final-settings-v2:'+subject;
 const [preferences,setPreferences]=useState(()=>readStudyPreference(settingsKey,{
   size:(subject==='energy'?'actual':'60') as FinalRangeSize,filters:emptyBookPracticeFilters,papers:{} as Record<string,string>,
 }));
 const size=useBookFilters&&finalRangeSizes.includes(preferences.size)?preferences.size:undefined;
 const filters=preferences.filters||emptyBookPracticeFilters;
 function changeSettings(patch:Partial<typeof preferences>){
   const next={...preferences,...patch};setPreferences(next);writeStudyPreference(settingsKey,next);
 }
 const activeFilters=useBookFilters?filters:undefined;
 useEffect(()=>{let active=true;setError(false);
   pool(subject).then(list=>{if(active)setItems(list);},()=>{if(active)setError(true);});return ()=>{active=false;};
 },[pool,subject,retry]);
 const ranges=useMemo(()=>items?finalRanges(items,size):[],[items,size]);
 const full=useMemo(()=>selectFinalItems(items||[],subject,{expected:false,exclude:!useBookFilters&&rangeExclude,bookFilters:activeFilters}),[items,subject,useBookFilters,rangeExclude,activeFilters]);
 const visibleRanges=useMemo(()=>ranges.map(r=>{
   const choices=[...new Map(r.items.map(i=>{const paper=questionSubject(i);return [paper.name,{value:paper.name,label:subjectLabel(paper)}]})).values()];
   const key=(size||'base')+':'+r.index;
   const selected=preferences.papers?.[key]||'';
   const paper=choices.some(c=>c.value===selected)?selected:'';
   const available=paper?r.items.filter(i=>questionSubject(i).name===paper):r.items;
   return {...r,key,choices,paper,available,playable:selectFinalItems(available,subject,{expected:false,exclude:!useBookFilters&&rangeExclude,bookFilters:activeFilters})};
 }),[ranges,subject,useBookFilters,size,rangeExclude,activeFilters,preferences.papers]);
 const maximum=useMemo(()=>{
   if(!random||!items)return 0;
   const used=skip?drawnIds(subject):new Set<string>();
   return selectFinalItems(items.filter(i=>!used.has(i.id)),subject,{expected:true,exclude:!useBookFilters&&exclude,bookFilters:activeFilters,count:items.length}).length;
 },[items,random,subject,useBookFilters,activeFilters,exclude,skip,revision]);
 const n=Math.min(+count,maximum);
 const openedKey='final-range-v1:'+subject;
 async function launch(mode:StudyMode,opts:FinalOptions){
   if(busy||!items?.length)return;
   if(opts.range!==undefined)writeStudyPreference(openedKey,(size||'base')+':'+opts.range,'session');
   setBusy(true);try{await start(subject,mode,opts);}finally{setBusy(false);refresh(v=>v+1);}
 }
 const last=readStudyPreference(openedKey,'','session');
 useEffect(()=>{
   if(!items?.length)return;
   const key='final-return:'+subject;
   const anchor=readStudyPreference<string>(key,'','session');
   if(!anchor)return;
   const frame=requestAnimationFrame(()=>{
     document.getElementById(anchor)?.scrollIntoView({block:'center'});
     writeStudyPreference(key,'','session');
   });
   return ()=>cancelAnimationFrame(frame);
 },[items,subject]);
 const pdf=subject==='metal'||subject==='sports'?pdfs[subject]:null;
 return <section className="finals-hub final-room" aria-label={finalNames[subject]+' 기말 연습'}>
   <button type="button" className="final-back" onClick={()=>open('school')}>← 기말고사 과목 목록</button>
   <header><h1>{finalNames[subject]}</h1><p>{scopes[subject]}</p>
    {items&&<p aria-live="polite" data-final-filter-count>전체 {items.length.toLocaleString('ko-KR')}문제{full.length!==items.length?' · 제외 '+(items.length-full.length).toLocaleString('ko-KR')+'문제 · 풀 문제 '+full.length.toLocaleString('ko-KR')+'문제':''}</p>}
   </header>
   {pdf&&<a href={'output/pdf/'+pdf[0]+'.pdf'} target="_blank" rel="noopener">{pdf[1]} ↗</a>}
   {subject==='metal'&&<details className="final-tool"><summary>시험 계산 · 1 kW ≈ 860 kcal/h</summary>
     <p><strong>kW × 860 ≈ kcal/h · 반대로 kcal/h ÷ 860 ≈ kW</strong></p>
     <p>1 kW는 1 kJ/s입니다. 1시간이 3,600초라서 3,600 kJ/h이고, 1 kcal는 4.1868 kJ(국제표 기준)라서 3,600 ÷ 4.1868 ≈ 859.85 kcal/h입니다.</p>
     <p>예: 2.5 kW ≈ 2.5 × 860 = <strong>2,150 kcal/h</strong>.</p>
   </details>}
   {subject==='cooling'&&<button className="final-back" onClick={()=>open('school-written')}>주관식 연습 열기 · 문항당 5점 →</button>}
   {subject==='forklift'&&<><button className="final-back" onClick={()=>open('school-forklift-written')}>주관식 2문제 · 윤활유와 등화장치 →</button>
   <small>법규 예상 범위: <a href="https://www.law.go.kr/법령/건설기계관리법/제13조" target="_blank" rel="noreferrer">건설기계 검사</a> · <a href="https://www.law.go.kr/법령/산업안전보건기준에관한규칙/제178조" target="_blank" rel="noreferrer">사업장 지게차 안전기준</a></small></>}
   {!items?(error?<p role="alert">기말고사 문제를 불러오지 못했습니다. <button type="button" onClick={()=>setRetry(v=>v+1)}>다시 불러오기</button></p>:<p role="status">연습 회차를 불러오는 중…</p>):!items.length?<p>준비된 문제가 없습니다.</p>:<>
     {useBookFilters&&<div className="final-tool">
       <BookPracticeFilterControls value={filters} onChange={filters=>changeSettings({filters})}/>
       {(filters.duplicates||filters.similar)&&<small>회차에서는 그 회차 안에서만 제외합니다. 회차 사이 반복은 전체 풀이에서 제외됩니다.</small>}
     </div>}
     <details className="final-tool" onToggle={e=>setRandom(e.currentTarget.open)}><summary><Shuffle size={17}/> 예상 랜덤</summary>
       {random&&<div className="final-inline">{subject==='forklift'?<span>실전 구성 · 객관식 15문제 고정</span>:<><label>풀 문제 수 <input type="number" min={1} max={maximum} value={count===''?'':n} onChange={e=>setCount(e.target.value)}/> / {maximum}</label>
         {!useBookFilters&&<label><input type="checkbox" checked={exclude} onChange={e=>setExclude(e.target.checked)}/> 중복·비슷한 문제 제외</label>}</>}
         <label><input type="checkbox" checked={skip} onChange={e=>setSkip(e.target.checked)}/> 이전 추첨 문제 제외</label>
         {skip&&drawnIds(subject).size>0&&<button onClick={()=>{if(window.confirm('풀이 기록을 유지하고 추첨 기록만 지울까요?')){storeDraw(subject,[]);refresh(v=>v+1);}}}>추첨 기록 초기화</button>}
         {subject==='forklift'&&!maximum&&<small>이전 문제를 제외하면 15문제를 구성할 수 없습니다. 추첨 기록을 초기화하거나 제외를 해제하세요.</small>}
         <ModeButtons disabled={busy||!Number.isInteger(n)||n<1} go={m=>void launch(m,{expected:true,exclude:!useBookFilters&&subject!=='forklift'&&exclude,bookFilters:activeFilters,skipDrawn:skip,count:subject==='forklift'?15:n})}/></div>}
     </details>
     <div className="final-range-title"><h2>연습 회차 <small>{ranges.length}회</small></h2>{useBookFilters?
       <StudyChoiceOverlay title="회차 설정" value={size||'actual'} choices={finalRangeSizes.map(n=>({value:n,label:n==='actual'?'교재 회차 그대로':n+'문제씩'}))}
         onSelect={v=>changeSettings({size:v as FinalRangeSize})}/>:
       <label><input type="checkbox" checked={rangeExclude} onChange={e=>setRangeExclude(e.target.checked)}/> 중복·비슷한 문제 제외</label>}</div>
     <div className="final-range-grid">{visibleRanges.map(r=>{
       const done=r.playable.filter(i=>choice(i)).length;
       return <article key={r.key} id={'final-card-'+subject+'-'+r.key} aria-label={r.title+' 연습'} className="final-range round-card">
         <header><h3>{r.title}</h3>{last===r.key&&<small>최근 선택</small>}</header>
         <p>{subject==='forklift'?(r.items[0]?.question.sourcePage?'기능사 기출 선별 · ':'자체 예상 · '):''}{r.label}</p>
         {useBookFilters&&<>
           {r.summary&&<details className="final-source-rounds"><summary>{size==='actual'?'수록 문항 번호':r.summary}</summary><ul>{r.detail.map(s=><li key={s}>{s}</li>)}</ul></details>}
           {r.choices.length>1?<StudyChoiceOverlay title="풀이 과목" value={r.paper} choices={[{value:'',label:'전체 과목'},...r.choices]}
             onSelect={paper=>changeSettings({papers:{...preferences.papers,[r.key]:paper}})}/>:
             <small className="final-single-paper">{r.choices[0]?.label}</small>}
           <p aria-live="polite" data-range-count={r.playable.length}>풀 문제 {r.playable.length}문제{r.available.length!==r.playable.length?' · 제외 '+(r.available.length-r.playable.length)+'문제':''}</p>
         </>}
         <div className="round-progress" role="progressbar" aria-label="회차 진도" aria-valuenow={done} aria-valuemax={r.playable.length||1}><span><i style={{width:(r.playable.length?done*100/r.playable.length:0)+'%'}}/></span></div>
         <small className="round-progress-copy">풀이 {done}/{r.playable.length}</small>
         <footer><ModeButtons disabled={busy||!r.playable.length} go={m=>void launch(m,{range:r.index,rangeSize:size,paper:r.paper,expected:false,exclude:!useBookFilters&&rangeExclude,bookFilters:activeFilters})}/></footer></article>;
     })}</div>
     <details className="final-tool"><summary><BookOpen size={17}/> 전체 문제 · {full.length}문제</summary><ModeButtons disabled={busy||!full.length} go={m=>void launch(m,{expected:false,exclude:!useBookFilters&&rangeExclude,bookFilters:activeFilters})}/></details>
   </>}
 </section>;
}
export function FinalExams(props:Props){
 const [materialsOpen,setMaterialsOpen]=useState(false);
 if(props.subject)return <SubjectRoom key={props.subject} {...props} subject={props.subject}/>;
 return <section className="finals-hub final-library" aria-label="기말고사"><h1>기말고사</h1><p>공부할 과목을 선택하세요.</p>
   <div className="final-subjects">{subjects.map(s=>{const Icon=icons[s];return <button key={s} onClick={()=>props.open(`school-${s}`)}><Icon aria-hidden="true"/><strong>{finalNames[s]}</strong><ArrowRight size={17} aria-hidden="true"/></button>;})}</div>
   <details onToggle={e=>setMaterialsOpen(e.currentTarget.open)}><summary>내 학교 시험 자료</summary>{materialsOpen&&props.children}</details>
 </section>;
}
