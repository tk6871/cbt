import {useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {showStudyOverlay} from '../cbt/studyOverlayHistory';

export type StudyChoice={value:string;label:string;hint?:string};
export function StudyChoiceOverlay({title,value,choices,onSelect,className='round-paper-filter'}:{
 title:string;value:string;choices:StudyChoice[];onSelect:(v:string)=>void;className?:string;
}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [open,setOpen]=useState(false);
 useLayoutEffect(()=>{
   if(!open)return;
   showStudyOverlay(dialog.current);
   dialog.current?.querySelector<HTMLElement>('[aria-pressed=true]')?.focus();
 },[open]);
 const current=choices.find(c=>c.value===value)||choices[0];
 if(!current)return null;
 return <div className={className}>
   <span>{title}</span>
   <button type="button" className="study-choice-trigger" aria-haspopup="dialog" aria-label={title+' · '+current.label}
     onClick={()=>setOpen(true)}>
     <strong>{current.label}</strong><span aria-hidden="true">⌄</span>
   </button>
   {open&&createPortal(<dialog ref={dialog} className="subject-dialog" aria-label={title} onClose={()=>setOpen(false)} onClick={e=>{if(e.target===e.currentTarget)e.currentTarget.close()}}>
     <div className="picker-inner"><header><h2>{title}</h2><button type="button" aria-label={title+' 닫기'} onClick={()=>dialog.current?.close()}>×</button></header>
       <div className="picker-list"><section>{choices.map(c=>
         <button key={c.value} type="button" aria-pressed={current.value===c.value} onClick={()=>{onSelect(c.value);dialog.current?.close()}}>
           <span>{c.label}{c.hint&&<small>{c.hint}</small>}</span>{current.value===c.value&&<b aria-hidden="true">✓</b>}
         </button>
       )}</section></div>
     </div>
   </dialog>,document.body)}
 </div>;
}
