<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { QuestionItem, StudyMode } from './types';
import QuestionCard from './QuestionCard.vue';
import { adjacentBookPage, compareBookPages, normalizeBookPage, textbookEntries, textbookNames, textbookStudyId, type TextbookKey } from './textbookPages';
const props=defineProps<{ book:TextbookKey; items:QuestionItem[]; answers:Record<string,number>; loading:boolean; error:string; answerLayout:'classic'|'inline'|'hotspot'; hotspotIndicator:'marker'|'area'; restoredImageTheme:'auto'|'original' }>();
const emit=defineEmits<{ book:[book:TextbookKey]; retry:[]; choose:[item:QuestionItem,choice:number]; bookmark:[item:QuestionItem]; ai:[item:QuestionItem]; start:[payload:{items:QuestionItem[];mode:StudyMode;label:string}] }>();
const preferenceKey='cbt-textbook-pages-v1';
function saved(){try{return JSON.parse(localStorage.getItem(preferenceKey)||'{}');}catch{return {};}}
const from=ref('');const to=ref('');
function restore(){const s=saved()[props.book];from.value=typeof s?.from==='string'?s.from:props.book==='hansol'?'4-10':'442';to.value=typeof s?.to==='string'?s.to:'';}
restore();watch(()=>props.book,restore);
watch([from,to],()=>{try{localStorage.setItem(preferenceKey,JSON.stringify({...saved(),[props.book]:{from:from.value,to:to.value}}));}catch{}});
const entries=computed(()=>textbookEntries.filter(e=>e.book===props.book));
const pages=computed(()=>[...new Set(entries.value.map(e=>e.page))].sort(compareBookPages));
const start=computed(()=>normalizeBookPage(from.value));const end=computed(()=>normalizeBookPage(to.value));
const invalid=computed(()=>!!end.value&&compareBookPages(start.value,end.value)>0);
const locations=computed(()=>!start.value||invalid.value?[]:entries.value.filter(e=>end.value
 ? compareBookPages(e.page,start.value)>=0&&compareBookPages(e.page,end.value)<=0:e.page===start.value));
const matched=computed(()=>{
 const map=new Map(props.items.map(i=>[i.id,i]));const seen=new Set<string>();
 return locations.value.flatMap(e=>{const item=map.get(textbookStudyId(e));if(!item||!e.sourceId||seen.has(e.sourceId))return [];seen.add(e.sourceId);return [item];});
});
const pending=computed(()=>locations.value.filter(e=>!props.items.some(i=>i.id===textbookStudyId(e))).length);
const selectedPages=computed(()=>[...new Set(locations.value.map(e=>e.page))].sort(compareBookPages));
const label=computed(()=>`${textbookNames[props.book]} ${start.value}${end.value?`~${end.value}`:''}쪽`);
function go(delta:number){const next=adjacentBookPage(props.book,start.value,delta);if(next){from.value=next;to.value='';}}
function choose(page:string){from.value=page;to.value='';}
function play(mode:StudyMode){if(!props.loading&&!invalid.value&&matched.value.length)emit('start',{items:matched.value,mode,label:label.value});}
const pageColumns=computed(()=>{
 const rows=entries.value.filter(e=>e.page===start.value);
 const map=new Map(props.items.map(i=>[i.id,i]));
 const cutoff=Math.ceil(rows.length/2);
 return [0,1].map(column=>rows.flatMap((e,index)=>{
  if((e.column??(index<cutoff?0:1))!==column)return [];
  return [{entry:e,item:map.get(textbookStudyId(e))}];
 }));
});
</script>

