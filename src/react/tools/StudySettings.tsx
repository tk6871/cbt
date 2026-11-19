import {useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Monitor,Palette,ListChecks,BookOpen,Wrench,Database} from 'lucide-react';
import {settingsCategories,visibleSettings,type SettingsCategory,type SettingsValues,type SettingsContext,type SettingChange,type SettingsAction} from '../../cbt/settingsCatalog';
import {SettingsControls} from './SettingsContent';
import './study-settings.css';

const icons={appearance:Palette,device:Monitor,solving:ListChecks,explanation:BookOpen,tools:Wrench,data:Database};
const sectionKey='cbt-settings-section';
interface Props{
 mode?:'quick'|'full'|'page';values:SettingsValues;context:SettingsContext;
 onChange:(change:SettingChange)=>void;onAction:(action:SettingsAction)=>void;children?:ReactNode;
}
export default function StudySettings({mode='quick',values,context,onChange,onAction,children}:Props){
 const embedded=mode==='page',detailed=mode!=='quick';
 const [query,setQuery]=useState('');
 const [section,setSection]=useState<SettingsCategory>(()=>{
  try{const saved=settingsCategories.find(c=>c.id===sessionStorage.getItem(sectionKey));if(saved)return saved.id;}catch{}
  return context.session?'solving':'appearance';
 });
 const dialog=useRef<HTMLDialogElement>(null),body=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  if(embedded||!dialog.current)return;
  const node=dialog.current,previous=document.activeElement,overflow=document.body.style.overflow;
  node.showModal();document.body.style.overflow='hidden';
  return ()=>{node.close();document.body.style.overflow=overflow;if(previous instanceof HTMLElement && previous.isConnected)previous.focus({preventScroll:true});};
 },[embedded]);
 useEffect(()=>{if(body.current)body.current.scrollTop=0;},[section,query]);
 const visible=visibleSettings(section,query,context),searching=!!query.trim();
 function selectCategory(id:SettingsCategory){setSection(id);setQuery('');try{sessionStorage.setItem(sectionKey,id);}catch{}}
 const content=<>
  <header className="settings-hub-header"><div><h2 id="study-settings-heading">{detailed?'전체 설정':'화면과 학습 데이터'}</h2><p id="study-settings-description">{context.session?'답안과 진도는 유지됩니다. 시험 타이머는 계속 진행됩니다.':'변경 즉시 적용하고 이 기기에 자동 저장합니다.'}</p></div>
   <button type="button" aria-label={embedded?'설정에서 돌아가기':'설정 닫기'} onClick={()=>onAction('close')}>{embedded?'←':'×'}</button></header>
  <div className="settings-hub-search"><label htmlFor="study-settings-search">설정 찾기</label><input type="search" value={query} id="study-settings-search" onChange={e=>setQuery(e.target.value)} placeholder="글씨, 답안, 다크, 동기화…" autoComplete="off"/>{searching&&<button type="button" onClick={()=>setQuery('')}>검색 지우기</button>}</div>
  <div className="settings-hub-layout"><nav className="settings-category-nav" aria-label="설정 목차">{settingsCategories.map(item=>{const Icon=icons[item.id];return <button key={item.id} type="button" aria-pressed={!searching&&section===item.id} onClick={()=>selectCategory(item.id)}><Icon size={18} aria-hidden="true"/>{item.label}</button>;})}</nav>
   <div ref={body} className="settings-hub-body"><h3 className="settings-section-title" aria-live="polite">{searching?'검색 결과':settingsCategories.find(i=>i.id===section)!.label}</h3>
   {searching&&!visible.size&&<p className="settings-empty">일치하는 설정이 없습니다.</p>}
   <SettingsControls values={values} context={context} visible={visible} onChange={onChange} onAction={onAction}>{children}</SettingsControls></div></div>
  <footer>{detailed?<span>v{context.version} · 자동 저장</span>:<button type="button" className="settings-open-full" onClick={()=>onAction('full')}>전체 설정 열기 ↗</button>}<button type="button" onClick={()=>onAction('close')}>{context.session?'풀이로 돌아가기':'돌아가기'}</button></footer>
 </>;
 const cls='settings-panel settings-hub'+(embedded?' settings-page':'')+(detailed?'':' settings-quick');
 if(embedded)return <section className={cls} aria-labelledby="study-settings-heading" aria-describedby="study-settings-description">{content}</section>;
 return createPortal(<dialog className={cls} ref={dialog} aria-labelledby="study-settings-heading" aria-describedby="study-settings-description" onCancel={e=>{e.preventDefault();onAction('close');}} onClick={e=>{
  if(e.target!==e.currentTarget)return;const box=e.currentTarget.getBoundingClientRect();
  if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)onAction('close');
 }}>{content}</dialog>,document.body);
}
