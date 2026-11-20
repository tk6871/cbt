import {useEffect, useRef, useState, type PointerEvent, type CSSProperties, type ReactNode} from 'react';

interface Hold {
  id:number; x:number; y:number; timer:number; active:boolean;
}
export function SourceImageStage({children,onChoose,className="source-image-stage",style,as:Tag="div"}:{children:ReactNode;onChoose:(n:number)=>void;className?:string;style?:CSSProperties;as?:"div"|"figure"}) {
  const hold=useRef<Hold|null>(null);
  const ignoreClick=useRef(false);
  const [lens,setLens]=useState<{left:number;top:number;x:number;y:number;width:number;height:number;url:string;number:number}|null>(null);
  useEffect(()=>()=>{if(hold.current)window.clearTimeout(hold.current.timer);},[]);
  function choiceAt(stage:HTMLElement,x:number,y:number) {
    const target=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-printed-number]');
    return target && stage.contains(target) ? Number(target.dataset.printedNumber) : 0;
  }
  function move(stage:HTMLElement,x:number,y:number) {
    const img=stage.querySelector('img');
    if(!img || !img.naturalWidth)return;
    const rect=img.getBoundingClientRect(), frame=stage.getBoundingClientRect(), radius=46, zoom=2;
    setLens({left:Math.max(radius,Math.min(frame.width-radius,x-frame.left)),top:Math.max(radius,y-frame.top-radius-16),
      x:radius-(x-rect.left)*zoom,y:radius-(y-rect.top)*zoom,width:rect.width*zoom,height:rect.height*zoom,
      url:img.currentSrc,number:choiceAt(stage,x,y)});
  }
  function down(e:PointerEvent<HTMLElement>) {
    ignoreClick.current=false;
    if(!e.isPrimary || e.button!==0 || !(e.target as Element).closest('[data-printed-number]'))return;
    const stage=e.currentTarget, id=e.pointerId, x=e.clientX,y=e.clientY;
    if(hold.current)window.clearTimeout(hold.current.timer);
    const timer=window.setTimeout(()=>{
      if(hold.current?.id!==id)return;
      hold.current.active=true;stage.setPointerCapture(id);move(stage,x,y);
    },450);
    hold.current={id,x,y,timer,active:false};
  }
  function end(e:PointerEvent<HTMLElement>,cancel=false) {
    const state=hold.current;
    if(!state || state.id!==e.pointerId)return;
    window.clearTimeout(state.timer);hold.current=null;setLens(null);
    if(!state.active)return;
    ignoreClick.current=true;
    if(e.currentTarget.hasPointerCapture(state.id))e.currentTarget.releasePointerCapture(state.id);
    const n=cancel?0:choiceAt(e.currentTarget,e.clientX,e.clientY);
    if(n)onChoose(n);
  }
  return <Tag className={className} style={style} onPointerLeave={e=>{if(!hold.current?.active)end(e,true);}} onPointerDown={down} onPointerUp={e=>end(e)} onPointerCancel={e=>end(e,true)}
    onPointerMove={e=>{
      const state=hold.current;if(!state || state.id!==e.pointerId)return;
      if(state.active)move(e.currentTarget,e.clientX,e.clientY);
      else if(Math.hypot(e.clientX-state.x,e.clientY-state.y)>9)end(e,true);
    }} onClickCapture={e=>{if(ignoreClick.current && e.detail!==0){e.preventDefault();e.stopPropagation();ignoreClick.current=false;}}}
    onContextMenu={e=>{if(hold.current?.active)e.preventDefault();}}>
    {children}
    {lens && <span aria-hidden="true" className="source-choice-lens" style={{left:lens.left,top:lens.top,
      backgroundImage:'url("'+lens.url+'")',backgroundPosition:lens.x+'px '+lens.y+'px',backgroundSize:lens.width+'px '+lens.height+'px'}}>
      {lens.number>0 && <b>{lens.number}번</b>}
    </span>}
  </Tag>;
}
