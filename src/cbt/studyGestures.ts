export function macStudyInput(){
 const nav=navigator as Navigator&{userAgentData?:{platform?:string}};
 return /^mac/i.test(nav.userAgentData?.platform||nav.platform) && !(nav.maxTouchPoints>1);
}
export function modalStudyInput(){
 return [...document.querySelectorAll<HTMLElement>('dialog[open],[role="dialog"][aria-modal="true"],[role="alertdialog"]')]
   .some(el=>el.getClientRects().length>0);
}
export function blockedStudyKey(event:KeyboardEvent){
 const origin=event.target;
 return event.defaultPrevented||event.repeat||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||modalStudyInput()
   ||origin instanceof HTMLElement&&!!origin.closest('input,textarea,select,button,a,summary,canvas,[contenteditable]:not([contenteditable=false]),[role="textbox"],[role="slider"],.study-float');
}
let ignoreUntil=0;
export function bindMacHorizontalSwipe(area:HTMLElement,canGo:(step:-1|1)=>boolean,go:(step:-1|1)=>void,selector?:string){
 if(!macStudyInput())return ()=>{};
 let distance=0,axis=0,advanced=false,timeout=0,qualified=false;
 const reset=()=>{distance=0;axis=0;advanced=false;qualified=false;};
 const wheel=(e:WheelEvent)=>{
   if(e.defaultPrevented||modalStudyInput()||e.ctrlKey||e.altKey||e.metaKey||e.shiftKey||e.deltaMode!==0)return;
   if(!(e.target instanceof Element)||selector&&!e.target.closest(selector)||e.target.closest('input,textarea,select,button,[contenteditable=true],pre,table,.study-image-viewport,.practical-image-viewport,.book-direct-question img'))return;
   const x=Math.abs(e.deltaX),y=Math.abs(e.deltaY);
   if(Date.now()<ignoreUntil&&x>y*2&&x>0){ignoreUntil=Date.now()+170;if(e.cancelable)e.preventDefault();return;}
   // There is no web device ID for wheel input. Only engage on a precision
   // gesture with both axes; a one-axis thumb-wheel tick stays native.
   if(!axis&&x<1)return;
   const step=e.deltaX<0?-1:1;
   if(!advanced&&!canGo(step)){clearTimeout(timeout);reset();return;}
   clearTimeout(timeout);timeout=window.setTimeout(reset,170);
   if(!axis)axis=x>y*2?1:-1;
   if(axis<0)return;
   if(y>0&&y<x*.5&&x<48)qualified=true;
   if(!qualified)return;
   if(e.cancelable)e.preventDefault();
   if(advanced)return;
   distance+=e.deltaX;
   if(Math.abs(distance)>=92){advanced=true;ignoreUntil=Date.now()+170;go(distance<0?-1:1);}
 };
 area.addEventListener('wheel',wheel,{passive:false});
 return ()=>{clearTimeout(timeout);area.removeEventListener('wheel',wheel);};
}
