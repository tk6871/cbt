<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import type { QuestionItem, StudyMode } from './types';
import QuestionCard from './QuestionCard.vue';
import TextbookContents from './TextbookContents.vue';
import type {ContentsRow} from './textbookContents';
import { adjacentBookPage, compareBookPages, normalizeBookPage, textbookEntries, textbookNames, textbookStudyId, textbookSelectionKey, textbookReferencePage, textbookWorkedExamples, textbookAssetUrl, textbookPageAudit, textbookAuditPages, type TextbookKey } from './textbookPages';
const props=defineProps<{ book:TextbookKey; items:QuestionItem[]; answers:Record<string,number>; loading:boolean; error:string; answerLayout:'classic'|'inline'|'hotspot'; hotspotIndicator:'marker'|'area'; restoredImageTheme:'auto'|'original' }>();
const emit=defineEmits<{ book:[book:TextbookKey]; retry:[]; choose:[item:QuestionItem,choice:number]; bookmark:[item:QuestionItem]; ai:[item:QuestionItem]; start:[payload:{items:QuestionItem[];mode:StudyMode;label:string}] }>();
const preferenceKey='cbt-textbook-pages-v1';
function saved(){try{return JSON.parse(localStorage.getItem(preferenceKey)||'{}');}catch{return {};}}
const from=ref('');const to=ref('');
const auditSearch=ref(''),auditLimit=ref(80);
const auditRows=computed(()=>textbookAuditPages.filter(row=>row.page.includes(normalizeBookPage(auditSearch.value))).sort((a,b)=>compareBookPages(a.page,b.page)));
watch(auditSearch,()=>auditLimit.value=80);
async function openAuditPage(page:string){choose(page);await nextTick();pageResult.value?.scrollIntoView({block:'start',behavior:'instant'});}
const contentsId=ref(''),contentsLabel=ref('');const contentsWrap=ref<HTMLElement|null>(null),pageResult=ref<HTMLElement|null>(null);
function restore(){const s=saved()[props.book];from.value=typeof s?.from==='string'?s.from:props.book==='hansol'?'4-10':'442';to.value=typeof s?.to==='string'?s.to:'';contentsId.value=s?.contentsId||'';contentsLabel.value=s?.contentsLabel||'';}
restore();watch(()=>props.book,restore);
watch([from,to,contentsId,contentsLabel],()=>{try{localStorage.setItem(preferenceKey,JSON.stringify({...saved(),[props.book]:{from:from.value,to:to.value,contentsId:contentsId.value,contentsLabel:contentsLabel.value}}));}catch{}});
const entries=computed(()=>textbookEntries.filter(e=>e.book===props.book));
const pages=computed(()=>[...new Set(entries.value.map(e=>e.page))].sort(compareBookPages));
const start=computed(()=>normalizeBookPage(from.value));const end=computed(()=>normalizeBookPage(to.value));
const referencePage=computed(()=>!end.value?textbookReferencePage(props.book,start.value):undefined);
const audit=computed(()=>!end.value?textbookPageAudit(props.book,start.value):undefined);
const invalid=computed(()=>!!end.value&&compareBookPages(start.value,end.value)>0);
const examples=computed(()=>textbookWorkedExamples.filter(e=>e.book===props.book&&e.pages.some(page=>end.value?compareBookPages(page,start.value)>=0&&compareBookPages(page,end.value)<=0:page===start.value)));
const locations=computed(()=>!start.value||invalid.value?[]:entries.value.filter(e=>end.value
 ? compareBookPages(e.page,start.value)>=0&&compareBookPages(e.page,end.value)<=0:e.page===start.value));