<template>
 <section class="textbook-pages">
  <header><span>수업 시간에 지정한 쪽으로 바로 풀기</span><h1>교재 페이지별 문제</h1><p>책에 인쇄된 쪽번호를 사용합니다. 한솔의 <b>4-10</b>은 4~10쪽 범위가 아닌 한 페이지입니다.</p></header>
  <div class="book-tabs" aria-label="교재 선택">
   <button v-for="(name,key) in textbookNames" :key="key" :aria-pressed="book===key" @click="emit('book',key)">{{name}}</button>
  </div>
  <form class="page-picker" @submit.prevent>
   <label>시작 쪽<input v-model="from" :list="`book-pages-${book}`" :placeholder="book==='hansol'?'예: 4-10':'예: 442'" autocomplete="off"></label>
   <label>끝 쪽 <small>여러 페이지를 풀 때만</small><input v-model="to" :list="`book-pages-${book}`" placeholder="한 페이지만 풀면 비워 두세요" autocomplete="off"></label>
   <datalist :id="`book-pages-${book}`"><option v-for="page in pages" :key="page" :value="page"/></datalist>
   <button type="button" :disabled="!adjacentBookPage(book,start,-1)" @click="go(-1)">← 이전 쪽</button>
   <button type="button" :disabled="!adjacentBookPage(book,start,1)" @click="go(1)">다음 쪽 →</button>
  </form>
  <p v-if="invalid" role="alert">끝 쪽은 시작 쪽보다 뒤여야 합니다. 한 페이지는 시작 쪽만 입력하세요.</p>
  <p v-if="loading" role="status">교재에 연결된 원문을 불러오는 중…</p>
  <p v-else-if="error" role="alert">{{error}} <button @click="emit('retry')">다시 불러오기</button></p>
  <template v-else>
   <div class="book-page-result" aria-live="polite"><h2>{{label}}</h2><p>풀 수 있는 문제 <strong>{{matched.length}}개</strong><template v-if="pending"> · 추가 대조 {{pending}}위치</template></p>
    <p v-if="!locations.length">이 쪽은 아직 문제 연결을 확인하지 않았습니다. 교재에 문제가 없다는 뜻은 아닙니다.</p>
    <p v-else-if="pending">보기·수치·정답이 다르거나 연결하지 못한 위치는 출제하지 않습니다.</p>
    <div class="book-play"><button :disabled="!matched.length||invalid" @click="play('learn')">범위를 모아 일반 학습</button><button :disabled="!matched.length||invalid" @click="play('exam')">범위를 모아 CBT 시험</button></div>
   </div>
   <article class="book-sheet" :key="`${book}-${start}`" aria-label="교재 페이지 풀이">
    <header><strong>{{textbookNames[book]}}</strong><span>{{start}}쪽</span></header>
    <div class="book-sheet-columns">
     <div v-for="(column,index) in pageColumns" :key="index" class="book-sheet-column">
      <section v-for="row in column" :key="row.entry.number" class="book-sheet-question">
       <h3>교재 {{row.entry.number}}번</h3>
       <QuestionCard v-if="row.item" :item="row.item" mode="learn" :selected="answers[row.item.id]" :display-number="row.entry.number" :answer-layout="answerLayout" :image-answer-mode="answerLayout==='hotspot'?'hotspot':'buttons'" :hotspot-indicator="hotspotIndicator" :restored-image-theme="restoredImageTheme" @choose="emit('choose',row.item!,$event)" @toggle-bookmark="emit('bookmark',row.item!)" @ask-ai="emit('ai',row.item!)"/>
       <p v-else class="book-pending">이 위치는 원문 연결을 추가 확인 중입니다. 다른 문제로 임의 대체하지 않습니다.</p>
      </section>
     </div>
    </div>
    <p v-if="!pageColumns.some(c=>c.length)" class="book-pending">아직 대조하지 않은 쪽입니다.</p>
    <footer><button :disabled="!adjacentBookPage(book,start,-1)" @click="go(-1)">← 이전 쪽</button><strong>{{start}}</strong><button :disabled="!adjacentBookPage(book,start,1)" @click="go(1)">다음 쪽 →</button></footer>
   </article>
  </template>
  <details><summary>등록된 쪽에서 고르기 · {{pages.length}}쪽</summary><div class="registered-book-pages"><button v-for="page in pages" :key="page" :aria-pressed="selectedPages.includes(page)" @click="choose(page)">{{page}}</button></div></details>
  <p class="book-coverage">전체 교재를 대상으로 연결을 진행 중입니다. 아직 모든 페이지의 연결이 끝난 상태는 아닙니다. 대조하지 않은 쪽과 연결하지 못한 문항도 구분합니다. 원문 기출 이미지 안의 번호는 교재 번호와 다를 수 있으며, 위의 ‘교재 ○번’이 책의 번호입니다. 좌우 열이 확인된 페이지는 그 배치를 따르고 나머지는 읽기 순서로 나눕니다. 페이지 선택은 이 기기에 저장하며 풀이 기록은 일반 기출·중간고사와 따로 저장합니다.</p>
 </section>
</template>

<style scoped>
.textbook-pages{max-width:1500px;margin:0 auto;display:grid;gap:18px;color:var(--text,#dce7f5)}
header h1{font-size:clamp(24px,3vw,34px);margin:8px 0}header p,.book-coverage{line-height:1.65}.book-tabs,.page-picker,.book-play{display:flex;gap:12px;flex-wrap:wrap}
button,input{font:inherit;color:inherit;border:1px solid var(--line,#536780);border-radius:10px;background:var(--surface,#172537);padding:12px 16px;min-height:46px}button{cursor:pointer}button:disabled{opacity:.45;cursor:default}button[aria-pressed=true],.book-play button:first-child{border-color:var(--primary,#568de0);background:var(--primary-2,#2563a2);color:white}
.page-picker label{display:grid;gap:8px;flex:1 1 240px}.page-picker small{font-size:.85em}.page-picker input{width:100%;box-sizing:border-box}.page-picker>button{align-self:end}.book-page-result{border:1px solid var(--line,#536780);border-radius:14px;padding:20px;background:var(--surface,#172537)}.book-page-result h2{margin:0 0 10px;font-size:22px}small{opacity:.8}.registered-book-pages{display:flex;flex-wrap:wrap;gap:8px;max-height:320px;overflow:auto;margin-top:14px}.registered-book-pages button{padding:8px 12px}.book-coverage{font-size:14px;opacity:.8}summary{cursor:pointer;padding:12px 0}
@media(max-width:600px){.page-picker>button,.book-play button{flex:1 1 130px}.book-question-links li{flex-direction:column}.book-tabs button{flex:1}.book-page-result{padding:14px}}
.book-sheet{border:1px solid var(--line,#536780);border-radius:3px;background:var(--surface,#fff);padding:24px;box-shadow:0 6px 24px #0000000d;animation:book-page-in .18s ease-out}.book-sheet>header,.book-sheet>footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0}.book-sheet>header{border-bottom:2px solid var(--primary,#568de0)}.book-sheet>footer{border-top:1px solid var(--line,#536780)}.book-sheet-columns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:32px;padding:20px 0}.book-sheet-column{min-width:0}.book-sheet-column+div{border-left:1px dashed var(--line,#536780);padding-left:24px}.book-sheet-question{break-inside:avoid;margin-bottom:24px}.book-sheet-question h3{font-size:20px;margin:0 0 10px;color:var(--primary)}.book-sheet :deep(.question-card){box-shadow:none;border:0;padding:0;background:transparent}.book-pending{padding:20px;line-height:1.7;background:var(--surface-2,#172537)}
@keyframes book-page-in{from{opacity:.5;transform:translateX(8px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.book-sheet{animation:none}}
@media(max-width:900px){.book-sheet-columns{grid-template-columns:minmax(0,1fr);gap:0}.book-sheet-column+div{padding-left:0;border-left:0}.book-sheet{padding:14px}}
</style>
