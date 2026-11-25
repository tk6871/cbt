type CloseAnchor={target:HTMLElement;scroller:Element;top:number};

export function automaticExplanationAnchor(box:HTMLElement|null): CloseAnchor|null|false {
 if(!box)return null;
 const column=box.closest<HTMLElement>('.question-column,.book-sheet-column');
 if(!column)return null;
 const current=box.closest<HTMLElement>('.question-card');
 const page=document.scrollingElement;
 if(!page)return null;
 let scroller=page;
 for(let parent=column.parentElement;parent&&parent!==page;parent=parent.parentElement){
   if(parent.scrollHeight>parent.clientHeight+1&&/^(auto|scroll)$/.test(getComputedStyle(parent).overflowY)){
     scroller=parent;break;
   }
 }
 const windowScroll=scroller===page, viewport=scroller.getBoundingClientRect();
 const top=windowScroll?0:Math.max(0,viewport.top+scroller.clientTop);
 const bottom=windowScroll?document.documentElement.clientHeight:Math.min(document.documentElement.clientHeight,top+scroller.clientHeight);
 const rect=box.getBoundingClientRect();
 if(rect.top>=bottom)return null;
 const focus=document.activeElement?.closest('.question-card');
 if(focus&&focus!==current&&!column.contains(focus)&&column.closest('.question-columns,.book-sheet-columns')?.contains(focus)){
   const row=focus.getBoundingClientRect();
   if(row.top<bottom&&row.bottom>top)return null;
 }
 for(const target of column.querySelectorAll<HTMLElement>('.question-card')){
   if(target===current)continue;
   const next=target.getBoundingClientRect();
   if(next.top<rect.bottom-1||next.bottom<=top||next.top>=bottom)continue;
   // A scroll offset cannot go above zero. Wait for more room rather than
   // visibly pulling a later question up while the user is near the top.
   if(scroller.scrollTop+1<rect.height)return false;
   return {target,scroller,top:next.top};
 }
 return null;
}

export function restoreExplanationAnchor(anchor:CloseAnchor){
 if(!anchor.target.isConnected)return;
 // Measure again after layout so any native scroll anchoring is not applied twice.
 const shift=anchor.target.getBoundingClientRect().top-anchor.top;
 if(Math.abs(shift)>.5)anchor.scroller.scrollBy({top:shift,behavior:'instant'});
}
