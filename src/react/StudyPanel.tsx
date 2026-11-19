import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import type {ToolName} from './workspaceTypes';

const titles={calculator:'공학용 계산기',notes:'풀이 메모',explanation:'고정한 해설'};
type Rect={left:number;top:number;width:number;height:number};
function fit(rect:Rect):Rect{
  const width=Math.min(Math.max(260,rect.width),window.innerWidth-16);
  const height=Math.min(Math.max(160,rect.height),window.innerHeight-16);
  return {width,height,left:Math.max(8,Math.min(rect.left,window.innerWidth-width-8)),top:Math.max(8,Math.min(rect.top,window.innerHeight-height-8))};
}
function initial(name:ToolName):Rect{
  const idx=Object.keys(titles).indexOf(name);
  const rect={left:innerWidth-420-idx*50,top:90+idx*40,width:390,height:name==='calculator'?560:300};
  try{const saved=JSON.parse(localStorage.getItem('cbt-panel/'+name)||'null');if(saved&&Object.keys(rect).every(k=>Number.isFinite(saved[k])))return fit(saved)}catch{}
  return fit(rect);
}
export function StudyPanel({name,title,close,children}:{name:ToolName;title?:string;close:()=>void;children:ReactNode}){
  const [rect,position]=useState(()=>initial(name)),[collapsed,collapse]=useState(false),[layer,raise]=useState(0);
  const node=useRef<HTMLElement>(null);
  const drag=useRef<{x:number;y:number;rect:Rect}|null>(null);
  useLayoutEffect(()=>{
    function resize(){position(r=>fit(r))}
    window.addEventListener('resize',resize);
    return ()=>window.removeEventListener('resize',resize);
  },[]);
  useEffect(()=>{const id=setTimeout(()=>{try{localStorage.setItem('cbt-panel/'+name,JSON.stringify(rect))}catch{}},200);return ()=>clearTimeout(id)},[name,rect]);
  useEffect(()=>{
    if(!node.current||collapsed)return;
    const observer=new ResizeObserver(()=>{
      if(!node.current||matchMedia('(max-width:820px)').matches)return;
      const {offsetWidth:width,offsetHeight:height}=node.current;
      position(old=>old.width===width&&old.height===height?old:fit({...old,width,height}));
    });
    observer.observe(node.current);return ()=>observer.disconnect();
  },[collapsed]);
  return <section ref={node} className={'study-float'+(collapsed?' folded':'')} data-tool={name} aria-label={title||titles[name]}
    style={{...rect,height:collapsed?'auto':rect.height,zIndex:90+layer}} onPointerDown={()=>raise(Math.floor(performance.now()/100))}>
    <header><button type="button" className="panel-grip" aria-label={(title||titles[name])+' 위치 이동'} title="끌거나 방향키로 이동"
      onPointerDown={e=>{if(matchMedia('(max-width:820px)').matches)return;drag.current={x:e.clientX,y:e.clientY,rect};e.currentTarget.setPointerCapture(e.pointerId)}}
      onPointerMove={e=>{const d=drag.current;if(d)position(fit({...d.rect,left:d.rect.left+e.clientX-d.x,top:d.rect.top+e.clientY-d.y}))}}
      onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}
      onKeyDown={e=>{const delta:Record<string,number[]>={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]};const d=delta[e.key];if(d){e.preventDefault();position(fit({...rect,left:rect.left+d[0],top:rect.top+d[1]}))}}}>
      {title||titles[name]}</button>
      <button type="button" onClick={()=>{localStorage.removeItem('cbt-panel/'+name);position(initial(name));collapse(false)}}>복원</button>
      <button type="button" aria-expanded={!collapsed} onClick={()=>collapse(!collapsed)}>{collapsed?'펼치기':'접기'}</button>
      <button type="button" onClick={close}>닫기</button></header>
    <div className="study-float-body" hidden={collapsed}>{children}</div>
  </section>;
}
