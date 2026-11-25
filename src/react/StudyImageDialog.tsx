import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {usePinch} from '@use-gesture/react';
import {showStudyOverlay} from '../cbt/studyOverlayHistory';
import {macStudyInput} from '../cbt/studyGestures';

const clamp=(z:number)=>Math.min(400,Math.max(100,z));
type ZoomAnchor={x:number;y:number;ratioX:number;ratioY:number};
export function StudyImageButton({src,alt,sourceClass}:{src:string;alt:string;sourceClass?:string}){
 const [open,setOpen]=useState(false);
 return <><button type="button" className="study-image-open" aria-label={alt+' 크게 보기'} onClick={()=>setOpen(true)}>
   <img src={src} alt={alt} className={sourceClass} loading="lazy" decoding="async"/>
 </button>{open&&<StudyImageDialog src={src} alt={alt} sourceClass={sourceClass} onClose={()=>setOpen(false)}/>}</>;
}
export function StudyImageDialog({src,alt,original,onClose,sourceClass,clickToClose=false}:{
 src:string;alt:string;original?:boolean;onClose:()=>void;sourceClass?:string;clickToClose?:boolean;
}){
 const dialog=useRef<HTMLDialogElement>(null),viewport=useRef<HTMLDivElement>(null);
 const [zoom,setZoom]=useState(100),[rotation,setRotation]=useState(0);
 const zoomRef=useRef(zoom),rotationRef=useRef(rotation),closed=useRef(onClose);
 const anchor=useRef<ZoomAnchor|null>(null);
 closed.current=onClose;
 zoomRef.current=zoom;rotationRef.current=rotation;
 const [deviceMac]=useState(macStudyInput);
 function applyZoomAt(nextZoom:number,nextRotation:number,origin:[number,number]){
   const el=viewport.current;
   if(!el||!Number.isFinite(nextZoom)||!Number.isFinite(nextRotation))return;
   nextZoom=clamp(nextZoom);
   if(nextZoom===zoomRef.current&&nextRotation===rotationRef.current)return;
   if(origin.every(Number.isFinite)){
     const rect=el.getBoundingClientRect();
     const x=Math.max(0,Math.min(el.clientWidth,origin[0]-rect.left-el.clientLeft));
     const y=Math.max(0,Math.min(el.clientHeight,origin[1]-rect.top-el.clientTop));
     anchor.current={x,y,ratioX:(el.scrollLeft+x)/Math.max(1,el.scrollWidth),ratioY:(el.scrollTop+y)/Math.max(1,el.scrollHeight)};
   }
   setZoom(nextZoom);
   setRotation(nextRotation);
 }
 useLayoutEffect(()=>{showStudyOverlay(dialog.current);},[]);
 useLayoutEffect(()=>{
   const el=viewport.current;if(!el)return;
   const point=anchor.current;anchor.current=null;
   el.scrollLeft=point?point.ratioX*el.scrollWidth-point.x:Math.max(0,(el.scrollWidth-el.clientWidth)/2);
   el.scrollTop=point?point.ratioY*el.scrollHeight-point.y:Math.max(0,(el.scrollHeight-el.clientHeight)/2);
 },[zoom,rotation]);
 usePinch(({offset:[scale,angle],origin,event,last})=>{
   if(!deviceMac)return;
   const rotates=event?.type.startsWith('gesture');
   if(last&&!rotates)return;
   applyZoomAt(scale*100,rotates?(last?Math.round(angle/90)*90:angle):rotationRef.current,origin);
 },{
   target:viewport,enabled:deviceMac,eventOptions:{passive:false},
   from:()=>[zoomRef.current/100,rotationRef.current],
   scaleBounds:{min:1,max:4},modifierKey:'ctrlKey',
 });
 const doClose=()=>dialog.current?.close();
 const clickTimer=useRef<number>(0);
 useEffect(()=>()=>clearTimeout(clickTimer.current),[]);
 const pan=(step:number)=>viewport.current?.scrollBy({left:step,behavior:'instant'});
 return <dialog ref={dialog} aria-label={alt} className="practical-image-dialog study-image-dialog"
   onClose={()=>closed.current()} onClick={e=>{if(e.target===e.currentTarget)doClose()}}>
   <header><strong>{alt}</strong>
     <label>확대 <select aria-label="그림 확대 비율" value={[100,150,200,300,400].includes(zoom)?zoom:'gesture'}
       onChange={e=>setZoom(Number(e.target.value))}>
       {![100,150,200,300,400].includes(zoom)&&<option disabled value="gesture">{Math.round(zoom)}%</option>}
       {[100,150,200,300,400].map(n=><option key={n} value={n}>{n===100?'그림 전체 맞춤':n+'%'}</option>)}
     </select></label>
     {zoom>100&&<><button type="button" aria-label="그림 왼쪽 이동" onClick={()=>pan(-160)}>←</button><button type="button" aria-label="그림 오른쪽 이동" onClick={()=>pan(160)}>→</button></>}
     <button type="button" aria-label="그림 회전" onClick={()=>setRotation(v=>v+90)}>↻</button>
     <button autoFocus type="button" onClick={doClose}>닫기</button>
   </header>
   <div ref={viewport} className="study-image-viewport" data-zoom={zoom} data-rotation={rotation} tabIndex={0} aria-label="확대 그림 이동 영역"
     onDoubleClick={e=>{if(deviceMac){clearTimeout(clickTimer.current);e.preventDefault();applyZoomAt(zoomRef.current===100?200:100,rotationRef.current,[e.clientX,e.clientY]);}}}>
     <div className="study-image-frame" data-sideways={Math.abs(Math.round(rotation/90))%2!==0} style={{width:zoom+'%',height:zoom+'%'}} onClick={()=>{
       if(!clickToClose)return;
       if(deviceMac){clearTimeout(clickTimer.current);clickTimer.current=window.setTimeout(doClose,250);}else doClose();
     }}>
       <img src={src} draggable={false} alt={alt} className={[sourceClass,original?'restored-image-original':null].filter(Boolean).join(' ')}
         style={{transform:'rotate('+rotation+'deg)'}}/>
     </div>
   </div>
 </dialog>;
}
