import {Children,cloneElement,isValidElement,useLayoutEffect,useRef,type ReactElement,type ReactNode} from 'react';
import {createPortal} from 'react-dom';

export function StudyPortal({disabled,children}:{disabled:boolean;children:ReactNode}){
  return disabled?children:createPortal(children,document.body);
}
export function StudyTransition({name,stageKey,afterEnter,children}:{name:string;stageKey?:string|number;afterEnter?:()=>void;children:ReactNode}) {
  const element = useRef<HTMLElement|null>(null);
  const callback = useRef(afterEnter);
  callback.current=afterEnter;
  const child = Children.toArray(children).find(isValidElement) as ReactElement<{ref?:(el:HTMLElement|null)=>void}>|undefined;
  const shown=Boolean(child);
  useLayoutEffect(()=>{
    const node=element.current;
    if (!node || !name) { if(shown)callback.current?.(); return; }
    const from=name+'-enter-from',active=name+'-enter-active';
    node.classList.add(active,from);
    const frame=requestAnimationFrame(()=>{node.classList.remove(from);});
    const finish=()=>{node.classList.remove(active,from);callback.current?.();};
    const running=node.getAnimations();
    let cancelled=false;
    void Promise.allSettled(running.map(x=>x.finished)).then(()=>{if(!cancelled)finish();});
    return ()=>{cancelled=true;cancelAnimationFrame(frame);node.classList.remove(active,from);};
  },[stageKey,name,shown]);
  return child ? cloneElement(child,{ref:node=>{element.current=node;}}) : null;
}
