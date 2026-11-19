import type {PanelProps} from './studyModels';
import {useEffect,useState} from 'react';
import {StudyPanel} from './StudyPanel';
import type {ToolName} from './workspaceTypes';
function Memo({scope}:{scope:string}){
  const key='cbt-workspace-notes/'+scope;
  const [memo,setMemo]=useState(()=>localStorage.getItem(key)||'');
  return <textarea aria-label="풀이 메모" placeholder="공식이나 헷갈린 보기를 적어두세요." value={memo} onChange={e=>{setMemo(e.target.value);localStorage.setItem(key,e.target.value)}}/>;
}
export function ToolPanels({calculator,notes,scope,solution,close}:PanelProps){
  const [mobile,setMobile]=useState(()=>matchMedia('(max-width:820px)').matches);
  const [selected,select]=useState<ToolName>('explanation');
  const [folded,fold]=useState(false);
  useEffect(()=>{
    const mq=matchMedia('(max-width:820px)');
    const change=()=>setMobile(mq.matches);
    mq.addEventListener('change',change);
    return ()=>mq.removeEventListener('change',change);
  },[]);
  useEffect(()=>{if(calculator){select('calculator');fold(false)}},[calculator]);
  useEffect(()=>{if(notes){select('notes');fold(false)}},[notes]);
  useEffect(()=>{if(solution){select('explanation');fold(false)}},[solution?.id]);
  const tools:{name:ToolName;label:string;content:React.ReactNode}[]=[];
  if(calculator)tools.push({name:'calculator',label:'공학용 계산기',content:<iframe src={'calculator.html?native=1&space='+encodeURIComponent(scope)} title="공학용 계산기"/>});
  if(notes)tools.push({name:'notes',label:'풀이 메모',content:<Memo key={scope} scope={scope}/>});
  if(solution)tools.push({name:'explanation',label:solution.number+'번 고정 해설',content:<><small>{solution.round}</small><p>{solution.text}</p>{solution.images.map(src=><img key={src} src={src} alt="원문 해설"/>)}</>});
  const active=tools.find(t=>t.name===selected)??tools[0];
  if(mobile&&active)return <section className={'mobile-tool-drawer'+(folded?' folded':'')} aria-label="풀이 도구">
    <header>{tools.map(t=><button key={t.name} aria-pressed={!folded&&active.name===t.name} onClick={()=>{select(t.name);fold(false)}}>{t.label}</button>)}
    <button onClick={()=>fold(!folded)}>{folded?'펼치기':'접기'}</button><button onClick={()=>close(active.name)}>닫기</button></header>
    {tools.map(t=><div className="study-float-body" key={t.name} hidden={folded||active.name!==t.name}>{t.content}</div>)}
  </section>;
  return <>{tools.map(t=><StudyPanel key={t.name} name={t.name} title={t.label} close={()=>close(t.name)}>{t.content}</StudyPanel>)}</>;
}
