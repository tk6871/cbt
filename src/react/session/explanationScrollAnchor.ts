type VisibleAnchor={target:HTMLElement;top:number};
type CloseSnapshot={scroller:Element;scrollTop:number;height:number;anchor:VisibleAnchor|null};

function findScroller(slot:HTMLElement){
 const page=document.scrollingElement;
 if(!page)return null;
 for(let parent=slot.parentElement;parent&&parent!==page;parent=parent.parentElement){
   if(parent.scrollHeight>parent.clientHeight+1&&/^(auto|scroll)$/.test(getComputedStyle(parent).overflowY))return parent;
 }
 return page;
}

function viewport(scroller:Element){
 const height=document.documentElement.clientHeight;
 if(scroller===document.scrollingElement)return {top:0,bottom:height};
 const start=scroller.getBoundingClientRect().top+scroller.clientTop;
 return {top:Math.max(0,start),bottom:Math.min(height,start+scroller.clientHeight)};
}

function visibleAnchor(slot:HTMLElement,scroller:Element):VisibleAnchor|null{
 const column=slot.closest('.question-column,.book-sheet-column');
 if(!column)return null;
 const own=slot.closest('.question-card'),rect=slot.getBoundingClientRect();
 const {top,bottom}=viewport(scroller);
 const focus=document.activeElement?.closest('.question-card');
 if(focus&&focus!==own&&!column.contains(focus)&&column.closest('.question-columns,.book-sheet-columns')?.contains(focus)){
   const row=focus.getBoundingClientRect();
   if(row.top<bottom&&row.bottom>top)return null;
 }
 for(const target of column.querySelectorAll<HTMLElement>('.question-card')){
   if(target===own)continue;
   const next=target.getBoundingClientRect();
   if(next.top>=rect.bottom-1&&next.top<bottom&&next.bottom>top)return {target,top:next.top};
 }
 return null;
}

export function captureExplanationClose(slot:HTMLElement|null):CloseSnapshot|null{
 if(!slot?.querySelector('.explanation-box'))return null;
 const scroller=findScroller(slot);
 if(!scroller)return null;
 return {scroller,scrollTop:scroller.scrollTop,height:slot.getBoundingClientRect().height,anchor:visibleAnchor(slot,scroller)};
}

const scrollLimit=(el:Element)=>Math.max(0,el.scrollHeight-el.clientHeight);
function intendedTop(scroller:Element,anchor:VisibleAnchor|null,fallback:number){
 // Measure after layout so any native scroll anchoring is not applied twice.
 return anchor?.target.isConnected
   ? scroller.scrollTop+anchor.target.getBoundingClientRect().top-anchor.top
   : fallback;
}

export function restoreExplanationClose(slot:HTMLElement,snapshot:CloseSnapshot){
 const {scroller,anchor,scrollTop}=snapshot;
 if(!scroller.isConnected)return;
 const naturalHeight=slot.getBoundingClientRect().height;
 const lost=Math.max(0,snapshot.height-naturalHeight);
 let desired=intendedTop(scroller,anchor,scrollTop);
 let extra=0;
 const reserve=(height:number)=>{
   extra=height;
   slot.style.minHeight=height>0?naturalHeight+height+'px':'';
 };
 if(desired<-.5){
   // There is no negative scroll offset at the top of the document.
   reserve(Math.min(lost,Math.ceil(-desired)));
 }else if(desired>scrollLimit(scroller)+.5&&lost>0){
   // At the bottom, a height change can clamp scrollTop before the next paint.
   // Try the old height, then keep only the part needed to reach the old offset.
   reserve(lost);
   desired=intendedTop(scroller,anchor,scrollTop);
   const headroom=scrollLimit(scroller)-desired;
   if(headroom>1)reserve(Math.max(0,lost-Math.floor(headroom)));
 }
 desired=intendedTop(scroller,anchor,scrollTop);
 if(Math.abs(desired-scroller.scrollTop)>.5)scroller.scrollTo({top:desired,behavior:'instant'});
 if(!extra)return;

 slot.dataset.explanationSpaceHeld='true';
 const heldAt=scroller.scrollTop;
 let deferredAt: number|undefined;
 const clear=()=>{
   reserve(0);
   delete slot.dataset.explanationSpaceHeld;
   window.removeEventListener('scroll',onScroll,true);
   window.removeEventListener('resize',onResize);
 };
 function tryRelease(){
   const before=scroller.scrollTop;
   const {top,bottom}=viewport(scroller);
   const rect=slot.getBoundingClientRect();
   const inView=rect.bottom>top&&rect.top<bottom;
   const anchor=visibleAnchor(slot,scroller);
   // While the held area and a following question are both in the viewport,
   // wait until the spacer is out of view instead of shifting the visible card.
   if(inView&&anchor)return;
   const keep=extra;
   reserve(0);
   const desired=intendedTop(scroller,anchor,before);
   if(desired<-.5||desired>scrollLimit(scroller)+.5){
     reserve(keep);
     if(Math.abs(before-scroller.scrollTop)>.5)scroller.scrollTo({top:before,behavior:'instant'});
     deferredAt=scroller.scrollTop;
     return;
   }
   clear();
   if(Math.abs(desired-scroller.scrollTop)>.5)scroller.scrollTo({top:desired,behavior:'instant'});
 }
 function onScroll(){
   const current=scroller.scrollTop;
   if(Math.abs(heldAt-current)>1&&(deferredAt===undefined||Math.abs(deferredAt-current)>1))tryRelease();
 }
 function onResize(){tryRelease();}
 window.addEventListener('scroll',onScroll,{capture:true,passive:true});
 window.addEventListener('resize',onResize);
 return clear;
}
