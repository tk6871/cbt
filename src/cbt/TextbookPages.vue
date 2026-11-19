<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount, shallowReactive, getCurrentInstance } from 'vue';
import type { QuestionItem, StudyMode } from './types';
import QuestionCard from './QuestionCard.vue';
import {createRoot,type Root} from 'react-dom/client';
import {createElement} from 'react';
import {VueAppContext} from '../react/VueChild';
import type {NavigationTab,NavigatorProps} from '../react/reader/BookNavigator';
import {saveTextbookAnswer} from './textbookAnswerProgress';
import {studyStore, persistStudyStoreNow} from './storage';
import {BookSurface,type BookSurfaceProps} from '../react/reader/BookSurface';
import {explanationDisplay} from './explanationDisplay';
import TextbookContents from './TextbookContents.vue';
import {bookContents,type ContentsRow} from './textbookContents';
import {readBookSelection,saveBookSelection} from './textbookReaderState';
import { readableBookPages, adjacentBookPage, compareBookPages, normalizeBookPage, textbookEntries, textbookNames, textbookStudyId, textbookSelectionKey, textbookReferencePage, textbookWorkedExamples, textbookPageAudit, textbookAuditPages, textbookDirectSources, type TextbookKey } from './textbookPages';
const props=defineProps<{ book:TextbookKey; items:QuestionItem[]; answers:Record<string,number>; bookmarkedIds?:string[]; loading:boolean; error:string; answerLayout:'classic'|'inline'|'hotspot'; hotspotIndicator:'marker'|'area'; restoredImageTheme:'auto'|'original' }>();
const emit=defineEmits<{ round:[id:string]; close:[]; settings:[]; calculator:[]; book:[book:TextbookKey]; retry:[]; choose:[item:QuestionItem,choice:number]; bookmark:[item:QuestionItem]; ai:[item:QuestionItem]; start:[payload:{items:QuestionItem[];mode:StudyMode;label:string}] }>();
const from=ref('');const to=ref('');
const auditSearch=ref(''),auditLimit=ref(80);
const auditRows=computed(()=>textbookAuditPages.filter(row=>row.page.includes(normalizeBookPage(auditSearch.value))).sort((a,b)=>compareBookPages(a.page,b.page)));
watch(auditSearch,()=>auditLimit.value=80);
const contentsId=ref(''),contentsLabel=ref('');const contentsWrap=ref<HTMLElement|null>(null);
const navigator=ref<HTMLDialogElement|null>(null),navigatorTrigger=ref<HTMLButtonElement|null>(null);
const navigatorVisited=ref(false);
const navigatorTab=ref<'contents'|'pages'|'info'>('contents'),draftFrom=ref(''),draftTo=ref('');
function validPage(value:string){const page=normalizeBookPage(value);return props.book==='hansol'?/^[1-9]\d*-[1-9]\d*$/.test(page):/^[1-9]\d*$/.test(page)&&Number(page)<=645;}
const draftInvalid=computed(()=>!validPage(draftFrom.value)||!!normalizeBookPage(draftTo.value)&&(!validPage(draftTo.value)||compareBookPages(normalizeBookPage(draftFrom.value),normalizeBookPage(draftTo.value))>0));
function openNavigator(tab:'contents'|'pages'|'info'='contents'){
 navigatorVisited.value=true;
 navigatorTab.value=tab;draftFrom.value=from.value;draftTo.value=to.value;
 navigator.value?.showModal();
}
function closeNavigator(){navigator.value?.close();}
function afterNavigatorClosed(){navigatorTrigger.value?.focus({preventScroll:true});}
async function scrollToSheet(){await nextTick();window.scrollTo({top:0,behavior:'instant'});}
function applyPages(){if(draftInvalid.value)return;from.value=normalizeBookPage(draftFrom.value);to.value=normalizeBookPage(draftTo.value);clearContents();closeNavigator();void scrollToSheet();}
function selectPage(page:string){choose(page);closeNavigator();void scrollToSheet();}
function restore(){const s=readBookSelection(props.book);from.value=s.from;to.value=s.to;contentsId.value=s.contentsId;contentsLabel.value=s.contentsLabel;}
restore();watch(()=>props.book,()=>{restore();draftFrom.value=from.value;draftTo.value=to.value;});
watch([from,to,contentsId,contentsLabel],()=>saveBookSelection(props.book,{from:from.value,to:to.value,contentsId:contentsId.value,contentsLabel:contentsLabel.value}));
const entries=computed(()=>textbookEntries.filter(e=>e.book===props.book));
const pages=computed(()=>[...new Set(entries.value.map(e=>e.page))].sort(compareBookPages));
const start=computed(()=>normalizeBookPage(from.value));const end=computed(()=>normalizeBookPage(to.value));
const referencePage=computed(()=>!end.value?textbookReferencePage(props.book,start.value):undefined);
const audit=computed(()=>!end.value?textbookPageAudit(props.book,start.value):undefined);
const invalid=computed(()=>!!end.value&&compareBookPages(start.value,end.value)>0);
const examples=computed(()=>textbookWorkedExamples.filter(e=>e.book===props.book&&e.pages.some(page=>end.value?compareBookPages(page,start.value)>=0&&compareBookPages(page,end.value)<=0:page===start.value)));
const locations=computed(()=>!start.value||invalid.value?[]:entries.value.filter(e=>!e.workedExampleId&&(end.value
 ? compareBookPages(e.page,start.value)>=0&&compareBookPages(e.page,end.value)<=0:e.page===start.value)));
