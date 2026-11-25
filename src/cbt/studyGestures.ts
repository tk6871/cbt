import {WheelGestures} from 'wheel-gestures';

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
export function bindMacHorizontalSwipe(area:HTMLElement,canGo:(step:-1|1)=>boolean,go:(step:-1|1)=>void,selector?:string){
 if(!macStudyInput())return ()=>{};
 const gestures=WheelGestures({preventWheelAction:false,reverseSign:false});
 let samples=0,axis=0,direction=0,base=0,turned=false;
 const reset=()=>{samples=0;axis=0;direction=0;base=0;turned=false;};
 const horizontal=(x:number,y:number)=>Math.abs(x)>0&&Math.abs(x)>=Math.abs(y)*1.6;
 const stop=gestures.on('wheel',event=>{
   if(event.isStart||event.isEnding)reset();
   if(event.isEnding)return;
   const [dx,dy]=event.axisDelta;
   if(!dx&&!dy)return;
   if(!axis)axis=horizontal(dx,dy)?1:-1;
   if(axis<0||!horizontal(dx,dy))return;
   const input=event.event;
   if(turned||event.isMomentum){
     if(input.cancelable)input.preventDefault?.();
     return;
   }
   const step=dx<0?-1:1;
   if(!canGo(step)){reset();return;}
   const x=event.axisMovement[0];
   if(direction!==step){samples=0;direction=step;}
   // Reject a single coarse wheel tick. Fine horizontal samples may have zero Y.
   if(!samples){
     if(Math.abs(dx)>48)return;
     base=x-dx;
   }
   if(Math.abs(dx)<=48)samples++;
   if(input.cancelable)input.preventDefault?.();
   if(samples>=3&&step*(x-base)>=62){turned=true;go(step);}
 });
 const wheel=(e:WheelEvent)=>{
   if(e.defaultPrevented||modalStudyInput()||e.ctrlKey||e.altKey||e.metaKey||e.shiftKey||e.deltaMode!==0)return;
   if(!(e.target instanceof Element)||selector&&!e.target.closest(selector)||e.target.closest('input,textarea,select,[contenteditable=true],pre,table,.study-image-viewport,.practical-image-viewport,.direct-key-scroll,.math-formula'))return;
   if(!turned&&horizontal(e.deltaX,e.deltaY)&&!canGo(e.deltaX<0?-1:1)){reset();return;}
   // Feed only study surfaces. The library must not attach globally or
   // consume native image panning, browser zoom, or Windows history gestures.
   gestures.feedWheel(e);
 };
 area.addEventListener('wheel',wheel,{passive:false});
 return ()=>{area.removeEventListener('wheel',wheel);stop();gestures.disconnect();};
}