const itemById=computed(()=>new Map(props.items.map(i=>[i.id,i])));
const matched=computed(()=>{
 const map=itemById.value;const seen=new Set<string>();
  return locations.value.flatMap(e=>{const item=map.get(textbookStudyId(e));const key=textbookSelectionKey(e);if(!item||!e.sourceId||seen.has(key))return [];seen.add(key);return [item];});
});
const pending=computed(()=>locations.value.filter(e=>!itemById.value.has(textbookStudyId(e))).length);
const selectedPages=computed(()=>[...new Set(locations.value.map(e=>e.page))].sort(compareBookPages));
const label=computed(()=>`${textbookNames[props.book]} ${start.value}${end.value?`~${end.value}`:''}쪽${contentsLabel.value?` · ${contentsLabel.value}`:''}`);
function clearContents(){contentsId.value='';contentsLabel.value='';}
function go(delta:number){const next=adjacentBookPage(props.book,start.value,delta);if(next){from.value=next;to.value='';clearContents();}}
function choose(page:string){from.value=page;to.value='';clearContents();}
async function selectContents(row:ContentsRow){
 const ready=new Set(props.items.map(i=>i.id));
 const pages=[...new Set(row.entries.filter(e=>ready.has(textbookStudyId(e))).map(e=>e.page))].sort(compareBookPages);
 from.value=pages[0]||row.node.from||'';
 const last=row.node.to||pages.at(-1);to.value=last&&last!==from.value?last:'';
 contentsId.value=row.node.id;contentsLabel.value=[...row.path.slice(1),row.node.title].join(' › ');
 await nextTick();pageResult.value?.scrollIntoView({block:'start',behavior:'instant'});
}
function openContents(){contentsWrap.value?.scrollIntoView({block:'start',behavior:'instant'});}
function play(mode:StudyMode){if(!props.loading&&!invalid.value&&matched.value.length)emit('start',{items:matched.value,mode,label:label.value});}
const pageColumns=computed(()=>{
 const rows=entries.value.filter(e=>e.page===start.value);
 const map=itemById.value;
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
  <div ref="contentsWrap"><TextbookContents :book="book" :items="items" :selected="contentsId" @select="selectContents" /></div>
  <form class="page-picker" @submit.prevent>
   <label>시작 쪽<input v-model="from" :list="`book-pages-${book}`" :placeholder="book==='hansol'?'예: 4-10':'예: 442'" autocomplete="off" @input="clearContents"></label>
   <label>끝 쪽 <small>여러 페이지를 풀 때만</small><input v-model="to" :list="`book-pages-${book}`" placeholder="한 페이지만 풀면 비워 두세요" autocomplete="off" @input="clearContents"></label>
   <datalist :id="`book-pages-${book}`"><option v-for="page in pages" :key="page" :value="page"/></datalist>
   <button type="button" :disabled="!adjacentBookPage(book,start,-1)" @click="go(-1)">← 이전 쪽</button>
   <button type="button" :disabled="!adjacentBookPage(book,start,1)" @click="go(1)">다음 쪽 →</button>
  </form>
  <p v-if="invalid" role="alert">끝 쪽은 시작 쪽보다 뒤여야 합니다. 한 페이지는 시작 쪽만 입력하세요.</p>
  <p v-if="loading" role="status">교재에 연결된 원문을 불러오는 중…</p>
  <p v-else-if="error" role="alert">{{error}} <button @click="emit('retry')">다시 불러오기</button></p>
  <template v-else>
   <div ref="pageResult" class="book-page-result" aria-live="polite"><h2>{{label}}</h2><button type="button" @click="openContents">↑ 목차 다시 고르기</button><p>풀 수 있는 문제 <strong>{{matched.length}}개</strong><template v-if="pending"> · 추가 대조 {{pending}}위치</template></p>
    <p v-if="referencePage">{{referencePage}}</p>
    <p v-else-if="!locations.length&&!examples.length">{{audit?'이 쪽은 전체 화면 자동 대조에 포함되었지만, 확정 연결된 문항은 아직 없습니다.':'이 쪽은 아직 문제 연결을 확인하지 않았습니다.'}} 교재에 문제가 없다는 뜻은 아닙니다.</p>
    <p v-if="audit" class="book-page-audit">화면·열별 OCR 대조 자료 있음 · 인식 후보 {{audit.detectedPositions}}위치. 이 수는 최종 문제 수가 아니며, 그림·수식·인쇄 오류 등은 추가 확인이 필요할 수 있습니다.</p>
    <p v-if="examples.length">본문 풀이 예제 {{examples.length}}개 · 객관식 시험에는 넣지 않습니다.</p>
    <p v-else-if="pending">보기·수치·정답이 다르거나 연결하지 못한 위치는 출제하지 않습니다.</p>
    <div class="book-play"><button :disabled="!matched.length||invalid" @click="play('learn')">범위를 모아 일반 학습</button><button :disabled="!matched.length||invalid" @click="play('exam')">범위를 모아 CBT 시험</button></div>
   </div>
   <article v-for="example in examples" :key="example.id" class="book-worked-example">
    <h2>본문 풀이 예제 · {{example.title}}</h2><p>{{example.note}}</p>
    <figure class="textbook-explanation-image"><figcaption>교재 {{example.pages[0]}}쪽 · 문제</figcaption><img :class="{'restored-image-original':restoredImageTheme==='original'}" :src="textbookAssetUrl(example.question)" :width="example.questionSize[0]" :height="example.questionSize[1]" alt="월간 에너지 소비량 예제 원문" loading="lazy"></figure>
    <details><summary>풀이와 답 보기 · 교재 {{example.pages[1]}}쪽</summary><p><strong>답 {{example.answer}}</strong></p><p>{{example.explanation}}</p><figure class="textbook-explanation-image"><figcaption>교재 원문 풀이</figcaption><img :class="{'restored-image-original':restoredImageTheme==='original'}" :src="textbookAssetUrl(example.solution)" :width="example.solutionSize[0]" :height="example.solutionSize[1]" alt="석유환산톤 계산 원문 풀이" loading="lazy"></figure></details>
   </article>
   <article class="book-sheet" :key="`${book}-${start}`" aria-label="교재 페이지 풀이">
    <header><strong>{{textbookNames[book]}}</strong><span>{{start}}쪽</span></header>
    <div class="book-sheet-columns">
     <div v-for="(column,index) in pageColumns" :key="index" class="book-sheet-column">
      <section v-for="row in column" :key="row.entry.number" class="book-sheet-question">
       <h3>교재 {{row.entry.number}}번</h3>
       <QuestionCard v-if="row.item" :item="row.item" mode="learn" :selected="answers[row.item.id]" :display-number="row.entry.number" :answer-layout="answerLayout" :image-answer-mode="answerLayout==='hotspot'?'hotspot':'buttons'" :hotspot-indicator="hotspotIndicator" :restored-image-theme="restoredImageTheme" @choose="emit('choose',row.item!,$event)" @toggle-bookmark="emit('bookmark',row.item!)" @ask-ai="emit('ai',row.item!)"/>
       <p v-else class="book-pending">{{row.entry.pendingReason||'이 위치는 원문 연결을 추가 확인 중입니다. 다른 문제로 임의 대체하지 않습니다.'}}</p>
      </section>
     </div>
    </div>
    <p v-if="!pageColumns.some(c=>c.length)" class="book-pending">{{referencePage||(examples.length?'위의 본문 풀이 예제를 확인하세요.':audit?'자동 대조 자료는 있지만 확정된 문항 연결은 없습니다.':'아직 대조하지 않은 쪽입니다.')}}</p>
    <footer><button :disabled="!adjacentBookPage(book,start,-1)" @click="go(-1)">← 이전 쪽</button><strong>{{start}}</strong><button :disabled="!adjacentBookPage(book,start,1)" @click="go(1)">다음 쪽 →</button></footer>
   </article>
  </template>
  <details><summary>등록된 쪽에서 고르기 · {{pages.length}}쪽</summary><div class="registered-book-pages"><button v-for="page in pages" :key="page" :aria-pressed="selectedPages.includes(page)" @click="choose(page)">{{page}}</button></div></details>
  <details v-if="book==='hansol'" class="book-comparison-summary">
   <summary>전체 자동 대조 현황 · {{textbookAuditPages.length}}쪽</summary>
   <p>전체 정상 열람 화면을 비교한 결과입니다. 연결된 문제와 미확정 인식 후보·출제 보류를 구분합니다. 인식 후보 수는 실제 문제 수가 아니며, 전 문항 육안 검증 완료를 뜻하지 않습니다.</p>
   <input v-model="auditSearch" type="search" aria-label="교재 대조 쪽 검색" placeholder="쪽번호 검색 · 예: 1-108">
   <div class="book-audit-list"><button v-for="row in auditRows.slice(0,auditLimit)" :key="row.page" @click="openAuditPage(row.page)"><strong>{{row.page}}쪽</strong><span>연결 {{row.linkedPositions}} · 미확정 후보 {{row.unconfirmedCandidates}}<b v-if="row.heldPositions"> · 보류 {{row.heldPositions}}</b></span></button></div>
   <button v-if="auditRows.length>auditLimit" @click="auditLimit+=80">80쪽 더 보기</button><p v-if="!auditRows.length">해당 쪽번호의 대조 자료가 없습니다.</p>
  </details>
  <p class="book-coverage">전체 교재를 대상으로 연결을 진행 중입니다. 아직 모든 페이지의 연결이 끝난 상태는 아닙니다. 대조하지 않은 쪽과 연결하지 못한 문항도 구분합니다. 원문 기출 이미지 안의 번호는 교재 번호와 다를 수 있으며, 위의 ‘교재 ○번’이 책의 번호입니다. 좌우 열이 확인된 페이지는 그 배치를 따르고 나머지는 읽기 순서로 나눕니다. 페이지 선택은 이 기기에 저장하며 풀이 기록은 일반 기출·중간고사와 따로 저장합니다.</p>
 </section>
</template>

<style scoped>
.textbook-pages{max-width:1500px;margin:0 auto;display:grid;gap:18px;color:var(--text,#dce7f5)}
.book-comparison-summary{border:1px solid var(--line);border-radius:12px;padding:0 16px 14px;background:var(--surface)}.book-comparison-summary p{line-height:1.65}.book-comparison-summary>input{width:100%;box-sizing:border-box;margin:0 0 12px}.book-audit-list{display:grid;gap:8px;max-height:440px;overflow:auto;margin-bottom:12px}.book-audit-list button{text-align:left;display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px}.book-audit-list b{color:var(--primary)}
.book-worked-example{padding:20px;border:1px solid var(--line);border-radius:12px;background:var(--surface);line-height:1.7}.book-worked-example h2{font-size:22px}.book-worked-example details{margin-top:16px}.book-worked-example img{height:auto;max-width:100%}
header h1{font-size:clamp(24px,3vw,34px);margin:8px 0}header p,.book-coverage{line-height:1.65}.book-tabs,.page-picker,.book-play{display:flex;gap:12px;flex-wrap:wrap}
button,input{font:inherit;color:inherit;border:1px solid var(--line,#536780);border-radius:10px;background:var(--surface,#172537);padding:12px 16px;min-height:46px}button{cursor:pointer}button:disabled{opacity:.45;cursor:default}button[aria-pressed=true],.book-play button:first-child{border-color:var(--primary,#568de0);background:var(--primary-2,#2563a2);color:white}
.page-picker label{display:grid;gap:8px;flex:1 1 240px}.page-picker small{font-size:.85em}.page-picker input{width:100%;box-sizing:border-box}.page-picker>button{align-self:end}.book-page-result{border:1px solid var(--line,#536780);border-radius:14px;padding:20px;background:var(--surface,#172537)}.book-page-result h2{margin:0 0 10px;font-size:22px}small{opacity:.8}.registered-book-pages{display:flex;flex-wrap:wrap;gap:8px;max-height:320px;overflow:auto;margin-top:14px}.registered-book-pages button{padding:8px 12px}.book-coverage{font-size:14px;opacity:.8}summary{cursor:pointer;padding:12px 0}
@media(max-width:600px){.page-picker>button,.book-play button{flex:1 1 130px}.book-question-links li{flex-direction:column}.book-tabs button{flex:1}.book-page-result{padding:14px}}
.book-sheet{border:1px solid var(--line,#536780);border-radius:3px;background:var(--surface,#fff);padding:24px;box-shadow:0 6px 24px #0000000d;animation:book-page-in .18s ease-out}.book-sheet>header,.book-sheet>footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0}.book-sheet>header{border-bottom:2px solid var(--primary,#568de0)}.book-sheet>footer{border-top:1px solid var(--line,#536780)}.book-sheet-columns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:32px;padding:20px 0}.book-sheet-column{min-width:0}.book-sheet-column+div{border-left:1px dashed var(--line,#536780);padding-left:24px}.book-sheet-question{break-inside:avoid;margin-bottom:24px}.book-sheet-question h3{font-size:20px;margin:0 0 10px;color:var(--primary)}.book-sheet :deep(.question-card){box-shadow:none;border:0;padding:0;background:transparent}.book-pending{padding:20px;line-height:1.7;background:var(--surface-2,#172537)}
@keyframes book-page-in{from{opacity:.5;transform:translateX(8px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.book-sheet{animation:none}}
@media(max-width:900px){.book-sheet-columns{grid-template-columns:minmax(0,1fr);gap:0}.book-sheet-column+div{padding-left:0;border-left:0}.book-sheet{padding:14px}}
</style>
