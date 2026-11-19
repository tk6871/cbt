import {lazy, Suspense, useEffect, useState, useSyncExternalStore} from 'react';
import {allowMobileModel,lessons,type LessonKind} from './modelPreference';
import ModelBoundary from './ModelBoundary';

const Fan=lazy(()=>import('./FanLesson'));
const Piston=lazy(()=>import('./PistonLesson'));
const Equipment=lazy(()=>import('./EquipmentLesson'));
const mobile=window.matchMedia('(max-width: 820px), (pointer: coarse)');
const readAllowed=()=>!mobile.matches || allowMobileModel.value;
function subscribe(notify:()=>void){
  const stop=allowMobileModel.subscribe(notify);
  mobile.addEventListener('change',notify);
  return ()=>{stop();mobile.removeEventListener('change',notify);};
}
export default function ModelSlot({kind,active,onInteract}:{kind:LessonKind;active?:boolean;onInteract:()=>void}){
  const allowed=useSyncExternalStore(subscribe,readAllowed);
  const [expanded,setExpanded]=useState(false);
  useEffect(()=>{setExpanded(false);},[kind]);
  useEffect(()=>{if(!allowed || active===false)setExpanded(false);},[allowed,active]);
  return <div className="model-slot">
    <button type="button" disabled={!allowed} aria-expanded={allowed&&expanded} onClick={()=>{onInteract();setExpanded(!expanded);}}>{expanded?'3D 접기':'3D로 '+lessons[kind].label+' 보기'}</button>
    {!allowed&&<small>설정의 모바일 3D 해설에서 켤 수 있습니다.</small>}
    {allowed&&expanded&&<ModelBoundary><Suspense fallback={<small role="status">모형 준비 중…</small>}>{kind==='fan'?<Fan/>:kind==='piston'?<Piston/>:<Equipment kind={kind}/>}</Suspense></ModelBoundary>}
  </div>;
}