const itemById=computed(()=>new Map(props.items.map(i=>[i.id,i])));
const matched=computed(()=>{
 const map=itemById.value;const seen=new Set<string>();
  return locations.value.flatMap(e=>{const item=map.get(textbookStudyId(e));const key=textbookSelectionKey(e);if(!item||!e.sourceId||seen.has(key))return [];seen.add(key);return [item];});
});
const directById=new Map(textbookDirectSources.map(r=>[r.id,r]));
const directCount=computed(()=>locations.value.filter(e=>e.directSourceId).length);
const pending=computed(()=>locations.value.filter(e=>!e.directSourceId&&!itemById.value.has(textbookStudyId(e))).length);
const selectedPages=computed(()=>[...new Set(locations.value.map(e=>e.page))].sort(compareBookPages));
const label=computed(()=>`${textbookNames[props.book]} ${start.value}${end.value?`~${end.value}`:''}쪽${contentsLabel.value?` · ${contentsLabel.value}`:''}`);
function clearContents(){contentsId.value='';contentsLabel.value='';}
function go(delta:number){const next=adjacentBookPage(props.book,start.value,delta);if(next){from.value=next;to.value='';clearContents();void scrollToSheet();}}
function choose(page:string){from.value=page;to.value='';clearContents();}
async function selectContents(row:ContentsRow){
 const ready=new Set(props.items.map(i=>i.id));
 const pages=readableBookPages(props.book,row.node.from||'',row.node.to||'',row.entries,ready).map(row=>row.page);
 from.value=pages[0]||row.node.from||'';
 const last=row.node.to||pages.at(-1);to.value=last&&last!==from.value?last:'';
 contentsId.value=row.node.id;contentsLabel.value=[...row.path.slice(1),row.node.title].join(' › ');
 closeNavigator();await scrollToSheet();
}
function play(mode:StudyMode){if(!props.loading&&!invalid.value&&matched.value.length)emit('start',{items:matched.value,mode,label:label.value});}
const pageColumns=computed(()=>{
 const rows=entries.value.filter(e=>e.page===start.value&&!e.workedExampleId);
 const map=itemById.value;
 const cutoff=Math.ceil(rows.length/2);
 return [0,1].map(column=>rows.flatMap((e,index)=>{
  if((e.column??(index<cutoff?0:1))!==column)return [];
  return [{entry:e,item:map.get(textbookStudyId(e)),direct:e.directSourceId?directById.get(e.directSourceId):undefined}];
 }));
});
const surfaceHost=ref<HTMLDivElement>();
const targets=shallowReactive(new Map<string,HTMLDivElement>());
const linkedRows=computed(()=>pageColumns.value.flat().flatMap(row=>row.item?[{item:row.item,number:row.entry.number}]:[]));
function register(id:string,element:HTMLDivElement|null){if(element)targets.set(id,element);else targets.delete(id);}
function navigationRef(node:HTMLButtonElement|null){navigatorTrigger.value=node;}
function dialogRef(el:HTMLDialogElement|null){navigator.value=el;}
function contentsRef(el:HTMLDivElement|null){contentsWrap.value=el;}
function changeTab(tab:NavigationTab){
 navigatorTab.value=tab;
 if(tab==='pages'){draftFrom.value=from.value;draftTo.value=to.value;}
}
const navigation=computed<NavigatorProps>(()=>({
 book:props.book,start:start.value,tab:navigatorTab.value,visited:navigatorVisited.value,
 draftFrom:draftFrom.value,draftTo:draftTo.value,invalid:draftInvalid.value,pages:pages.value,selectedPages:selectedPages.value,
 detected:audit.value?.detectedPositions,auditSearch:auditSearch.value,
 auditRows:navigatorVisited.value?auditRows.value.slice(0,auditLimit.value):[],hasMore:navigatorVisited.value&&auditRows.value.length>auditLimit.value,
 changeTab,changeBook:key=>emit('book',key),changeFrom:v=>{draftFrom.value=v;},changeTo:v=>{draftTo.value=v;},
 changeSearch:v=>{auditSearch.value=v;},more:()=>{auditLimit.value+=80;},apply:applyPages,select:selectPage,
 close:closeNavigator,afterClose:afterNavigatorClosed,dialogRef,contentsRef,
}));
// The appendix can be opened from the table of contents or by a printed page number.
const hansolAppendix=bookContents.hansol.find(node=>node.id==='hansol-latest')!.children!;
const fullRound=computed(()=>{
 if(props.book!=='hansol'||!start.value)return;
 const node=hansolAppendix.find(node=>compareBookPages(start.value,node.from!)>=0&&compareBookPages(end.value||start.value,node.to!)<=0);
 if(node?.roundBankId) return {title:node.title, open:()=>emit('round',node.roundBankId!)};
});
const surface=computed<BookSurfaceProps>(()=>({
 fullRound:fullRound.value,
 navigator:navigation.value,book:props.book,start:start.value,end:end.value,title:contentsLabel.value,loading:props.loading,error:props.error,invalid:invalid.value,
 matched:matched.value.length,directCount:directCount.value,pending:pending.value,hasLocations:!!locations.value.length,
 reference:referencePage.value,audited:!!audit.value,examples:examples.value,columns:pageColumns.value,
 original:props.restoredImageTheme==='original',showText:explanationDisplay.value!=='image',
 previous:!!adjacentBookPage(props.book,start.value,-1),next:!!adjacentBookPage(props.book,start.value,1),
 answers:props.answers, saveDirect:(id,choice)=>{saveTextbookAnswer(studyStore.progress ||= {},id,choice);persistStudyStoreNow();},
 register,navigationRef,openNavigator,close:()=>emit('close'),calculator:()=>emit('calculator'),settings:()=>emit('settings'),retry:()=>emit('retry'),play,go,
}));
let root:Root|undefined;
const appContext = getCurrentInstance()!.appContext;
function renderSurface(){
 root?.render(createElement(VueAppContext.Provider,{value:appContext},createElement(BookSurface,surface.value)));
}
onMounted(()=>{root=createRoot(surfaceHost.value!);renderSurface();});
watch(surface,renderSurface);
onBeforeUnmount(()=>root?.unmount());
</script>

<template>
 <section class="textbook-pages" aria-label="교재 전용 풀이">
  <div ref="surfaceHost" data-react-view="textbook-reader" style="display:contents"></div>
  <template v-for="row in linkedRows" :key="row.item.id">
   <Teleport v-if="targets.has(row.item.id)" :to="targets.get(row.item.id)!">
    <QuestionCard :item="row.item" presentation="book" mode="learn" :bookmarked="bookmarkedIds?.includes(row.item.id)"
     :selected="answers[row.item.id]" :display-number="row.number" :answer-layout="answerLayout"
     :image-answer-mode="answerLayout==='hotspot'?'hotspot':'buttons'" :hotspot-indicator="hotspotIndicator" :restored-image-theme="restoredImageTheme"
     @choose="emit('choose',row.item,$event)" @toggle-bookmark="emit('bookmark',row.item)" @ask-ai="emit('ai',row.item)"/>
   </Teleport>
  </template>
  <Teleport v-if="contentsWrap" :to="contentsWrap">
   <TextbookContents :book="book" :items="items" :selected="contentsId" @select="selectContents"/>
  </Teleport>
 </section>
</template>

<style src="../react/reader/reader.css"></style>
