import type {SubjectSelection, MaterialSelection} from './studyModels';
import {useRef} from 'react';

export function SubjectPicker({groups,selected,name,onSelect}:SubjectSelection){
  const dialog=useRef<HTMLDialogElement>(null);
  function show(){
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLButtonElement>('[aria-pressed=true]')?.focus();
  }
  return <>
    <button type="button" className="subject-switch" aria-haspopup="dialog" aria-label={'종목 변경 · '+name} onClick={show}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m3 8 9-5 9 5-9 5zM3 12l9 5 9-5M3 16l9 5 9-5"/></svg>
      <strong>{name}</strong><span aria-hidden="true">⌄</span>
    </button>
    <dialog ref={dialog} className="subject-dialog" aria-label="종목 변경" onClick={e=>{if(e.target===dialog.current)dialog.current?.close()}}>
      <div className="picker-inner"><header><h2>종목 변경</h2><button type="button" aria-label="종목 선택 닫기" onClick={()=>dialog.current?.close()}>×</button></header>
        <div className="picker-list">{groups.map(g=><section key={g.label}><h3>{g.label}</h3>{g.items.map(s=>
          <button type="button" key={s.key} aria-pressed={selected===s.key} onClick={()=>{dialog.current?.close();onSelect(s.key)}}>
            {s.name}{selected===s.key&&<b aria-hidden="true">✓</b>}</button>)}</section>)}</div></div>
    </dialog></>;
}
const materials=[
  ['자격증 기출','exam'],
  ['교재 페이지별','textbook'],
  ['냉동공학 중간고사','refrigeration'],
  ['에너지설비 중간고사','energy'],
];
export function MaterialSwitch({active,actions}:MaterialSelection){
  return <nav className="rounds-collection material-switch" aria-label="회차별 문제 모음">
    {materials.map(([name,icon],i)=><button key={name} type="button" className={active===i?'active':''} aria-pressed={active===i} onClick={actions[i]}>
      <span className={'material-icon material-'+icon} aria-hidden="true"/>{name}
    </button>)}</nav>;
}
