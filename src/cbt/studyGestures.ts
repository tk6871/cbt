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
 let distance=0,fineSamples=0,axis=0,direction=0,timeout=0;
 const reset=()=>{distance=0;fineSamples=0;axis=0;direction=0;};
 const wheel=(e:WheelEvent)=>{
   if(e.defaultPrevented||modalStudyInput()||e.ctrlKey||e.altKey||e.metaKey||e.shiftKey||e.deltaMode!==0)return;
   if(!(e.target instanceof Element)||selector&&!e.target.closest(selector)||e.target.closest('input,textarea,select,[contenteditable=true],pre,table,.study-image-viewport,.practical-image-viewport,.direct-key-scroll,.math-formula'))return;
   const x=Math.abs(e.deltaX),y=Math.abs(e.deltaY);
   const horizontal=x>0&&x>=y*1.6;
   if(Date.now()<ignoreUntil&&horizontal){ignoreUntil=Date.now()+170;if(e.cancelable)e.preventDefault();return;}
   if(!x&&!y)return;
   // A Mac trackpad may report exactly zero vertical movement. Match a
   // sustained horizontal stroke rather than identifying hardware from deltas.
   // Single/coarse wheel notches are not navigation; image viewers never enter here.
   const step=e.deltaX<0?-1:1;
   if(horizontal&&!canGo(step)){clearTimeout(timeout);reset();return;}
   clearTimeout(timeout);timeout=window.setTimeout(reset,170);
   if(!axis)axis=horizontal?1:-1;
   if(axis<0||!horizontal)return;
   if(direction!==step){distance=0;fineSamples=0;direction=step;}
   if(x<=44)fineSamples++;
   else if(!fineSamples)return;
   if(e.cancelable)e.preventDefault();
   distance+=x;
   if(fineSamples>=3&&distance>=68){reset();ignoreUntil=Date.now()+170;go(step);}
 };
 area.addEventListener('wheel',wheel,{passive:false});
 return ()=>{clearTimeout(timeout);area.removeEventListener('wheel',wheel);};
}
