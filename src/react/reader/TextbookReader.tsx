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
import {adjacentBookPage, compareBookPages, normalizeBookPage, readableBookPages, textbookDirectSources, textbookEntries, textbookNames, textbookReferencePage, textbookSelectionKey, textbookStudyId, textbookWorkedExamples, type TextbookKey} from '../../cbt/textbookPages';
import {pageNavigationStep} from '../../cbt/pageNavigationKey';
import {questionSubject,subjectLabel} from '../../cbt/printedSubject';
import {energyPool} from '../../cbt/energyFinal';
import {emptyBookPracticeFilters,filterBookPractice} from '../../cbt/textbookPracticeFilters';
import {BookPracticeFilterControls} from '../BookPracticeFilterControls';
import {StudyChoiceOverlay} from '../StudyChoiceOverlay';
import {bindMacHorizontalSwipe,blockedStudyKey} from '../../cbt/studyGestures';
import {showStudyOverlay} from '../../cbt/studyOverlayHistory';
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
 const [paper,setPaper]=useState('');
 const [filters,setFilters]=useState(emptyBookPracticeFilters);
 const energyPapers=useMemo(()=>{
   const groups=new Map<string,QuestionItem[]>();
   if(book==='energy')for(const i of energyPool(items.filter(i=>i.round.id.startsWith('textbook-energy-')),false,false)){
     const name=subjectLabel(questionSubject(i));
     if(!groups.has(name))groups.set(name,[]);groups.get(name)!.push(i);
   }
   return [...groups].sort(([a],[b])=>a.localeCompare(b,'ko'));
 },[book,items]);
 const paperPools=useMemo(()=>energyPapers.map(([name,list])=>[name,filterBookPractice(list,filters)] as const),[energyPapers,filters]);
 const selectedPaper=paperPools.find(([name])=>name===paper);
 const records=useSnapshot(studyStore);
 const answers=textbookAnswersIn(records.progress || {});
 const [selectedBook,setSelectedBook]=useState(book);
 const [selection,setSelection]=useState(()=>readBookSelection(book));
 const start=normalizeBookPage(selection.from), end=normalizeBookPage(selection.to);
 const invalid=!!end && compareBookPages(start,end)>0;
 const [tab,setTab]=useState<NavigationTab>('contents'),[visited,setVisited]=useState(false);
 const [draftFrom,setDraftFrom]=useState(''),[draftTo,setDraftTo]=useState('');
 if(selectedBook!==book){
  const saved=readBookSelection(book);
  setSelectedBook(book);setSelection(saved);setDraftFrom(saved.from);setDraftTo(saved.to);setPaper('');setFilters(emptyBookPracticeFilters);
 }
 const dialog=useRef<HTMLDialogElement|null>(null),trigger=useRef<HTMLButtonElement|null>(null);
 const root=useRef<HTMLElement>(null);
 const [active,setActive]=useState('');
 const display=useSyncExternalStore(subscribeDisplay,getDisplay);
 const entries=useMemo(()=>textbookEntries.filter(e=>e.book===book),[book]);
 const pages=useMemo(()=>[...new Set(entries.map(e=>e.page))].sort(compareBookPages),[entries]);
 const chapterIndex=useMemo(()=>{
  const eligible=new Set(entries.filter(entry=>entry.directSourceId || (entry.sourceId && !entry.reviewHold)).map(entry=>entry.page));
  for(const example of textbookWorkedExamples) if(example.book===book) for(const page of example.pages) eligible.add(page);
  const ordered=[...eligible].sort(compareBookPages);
  return bookContents[book].map(part=>({title:part.title,tabs:(part.children || []).flatMap(node=>{
    if(!node.from)return [];
    const from=node.from;
    const page=ordered.find(p=>(!node.prefix || p.startsWith(node.prefix)) && compareBookPages(p,from)>=0 && (!node.to || compareBookPages(p,node.to)<=0));
    return page ? [{id:node.id,title:node.title,page,from,to:node.to,prefix:node.prefix}] : [];
  })})).filter(part=>part.tabs.length);
 },[book,entries]);
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
 const playable=useMemo(()=>filterBookPractice(matched,filters),[matched,filters]);
 const columns=useMemo(()=>{
  const rows=entries.filter(e=>e.page===start&&!e.workedExampleId);
  return [0,1].map(col=>rows.flatMap((entry,i)=>(entry.column??Number(i>=Math.ceil(rows.length/2)))===col?
    [{entry,item:byId.get(textbookStudyId(entry)),direct:entry.directSourceId?directById.get(entry.directSourceId):undefined}]:[]));
 },[entries,start,byId]);
 const examples=useMemo(()=>textbookWorkedExamples.filter(e=>e.book===book && e.pages.some(page=>inRange(page,start,end))),[book,start,end]);
 const round=book==='hansol' && start ? latest.find(n=>compareBookPages(start,n.from!)>=0 && compareBookPages(end||start,n.to!)<=0):undefined;
 const [starting,setStarting]=useState(false);
 async function startSession(start:()=>Promise<void>){
  setStarting(true);
  try {await start();} finally {setStarting(false);}
 }
 const close=()=>dialog.current?.close();
 function update(next:BookSelection){saveBookSelection(book,next);setSelection(next);close();window.scrollTo({top:0,behavior:'instant'});}
 function jump(from:string,to=''){update({from,to,contentsId:'',contentsLabel:''});}
 useEffect(()=>{setActive('');},[book,start]);
 useEffect(()=>{
  function turn(event:KeyboardEvent){
   if(active&&root.current&&/^[1-4]$/.test(event.key)&&!starting&&!p.loading&&!p.error&&!blockedStudyKey(event)){
     const item=byId.get(active), card=root.current.querySelector<HTMLElement>('[data-source-id="'+CSS.escape(active)+'"]');
     const n=Number(event.key);
     if(item&&n<=item.question.choices.length||card){
       event.preventDefault();
       if(item)p.onChoose(item,n);else card?.querySelectorAll<HTMLButtonElement>('.direct-choices button')[n-1]?.click();
       return;
     }
   }
   const step=pageNavigationStep(event);
   if(starting||!step||p.loading||p.error||dialog.current?.open)return;
   const next=adjacentBookPage(book,start,step);
   if(next){event.preventDefault();jump(next);}
  }
  window.addEventListener('keydown',turn);
  return ()=>window.removeEventListener('keydown',turn);
 },[active,byId,book,start,starting,p.loading,p.error,p.onChoose]);
 useEffect(()=>{
   const surface=root.current?.querySelector<HTMLElement>('.reader-main');
   if(!surface||starting||p.loading||p.error)return;
   return bindMacHorizontalSwipe(surface,step=>!!adjacentBookPage(book,start,step),step=>{
     const next=adjacentBookPage(book,start,step);if(next)jump(next);
   });
 },[book,start,starting,p.loading,p.error]);
 function selectRow(row:ContentsRow){
  const ready=readableBookPages(book,row.node.from||'',row.node.to||'',row.entries,new Set(byId.keys()));
  const from=ready[0]?.page||row.node.from||'',to=row.node.to||ready.at(-1)?.page||'';
  update({from,to:to===from?'':to,contentsId:row.node.id,contentsLabel:[...row.path.slice(1),row.node.title].join(' › ')});
 }
 function changeTab(next:NavigationTab){setTab(next);if(next==='pages'){setDraftFrom(start);setDraftTo(end);}}
 function openNavigator(next:NavigationTab='contents'){setVisited(true);setDraftFrom(start);setDraftTo(end);setTab(next);showStudyOverlay(dialog.current);}
 const validPage=(value:string)=>book==='hansol'?/^[1-9]\d*-[1-9]\d*$/.test(value):/^[1-9]\d*$/.test(value)&&Number(value)<=645;
 const fromPage=normalizeBookPage(draftFrom),toPage=normalizeBookPage(draftTo);
 const draftInvalid=!validPage(fromPage)||!!toPage&&(!validPage(toPage)||compareBookPages(fromPage,toPage)>0);
 if(starting)return <p className="library-note" role="status">선택한 문제를 여는 중…</p>;
 return <section ref={root} className="textbook-pages" aria-label="교재 전용 풀이"
  onPointerDown={e=>{if(e.target instanceof Element){
    const direct=e.target.closest<HTMLElement>('[data-source-id]');
    root.current?.querySelectorAll('.book-direct-question.keyboard-active').forEach(el=>el.classList.remove('keyboard-active'));
    if(direct?.dataset.sourceId){setActive(direct.dataset.sourceId);direct.classList.add('keyboard-active');}
    else if(!e.target.closest('.book-linked-question'))setActive('');
  }}}><div data-react-view="textbook-reader" style={{display:'contents'}}>
  <BookSurface chapterIndex={<>{!p.loading&&<details className="final-tool"><summary>범위 풀이 설정</summary><BookPracticeFilterControls value={filters} onChange={setFilters}/></details>}{book==='energy'&&!p.loading&&paperPools.length>0&&<details className="final-tool"><summary>에너지 교재 · 과목만 풀기</summary>
    <div className="final-inline"><StudyChoiceOverlay title="풀이 과목" value={paper} choices={[{value:'',label:'과목 선택'},...paperPools.map(([name,list])=>({value:name,label:name,hint:list.length+'문제'}))]} onSelect={setPaper}/>
    {(['learn','exam'] as const).map(mode=><button key={mode} disabled={!selectedPaper?.[1].length} onClick={()=>{if(selectedPaper)void startSession(()=>p.onStart({items:selectedPaper[1],mode,label:'에너지설비 교재 · '+paper}));}}>{mode==='learn'?'학습모드':'CBT 시험모드'}</button>)}</div></details>}
    <details className="book-edge-index"><summary>단원 색인</summary>
    <nav aria-label="교재 단원 바로가기">{chapterIndex.map(part=><section key={part.title}><strong>{part.title}</strong>
      <div>{part.tabs.map(tab=><button key={tab.id} type="button"
        aria-current={(!tab.prefix || start.startsWith(tab.prefix)) && compareBookPages(start,tab.from)>=0 && (!tab.to || compareBookPages(start,tab.to)<=0) ? 'location' : undefined}
        onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');jump(tab.page);
          document.querySelector<HTMLElement>('.book-edge-index>summary')?.focus({preventScroll:true});}}>
          {tab.title}<small>{tab.page}쪽</small></button>)}</div></section>)}</nav></details></>} book={book} start={start} end={end} title={selection.contentsLabel} loading={p.loading} error={p.error} invalid={invalid} matched={playable.length} excluded={matched.length-playable.length}
   fullRound={round?.roundBankId?{title:round.title,open:()=>void startSession(()=>p.onRound(round.roundBankId!))}:undefined}
   directCount={locations.filter(e=>e.directSourceId).length} pending={locations.filter(e=>!e.directSourceId&&!byId.has(textbookStudyId(e))).length}
   hasLocations={!!locations.length} reference={end?undefined:textbookReferencePage(book,start)} examples={examples} columns={columns}
   previous={!!adjacentBookPage(book,start,-1)} next={!!adjacentBookPage(book,start,1)} original={p.restoredImageTheme==='original'} showText={display!=='image'}
   answers={answers} saveDirect={(id,choice)=>{saveTextbookAnswer(studyStore.progress ||= {},id,choice);persistStudyStoreNow();}}
   renderLinked={(item,number)=><QuestionCard {...{item,presentation:'book',mode:'learn',active:active===item.id,onActivate:()=>setActive(item.id),bookmarked:records.bookmarks.includes(item.id),selected:answers[item.id],displayNumber:number,answerLayout:p.answerLayout,imageAnswerMode:p.answerLayout==='hotspot'?'hotspot':'buttons',hotspotIndicator:p.hotspotIndicator,restoredImageTheme:p.restoredImageTheme,onChoose:(choice:number)=>p.onChoose(item,choice),onToggleBookmark:()=>p.onBookmark(item),onAskAi:()=>p.onAi(item)}}/>}
   openNavigator={openNavigator} navigationRef={el=>{trigger.current=el;}} close={p.onClose} calculator={p.onCalculator} settings={p.onSettings} retry={p.onRetry}
   play={mode=>{if(!invalid&&!p.loading&&playable.length)void startSession(()=>p.onStart({items:playable,mode,label:textbookNames[book]+' '+start+(end?'~'+end:'')+'쪽'+(selection.contentsLabel?' · '+selection.contentsLabel:'')}));}}
   go={delta=>{const next=adjacentBookPage(book,start,delta);if(next)jump(next);}}
   navigator={{book,start,tab,visited,draftFrom,draftTo,invalid:draftInvalid,pages,selectedPages:[...new Set(locations.map(e=>e.page))],
    changeTab,changeBook:p.onBook,changeFrom:setDraftFrom,changeTo:setDraftTo,
    apply:()=>{if(!draftInvalid)jump(fromPage,toPage);},select:jump,close,afterClose:()=>trigger.current?.focus({preventScroll:true}),
    dialogRef:el=>{dialog.current=el;},contents:visited?<ContentsTree key={book} book={book} items={items} selected={selection.contentsId} onSelect={selectRow}/>:undefined}}/>
 </div></section>;
}
