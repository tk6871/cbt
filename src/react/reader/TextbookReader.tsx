import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {useSnapshot} from 'valtio';
import QuestionCard from '../session/QuestionCard';
import type {QuestionItem,StudyMode} from '../../cbt/types';
import {BookSurface} from './BookSurface';
import {ContentsTree} from './ContentsTree';
import type {NavigationTab} from './BookNavigator';
import {bookContents,type ContentsRow} from '../../cbt/textbookContents';
import {readBookSelection,saveBookSelection,type BookSelection} from '../../cbt/textbookReaderState';
import {saveTextbookAnswer,textbookAnswersIn} from '../../cbt/textbookAnswerProgress';
import {studyStore,persistStudyStoreNow} from '../../cbt/storage';
import {explanationDisplay} from '../../cbt/explanationDisplay';
import {adjacentBookPage, compareBookPages, normalizeBookPage, readableBookPages, textbookAuditPages, textbookDirectSources, textbookEntries, textbookNames, textbookPageAudit, textbookReferencePage, textbookSelectionKey, textbookStudyId, textbookWorkedExamples, type TextbookKey} from '../../cbt/textbookPages';
import {pageNavigationStep} from '../../cbt/pageNavigationKey';
import './reader.css';

interface Props {
  book:TextbookKey; items:QuestionItem[];
  loading:boolean;error:string;answerLayout:'classic'|'inline'|'hotspot';hotspotIndicator:'marker'|'area';
  restoredImageTheme:'auto'|'original';onClose():void;onCalculator():void;onSettings():void;onRetry():void;
  onBook(book:TextbookKey):void;onRound(id:string):Promise<void>;onChoose(item:QuestionItem,choice:number):void;
  onBookmark(item:QuestionItem):void;onAi(item:QuestionItem):void;
  onStart(payload:{items:QuestionItem[];mode:StudyMode;label:string}):Promise<void>;
}
const directById=new Map(textbookDirectSources.map(row=>[row.id,row]));
const latest=bookContents.hansol.find(node=>node.id==='hansol-latest')!.children!;
const subscribeDisplay=(notify:()=>void)=>explanationDisplay.subscribe(notify);
const getDisplay=()=>explanationDisplay.value;
const inRange=(page:string,start:string,end:string)=>end ? compareBookPages(page,start)>=0 && compareBookPages(page,end)<=0 : page===start;

