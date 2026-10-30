<script setup lang="ts">
import {computed,ref,shallowRef,watch,onBeforeUnmount} from 'vue';
import type {QuestionItem} from './types';
import {textbookEntries,textbookStudyId,type TextbookKey} from './textbookPages';
import {bookContents,contentsRows,searchContents,type ContentsRow} from './textbookContents';
import BookContentsBranch from './BookContentsBranch.vue';
const props=defineProps<{book:TextbookKey;items:QuestionItem[];selected:string}>();
const emit=defineEmits<{select:[row:ContentsRow]}>();
const query=ref(''),debounced=ref(''),limit=ref(20),indexLoading=ref(false),indexError=ref(false);
const ocr=shallowRef<Record<string,string>>({});let revision=0,timer:ReturnType<typeof setTimeout>|undefined;
async function loadIndex(){const current=++revision;indexError.value=false;if(props.book!=='energy'||Object.keys(ocr.value).length)return;indexLoading.value=true;
 try{const data=await import('../../data/energy-textbook-search.json');if(current===revision)ocr.value=data.default.texts;}
 catch{if(current===revision)indexError.value=true;}finally{if(current===revision)indexLoading.value=false;}
}
watch(()=>props.book,()=>{query.value='';debounced.value='';indexLoading.value=false;void loadIndex();},{immediate:true});
watch(query,value=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>{debounced.value=value;limit.value=20;},180);});
onBeforeUnmount(()=>{revision++;if(timer)clearTimeout(timer);});
const itemMap=computed(()=>new Map(props.items.map(item=>[item.id,item])));
const text=computed(()=>{
 const result={...ocr.value};
 for(const e of textbookEntries){const item=itemMap.value.get(textbookStudyId(e));if(!item||!e.sourceId)continue;
  const q=item.question;result[e.sourceId]=[q.text,q.ocrText,...q.choices.map(c=>c.text||c.html),result[e.sourceId]].filter(Boolean).join(' ');
 }return result;
});
const rows=computed(()=>contentsRows(bookContents[props.book],textbookEntries,text.value));
const counts=computed(()=>Object.fromEntries(rows.value.map(row=>[row.node.id,{ready:new Set(row.entries.filter(e=>itemMap.value.has(textbookStudyId(e))).map(e=>e.sourceId)).size,pending:row.entries.filter(e=>!itemMap.value.has(textbookStudyId(e))).length}])));
const results=computed(()=>searchContents(rows.value,debounced.value));
function select(id:string){const row=rows.value.find(r=>r.node.id===id);if(row?.node.from)emit('select',row);}
</script>
<template>
 <section class="book-contents" aria-label="교재 목차">
  <header><h2>목차에서 골라 풀기</h2><p>장 → 절 → 핵심·실전예상문제 순서로 고릅니다. 연결 문제 수는 현재 대조가 끝난 범위입니다.</p></header>
  <label class="contents-search-label">목차·문제 내용 검색<input v-model="query" type="search" placeholder="예: 냉동 대용량 급속동결 / 몰리엘 / 집진" autocomplete="off"></label>
  <p class="contents-help">단어 일부·띄어쓰기·순서가 달라도 찾습니다. 여러 단어는 일치 개수가 많은 순서로 보여 주며, 연관어와 가벼운 오타도 참고합니다. 검색 보조 OCR은 오타가 있을 수 있고 원문 문제 이미지는 그대로입니다.</p>
  <p v-if="indexLoading" role="status">에너지 교재 내용 검색 자료를 불러오는 중…</p>
  <p v-if="indexError" role="status">내용 검색 보조자료를 읽지 못해 목차·등록 문장만 검색합니다. <button @click="loadIndex">다시 불러오기</button></p>
  <template v-if="debounced.trim()">
   <p role="status" class="contents-result-count">관련 목차 {{results.length}}개<template v-if="results.length>limit"> · {{limit}}개 표시</template></p>
   <ul v-if="results.length" class="contents-results">
    <li v-for="row in results.slice(0,limit)" :key="row.node.id">
     <button type="button" :disabled="!row.node.from" :aria-pressed="selected===row.node.id" @click="select(row.node.id)">
      <small>{{row.path.join(' › ')}}</small><strong>{{row.node.title}}</strong>
      <span>{{row.node.from||'쪽번호 대조 중'}}<template v-if="row.node.to">~{{row.node.to}}</template> · {{counts[row.node.id].ready}}문제 연결</span>
      <small>맞은 검색어: {{row.matched.map(m=>m.term).join(' · ')}}<template v-if="row.matched.some(m=>m.kind==='비슷한 단어')"> · 비슷한 단어 참고</template></small>
     </button>
    </li>
   </ul>
   <p v-else-if="!indexLoading">일치하는 목차를 찾지 못했습니다. 단어를 줄여 보세요. 예: ‘급속동결’ 또는 ‘압축기’.</p>
   <button v-if="results.length>limit" type="button" @click="limit+=20">검색 결과 더 보기</button>
  </template>
  <div v-else class="contents-tree"><BookContentsBranch v-for="node in bookContents[book]" :key="node.id" :node="node" :counts="counts" :selected="selected" @select="select" /></div>
 </section>
</template>
<style>
.book-contents{border:1px solid var(--line);border-radius:14px;background:var(--surface);padding:18px;min-width:0}.book-contents h2{margin:0 0 8px;font-size:22px}.book-contents p{line-height:1.65}.contents-search-label{display:grid;gap:8px;font-weight:700}.contents-search-label input{width:100%;box-sizing:border-box;font:inherit;color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:10px;min-height:48px;padding:12px}.contents-help,.contents-note{font-size:.9rem;color:var(--muted)}.contents-tree,.contents-results{max-height:520px;overflow:auto;overscroll-behavior:contain;scroll-padding:12px}.contents-branch{border-top:1px solid var(--line)}.contents-branch summary{display:flex;justify-content:space-between;gap:10px;cursor:pointer;padding:15px 5px;font-weight:700}.contents-branch summary::before{content:'▸';margin-right:4px}.contents-branch[open]>summary::before{content:'▾'}.contents-branch summary span{flex:1}.contents-branch small{font-size:.85rem;font-weight:400;color:var(--muted)}.contents-branch-body{padding-left:16px;border-left:2px solid var(--line);margin-left:5px}.book-contents button{font:inherit;text-align:left;cursor:pointer;color:var(--text);background:var(--surface-2);border:1px solid var(--line);border-radius:9px;min-height:46px;padding:11px 12px}.book-contents button:disabled{opacity:.6;cursor:default}.book-contents button[aria-pressed=true]{border-color:var(--primary);box-shadow:inset 3px 0 var(--primary)}.book-contents button:focus-visible,.book-contents summary:focus-visible{outline:3px solid var(--primary);outline-offset:2px}.contents-leaf{padding:5px 0}.contents-leaf>button{display:flex;justify-content:space-between;align-items:center;width:100%;gap:12px;flex-wrap:wrap}.contents-leaf small{display:block;margin-top:4px}.contents-note{margin:6px 0}.contents-results{list-style:none;padding:0;display:grid;gap:8px}.contents-results button{width:100%;display:grid;gap:6px}.contents-results button>small{color:var(--muted);line-height:1.5}.contents-result-count{font-weight:700}@media(max-width:600px){.book-contents{padding:13px}.contents-branch-body{padding-left:10px}.contents-branch summary{flex-wrap:wrap}.contents-tree,.contents-results{max-height:60dvh}}
</style>
