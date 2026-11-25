type State=Record<string,unknown>;
type Overlay={dialog:HTMLDialogElement;state:State|null;url:string;token:number};
let active:Overlay|undefined,serial=0;
let closingTo:Overlay|undefined;

export function showStudyOverlay(dialog:HTMLDialogElement|null){
 if(!dialog||dialog.open)return;
 dialog.showModal();
 const state=history.state as State|null;
 if(!state?.cbtSpace||active)return;
 const entry={dialog,state,url:location.href,token:++serial};
 active=entry;
 history.pushState({...state,cbtOverlay:entry.token},'',entry.url);
 dialog.addEventListener('close',()=>{
   if(active!==entry)return;
   active=undefined;
   if(history.state?.cbtOverlay===entry.token){
     closingTo=entry;
     history.back();
   }
 },{once:true});
}
export function handleStudyOverlayHistory(event:PopStateEvent){
 if(closingTo){
   const previous=closingTo;closingTo=undefined;
   if(location.href===previous.url&&!event.state?.cbtOverlay)return true;
 }
 if(active&&event.state?.cbtOverlay!==active.token){
   const overlay=active;active=undefined;overlay.dialog.close();
   if(location.href===overlay.url&&event.state?.view===overlay.state?.view&&event.state?.sessionId===overlay.state?.sessionId)return true;
 }
 // Forward can revisit the former overlay entry. Keep the underlying screen.
 if(event.state?.cbtOverlay){
   const {cbtOverlay:_,...state}=event.state;
   history.replaceState(state,'',location.href);
   return true;
 }
 return false;
}