export default function TextbookReader(p:Props){
 const {book,items}=p;
 const records=useSnapshot(studyStore);
 const answers=textbookAnswersIn(records.progress || {});
 const [selectedBook,setSelectedBook]=useState(book);
 const [selection,setSelection]=useState(()=>readBookSelection(book));
 const start=normalizeBookPage(selection.from), end=normalizeBookPage(selection.to);
 const invalid=!!end && compareBookPages(start,end)>0;
 const [tab,setTab]=useState<NavigationTab>('contents'),[visited,setVisited]=useState(false);
 const [draftFrom,setDraftFrom]=useState(''),[draftTo,setDraftTo]=useState('');
 const [auditSearch,setAuditSearch]=useState(''),[auditLimit,setAuditLimit]=useState(80);
 if(selectedBook!==book){
  const saved=readBookSelection(book);
  setSelectedBook(book);setSelection(saved);setDraftFrom(saved.from);setDraftTo(saved.to);
  setAuditSearch('');setAuditLimit(80);
 }
 const dialog=useRef<HTMLDialogElement|null>(null),trigger=useRef<HTMLButtonElement|null>(null);
 const display=useSyncExternalStore(subscribeDisplay,getDisplay);
 const entries=useMemo(()=>textbookEntries.filter(e=>e.book===book),[book]);
 const pages=useMemo(()=>[...new Set(entries.map(e=>e.page))].sort(compareBookPages),[entries]);
 const locations=useMemo(()=>entries.filter(e=>!e.workedExampleId && !invalid && start && inRange(e.page,start,end)),[entries,start,end,invalid]);
 const byId=useMemo(()=>new Map(items.map(item=>[item.id,item])),[items]);
 const matched=useMemo(()=>{
  const seen=new Set<string>();
  return locations.flatMap(e=>{
   const key=textbookSelectionKey(e),item=byId.get(textbookStudyId(e));
   if(!item||!e.sourceId||seen.has(key))return [];
   seen.add(key);return [item];
  });
 },[locations,byId]);
 const columns=useMemo(()=>{
  const rows=entries.filter(e=>e.page===start&&!e.workedExampleId);
  return [0,1].map(col=>rows.flatMap((entry,i)=>(entry.column??Number(i>=Math.ceil(rows.length/2)))===col?
    [{entry,item:byId.get(textbookStudyId(entry)),direct:entry.directSourceId?directById.get(entry.directSourceId):undefined}]:[]));
 },[entries,start,byId]);
 const examples=useMemo(()=>textbookWorkedExamples.filter(e=>e.book===book && e.pages.some(page=>inRange(page,start,end))),[book,start,end]);
 const audit=end?undefined:textbookPageAudit(book,start);
 const auditRows=useMemo(()=>visited?textbookAuditPages.filter(r=>r.page.includes(normalizeBookPage(auditSearch))).sort((a,b)=>compareBookPages(a.page,b.page)):[],[auditSearch,visited]);
 const round=book==='hansol' && start ? latest.find(n=>compareBookPages(start,n.from!)>=0 && compareBookPages(end||start,n.to!)<=0):undefined;
 const [starting,setStarting]=useState(false);
 async function startSession(start:()=>Promise<void>){
  setStarting(true);
  try {await start();} finally {setStarting(false);}
 }
 const close=()=>dialog.current?.close();
 function update(next:BookSelection){saveBookSelection(book,next);setSelection(next);close();window.scrollTo({top:0,behavior:'instant'});}
 function jump(from:string,to=''){update({from,to,contentsId:'',contentsLabel:''});}
 useEffect(()=>{
  function turn(event:KeyboardEvent){
   const step=pageNavigationStep(event);
   if(starting||!step||p.loading||p.error||dialog.current?.open)return;
   const next=adjacentBookPage(book,start,step);
   if(next){event.preventDefault();jump(next);}
  }
  window.addEventListener('keydown',turn);
  return ()=>window.removeEventListener('keydown',turn);
 },[book,start,starting,p.loading,p.error]);
 function selectRow(row:ContentsRow){
  const ready=readableBookPages(book,row.node.from||'',row.node.to||'',row.entries,new Set(byId.keys()));
  const from=ready[0]?.page||row.node.from||'',to=row.node.to||ready.at(-1)?.page||'';
  update({from,to:to===from?'':to,contentsId:row.node.id,contentsLabel:[...row.path.slice(1),row.node.title].join(' › ')});
 }
 function changeTab(next:NavigationTab){setTab(next);if(next==='pages'){setDraftFrom(start);setDraftTo(end);}}
 function openNavigator(next:NavigationTab='contents'){setVisited(true);setDraftFrom(start);setDraftTo(end);setTab(next);dialog.current?.showModal();}
 const validPage=(value:string)=>book==='hansol'?/^[1-9]\d*-[1-9]\d*$/.test(value):/^[1-9]\d*$/.test(value)&&Number(value)<=645;
 const fromPage=normalizeBookPage(draftFrom),toPage=normalizeBookPage(draftTo);
 const draftInvalid=!validPage(fromPage)||!!toPage&&(!validPage(toPage)||compareBookPages(fromPage,toPage)>0);
 if(starting)return <p className="library-note" role="status">선택한 문제를 여는 중…</p>;
 return <section className="textbook-pages" aria-label="교재 전용 풀이"><div data-react-view="textbook-reader" style={{display:'contents'}}>
  <BookSurface book={book} start={start} end={end} title={selection.contentsLabel} loading={p.loading} error={p.error} invalid={invalid} matched={matched.length}
   fullRound={round?.roundBankId?{title:round.title,open:()=>void startSession(()=>p.onRound(round.roundBankId!))}:undefined}
   directCount={locations.filter(e=>e.directSourceId).length} pending={locations.filter(e=>!e.directSourceId&&!byId.has(textbookStudyId(e))).length}
   hasLocations={!!locations.length} reference={end?undefined:textbookReferencePage(book,start)} audited={!!audit} examples={examples} columns={columns}
   previous={!!adjacentBookPage(book,start,-1)} next={!!adjacentBookPage(book,start,1)} original={p.restoredImageTheme==='original'} showText={display!=='image'}
   answers={answers} saveDirect={(id,choice)=>{saveTextbookAnswer(studyStore.progress ||= {},id,choice);persistStudyStoreNow();}}
   renderLinked={(item,number)=><QuestionCard {...{item,presentation:'book',mode:'learn',bookmarked:records.bookmarks.includes(item.id),selected:answers[item.id],displayNumber:number,answerLayout:p.answerLayout,imageAnswerMode:p.answerLayout==='hotspot'?'hotspot':'buttons',hotspotIndicator:p.hotspotIndicator,restoredImageTheme:p.restoredImageTheme,onChoose:(choice:number)=>p.onChoose(item,choice),onToggleBookmark:()=>p.onBookmark(item),onAskAi:()=>p.onAi(item)}}/>}
   openNavigator={openNavigator} navigationRef={el=>{trigger.current=el;}} close={p.onClose} calculator={p.onCalculator} settings={p.onSettings} retry={p.onRetry}
   play={mode=>{if(!invalid&&!p.loading&&matched.length)void startSession(()=>p.onStart({items:matched,mode,label:textbookNames[book]+' '+start+(end?'~'+end:'')+'쪽'+(selection.contentsLabel?' · '+selection.contentsLabel:'')}));}}
   go={delta=>{const next=adjacentBookPage(book,start,delta);if(next)jump(next);}}
   navigator={{book,start,tab,visited,draftFrom,draftTo,invalid:draftInvalid,pages,selectedPages:[...new Set(locations.map(e=>e.page))],
    detected:audit?.detectedPositions,auditSearch,auditRows:auditRows.slice(0,auditLimit),hasMore:auditRows.length>auditLimit,
    changeTab,changeBook:p.onBook,changeFrom:setDraftFrom,changeTo:setDraftTo,changeSearch:value=>{setAuditSearch(value);setAuditLimit(80);},
    more:()=>setAuditLimit(n=>n+80),apply:()=>{if(!draftInvalid)jump(fromPage,toPage);},select:jump,close,afterClose:()=>trigger.current?.focus({preventScroll:true}),
    dialogRef:el=>{dialog.current=el;},contents:visited?<ContentsTree key={book} book={book} items={items} selected={selection.contentsId} onSelect={selectRow}/>:undefined}}/>
 </div></section>;
}
