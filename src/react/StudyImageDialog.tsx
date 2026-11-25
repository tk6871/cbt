import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {showStudyOverlay} from '../cbt/studyOverlayHistory';
import {macStudyInput} from '../cbt/studyGestures';

type NativeGesture=Event&{scale?:number;rotation?:number};
const clamp=(z:number)=>Math.min(400,Math.max(100,z));
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
 closed.current=onClose;
 zoomRef.current=zoom;rotationRef.current=rotation;
 const [deviceMac]=useState(macStudyInput);
 useLayoutEffect(()=>{showStudyOverlay(dialog.current);},[]);
 useLayoutEffect(()=>{
   const el=viewport.current;if(!el)return;
   el.scrollLeft=Math.max(0,(el.scrollWidth-el.clientWidth)/2);
   el.scrollTop=Math.max(0,(el.scrollHeight-el.clientHeight)/2);
 },[zoom,rotation]);
 useEffect(()=>{
   const el=viewport.current;if(!el||!deviceMac)return;
   let safariZoom=100,safariRotation=0,gesture=false;
   const start=(e:Event)=>{gesture=true;safariZoom=zoomRef.current;safariRotation=rotationRef.current;e.preventDefault();};
   const change=(e:Event)=>{
     const ne=e as NativeGesture;if(!gesture)return;
     e.preventDefault();
     if(ne.scale!=null)setZoom(clamp(safariZoom*ne.scale));
     if(ne.rotation!=null)setRotation(safariRotation+ne.rotation);
   };
   const end=(e:Event)=>{
     gesture=false;e.preventDefault();
     setRotation(value=>Math.round(value/90)*90);
   };
   const wheel=(e:WheelEvent)=>{
     if(!e.ctrlKey||gesture||e.deltaMode!==0||e.altKey||e.metaKey||!e.cancelable)return;
     e.preventDefault();setZoom(value=>clamp(value*Math.exp(-e.deltaY*.012)));
   };
   el.addEventListener('wheel',wheel,{passive:false});
   el.addEventListener('gesturestart',start,{passive:false});
   el.addEventListener('gesturechange',change,{passive:false});
   el.addEventListener('gestureend',end,{passive:false});
   return ()=>{el.removeEventListener('wheel',wheel);el.removeEventListener('gesturestart',start);el.removeEventListener('gesturechange',change);el.removeEventListener('gestureend',end);};
 },[deviceMac]);
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
   <div ref={viewport} className="study-image-viewport" data-zoom={zoom} tabIndex={0} aria-label="확대 그림 이동 영역"
     onDoubleClick={e=>{if(deviceMac){clearTimeout(clickTimer.current);e.preventDefault();setZoom(v=>v===100?200:100);}}}>
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
