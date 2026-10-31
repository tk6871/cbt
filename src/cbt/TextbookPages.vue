<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from 'vue';
import type { QuestionItem, StudyMode } from './types';
import QuestionCard from './QuestionCard.vue';
import TextbookContents from './TextbookContents.vue';
import type {ContentsRow} from './textbookContents';
import { adjacentBookPage, compareBookPages, normalizeBookPage, textbookEntries, textbookNames, textbookStudyId, textbookSelectionKey, textbookReferencePage, textbookWorkedExamples, textbookAssetUrl, textbookPageAudit, textbookAuditPages, type TextbookKey } from './textbookPages';
const props=defineProps<{ book:TextbookKey; items:QuestionItem[]; answers:Record<string,number>; loading:boolean; error:string; answerLayout:'classic'|'inline'|'hotspot'; hotspotIndicator:'marker'|'area'; restoredImageTheme:'auto'|'original' }>();
const emit=defineEmits<{ close:[]; settings:[]; calculator:[]; book:[book:TextbookKey]; retry:[]; choose:[item:QuestionItem,choice:number]; bookmark:[item:QuestionItem]; ai:[item:QuestionItem]; start:[payload:{items:QuestionItem[];mode:StudyMode;label:string}] }>();
const preferenceKey='cbt-textbook-pages-v1';
function saved(){try{return JSON.parse(localStorage.getItem(preferenceKey)||'{}');}catch{return {};}}
const from=ref('');const to=ref('');
const auditSearch=ref(''),auditLimit=ref(80);
const auditRows=computed(()=>textbookAuditPages.filter(row=>row.page.includes(normalizeBookPage(auditSearch.value))).sort((a,b)=>compareBookPages(a.page,b.page)));
watch(auditSearch,()=>auditLimit.value=80);
async function openAuditPage(page:string){choose(page);closeNavigator();await scrollToSheet();}
const contentsId=ref(''),contentsLabel=ref('');const contentsWrap=ref<HTMLElement|null>(null),pageResult=ref<HTMLElement|null>(null);
const navigator=ref<HTMLDialogElement|null>(null),navigatorTrigger=ref<HTMLButtonElement|null>(null);
const navigatorTab=ref<'contents'|'pages'|'info'>('contents'),draftFrom=ref(''),draftTo=ref('');
function validPage(value:string){const page=normalizeBookPage(value);return props.book==='hansol'?/^[1-9]\d*-[1-9]\d*$/.test(page):/^[1-9]\d*$/.test(page)&&Number(page)<=645;}
const draftInvalid=computed(()=>!validPage(draftFrom.value)||!!normalizeBookPage(draftTo.value)&&(!validPage(draftTo.value)||compareBookPages(normalizeBookPage(draftFrom.value),normalizeBookPage(draftTo.value))>0));
function openNavigator(tab:'contents'|'pages'|'info'='contents'){
 navigatorTab.value=tab;draftFrom.value=from.value;draftTo.value=to.value;
 navigator.value?.showModal();
}
function closeNavigator(){navigator.value?.close();}
function afterNavigatorClosed(){navigatorTrigger.value?.focus({preventScroll:true});}
async function scrollToSheet(){await nextTick();window.scrollTo({top:0,behavior:'instant'});}
function applyPages(){if(draftInvalid.value)return;from.value=normalizeBookPage(draftFrom.value);to.value=normalizeBookPage(draftTo.value);clearContents();closeNavigator();void scrollToSheet();}
function selectPage(page:string){choose(page);closeNavigator();void scrollToSheet();}
onMounted(()=>openNavigator());
function restore(){const s=saved()[props.book];from.value=typeof s?.from==='string'?s.from:props.book==='hansol'?'4-10':'442';to.value=typeof s?.to==='string'?s.to:'';contentsId.value=s?.contentsId||'';contentsLabel.value=s?.contentsLabel||'';}
restore();watch(()=>props.book,()=>{restore();draftFrom.value=from.value;draftTo.value=to.value;});
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
function go(delta:number){const next=adjacentBookPage(props.book,start.value,delta);if(next){from.value=next;to.value='';clearContents();void scrollToSheet();}}
function choose(page:string){from.value=page;to.value='';clearContents();}
async function selectContents(row:ContentsRow){
 const ready=new Set(props.items.map(i=>i.id));
 const pages=[...new Set(row.entries.filter(e=>ready.has(textbookStudyId(e))).map(e=>e.page))].sort(compareBookPages);
 from.value=pages[0]||row.node.from||'';
 const last=row.node.to||pages.at(-1);to.value=last&&last!==from.value?last:'';
 contentsId.value=row.node.id;contentsLabel.value=[...row.path.slice(1),row.node.title].join(' › ');
 closeNavigator();await scrollToSheet();
}
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
 <section class="textbook-pages" aria-label="교재 전용 풀이">
  <header class="reader-toolbar">
   <button type="button" class="reader-back" aria-label="교재 목록으로 돌아가기" @click="emit('close')">← <span>목록</span></button>
   <div class="reader-title"><small>TEXTBOOK STUDY</small><h1>{{textbookNames[book]}}</h1></div>
   <button ref="navigatorTrigger" type="button" class="reader-navigator-trigger" @click="openNavigator()">☷ 목차·쪽 선택 <b>{{start}}쪽</b></button>
   <button type="button" aria-label="공학용 계산기 열기" @click="emit('calculator')">▦</button>
   <button type="button" aria-label="교재 풀이 설정" @click="emit('settings')">⚙ <span>설정</span></button>
  </header>
  <main class="reader-main">
  <p v-if="invalid" role="alert">끝 쪽은 시작 쪽보다 뒤여야 합니다. 한 페이지는 시작 쪽만 입력하세요.</p>
  <p v-if="loading" role="status">교재에 연결된 원문을 불러오는 중…</p>
  <p v-else-if="error" role="alert">{{error}} <button @click="emit('retry')">다시 불러오기</button></p>
  <template v-else>
   <div ref="pageResult" class="book-page-result" aria-live="polite"><div><h2>{{contentsLabel||`${start}쪽${end?` ~ ${end}쪽`:''}`}}</h2><p><strong>{{matched.length}}문제</strong><template v-if="end"> · 범위 {{start}}~{{end}}쪽 · 아래는 {{start}}쪽</template><template v-if="pending"> · 대조 중 {{pending}}위치</template></p></div>
    <div class="book-play"><button :disabled="!matched.length||invalid" @click="play('learn')">범위를 모아 일반 학습</button><button :disabled="!matched.length||invalid" @click="play('exam')">범위를 모아 CBT 시험</button></div>
   </div>
   <div v-if="referencePage||!locations.length||examples.length||pending" class="reader-page-note">
    <p v-if="referencePage">{{referencePage}}</p>
    <p v-else-if="!locations.length&&!examples.length">{{audit?'이 쪽은 전체 화면 자동 대조에 포함되었지만, 확정 연결된 문항은 아직 없습니다.':'이 쪽은 아직 문제 연결을 확인하지 않았습니다.'}} 교재에 문제가 없다는 뜻은 아닙니다.</p>
    <p v-if="examples.length">본문 풀이 예제 {{examples.length}}개 · 객관식 시험에는 넣지 않습니다.</p>
    <p v-else-if="pending">보기·수치·정답이 다르거나 연결하지 못한 위치는 출제하지 않습니다.</p>
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
  </main>
  <dialog id="textbook-navigator" ref="navigator" class="book-navigator" aria-labelledby="book-navigator-title" @close="afterNavigatorClosed" @click="($event.target===navigator)&&closeNavigator()">
   <div class="book-navigator-body">
    <header class="navigator-header"><div><small>CONTENTS</small><h2 id="book-navigator-title">어디부터 풀까요?</h2><p>목차를 펼치거나 책에 적힌 쪽번호로 이동하세요.</p></div><button type="button" aria-label="목차·쪽 선택 닫기" @click="closeNavigator">×</button></header>
    <div class="book-tabs" aria-label="교재 선택"><button v-for="(name,key) in textbookNames" :key="key" :aria-pressed="book===key" @click="emit('book',key)">{{name}}</button></div>
    <nav class="navigator-tabs" aria-label="교재 탐색 방식"><button :aria-pressed="navigatorTab==='contents'" @click="navigatorTab='contents'">교재 목차</button><button :aria-pressed="navigatorTab==='pages'" @click="navigatorTab='pages';draftFrom=from;draftTo=to">쪽번호 이동</button><button :aria-pressed="navigatorTab==='info'" @click="navigatorTab='info'">연결 현황·안내</button></nav>
    <div v-show="navigatorTab==='contents'" ref="contentsWrap" class="navigator-contents"><TextbookContents :book="book" :items="items" :selected="contentsId" @select="selectContents" /></div>
    <section v-show="navigatorTab==='pages'" class="navigator-page-panel">
     <h3>책에 인쇄된 쪽번호</h3><p>한솔의 <b>4-10</b>은 4~10쪽 범위가 아닌 한 페이지입니다.</p>
     <form class="page-picker" @submit.prevent="applyPages">
      <label>시작 쪽<input v-model="draftFrom" :list="`book-pages-${book}`" :placeholder="book==='hansol'?'예: 4-10':'예: 442'" autocomplete="off"></label>
      <label>끝 쪽 <small>여러 쪽을 모아 풀 때만</small><input v-model="draftTo" :list="`book-pages-${book}`" placeholder="한 쪽이면 비워 두세요" autocomplete="off"></label>
      <datalist :id="`book-pages-${book}`"><option v-for="page in pages" :key="page" :value="page"/></datalist>
      <button type="submit" :disabled="draftInvalid">이 쪽 열기 →</button>
     </form><p v-if="draftInvalid" role="status">책의 쪽번호를 입력하세요. 끝 쪽을 입력한다면 시작 쪽보다 뒤여야 합니다.</p>
     <details><summary>등록된 쪽에서 고르기 · {{pages.length}}쪽</summary><div class="registered-book-pages"><button v-for="page in pages" :key="page" :aria-pressed="selectedPages.includes(page)" @click="selectPage(page)">{{page}}</button></div></details>
    </section>
    <section v-show="navigatorTab==='info'" class="navigator-info">
     <p v-if="audit" class="book-page-audit">{{start}}쪽 · 자동 인식 후보 {{audit.detectedPositions}}위치. 최종 문제 수나 개별 검토 완료를 뜻하지 않습니다.</p>
  <details v-if="book==='hansol'" class="book-comparison-summary">
   <summary>전체 자동 대조 현황 · {{textbookAuditPages.length}}쪽</summary>
   <p>전체 정상 열람 화면을 비교한 결과입니다. 연결된 문제와 미확정 인식 후보·출제 보류를 구분합니다. 인식 후보 수는 실제 문제 수가 아니며, 전 문항 육안 검증 완료를 뜻하지 않습니다.</p>
   <input v-model="auditSearch" type="search" aria-label="교재 대조 쪽 검색" placeholder="쪽번호 검색 · 예: 1-108">
   <div class="book-audit-list"><button v-for="row in auditRows.slice(0,auditLimit)" :key="row.page" @click="openAuditPage(row.page)"><strong>{{row.page}}쪽</strong><span>연결 {{row.linkedPositions}} · 미확정 후보 {{row.unconfirmedCandidates}}<b v-if="row.heldPositions"> · 보류 {{row.heldPositions}}</b></span></button></div>
   <button v-if="auditRows.length>auditLimit" @click="auditLimit+=80">80쪽 더 보기</button><p v-if="!auditRows.length">해당 쪽번호의 대조 자료가 없습니다.</p>
  </details>
  <p class="book-coverage">전체 교재를 대상으로 연결을 진행 중입니다. 아직 모든 페이지의 연결이 끝난 상태는 아닙니다. 대조하지 않은 쪽과 연결하지 못한 문항도 구분합니다. 원문 기출 이미지 안의 번호는 교재 번호와 다를 수 있으며, 위의 ‘교재 ○번’이 책의 번호입니다. 좌우 열이 확인된 페이지는 그 배치를 따르고 나머지는 읽기 순서로 나눕니다. 페이지 선택은 이 기기에 저장하며 풀이 기록은 일반 기출·중간고사와 따로 저장합니다.</p>
    </section>
    <footer class="navigator-footer"><span>마지막 쪽과 풀이 기록은 자동 저장됩니다.</span><button type="button" @click="closeNavigator">{{start}}쪽 이어서 보기 →</button></footer>
   </div>
  </dialog>
 </section>
</template>

<style scoped>
:global(body:has(#textbook-navigator[open])){overflow:hidden}
.textbook-pages{min-height:100dvh;background:var(--bg,#101925);color:var(--text,#dce7f5);padding-bottom:env(safe-area-inset-bottom,0px)}
.reader-toolbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--line);padding:calc(10px + env(safe-area-inset-top,0px)) max(16px,calc((100vw - 1440px)/2)) 10px;background:var(--surface,#172537)}
.reader-title{flex:1;min-width:0}.reader-title small{font-size:10px;letter-spacing:.15em;color:var(--muted)}.reader-title h1{font-size:17px;margin:3px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reader-toolbar button{padding:8px 12px}.reader-navigator-trigger{display:flex;align-items:center;gap:14px}.reader-navigator-trigger b{color:var(--primary);font-size:14px}
.reader-main{max-width:1400px;margin:0 auto;padding:18px 24px 32px}.book-page-result{display:flex;align-items:center;justify-content:space-between;gap:12px;scroll-margin-top:100px}.book-page-result h2{font-size:17px;margin:0}.book-page-result p{margin:5px 0 0;font-size:13px;color:var(--muted)}.reader-page-note{font-size:14px;line-height:1.6;padding:0 12px}.book-play{gap:8px}.book-play button{font-size:13px;padding:8px 12px}.book-sheet>footer{position:sticky;bottom:0;background:var(--surface);padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:3}.book-sheet>footer button{min-width:120px}
.book-navigator{width:min(1040px,calc(100vw - 32px));max-width:none;max-height:calc(100dvh - 40px);padding:0;border:1px solid var(--line);border-radius:18px;background:var(--surface,#172537);color:var(--text,#dce7f5);box-shadow:0 28px 90px #0006;overscroll-behavior:contain}.book-navigator::backdrop{background:#060c17a8;backdrop-filter:blur(3px)}.book-navigator-body{padding:24px;min-width:0}.navigator-header{display:flex;justify-content:space-between;align-items:start;gap:16px}.navigator-header small{font-size:11px;letter-spacing:.2em;color:var(--primary);font-weight:800}.navigator-header h2{font-size:27px;margin:8px 0}.navigator-header p{color:var(--muted);font-size:14px;margin:0 0 20px}.navigator-header>button{font-size:25px;line-height:1;padding:8px 13px}.book-tabs{margin-bottom:18px}.book-tabs button{flex:1;font-weight:700}.navigator-tabs{display:flex;gap:22px;border-bottom:1px solid var(--line);margin-bottom:20px}.navigator-tabs button{border:0;border-radius:0;background:transparent;color:var(--muted);padding:10px 2px;border-bottom:3px solid transparent}.navigator-tabs button[aria-pressed=true]{color:var(--primary);background:transparent;border-bottom-color:var(--primary);font-weight:800}
.navigator-contents :deep(.book-contents){padding:0;border:0;border-radius:0;background:transparent}.navigator-contents :deep(.book-contents>header){display:none}.navigator-contents :deep(.contents-help){font-size:12px;margin:8px 0 16px}.navigator-contents :deep(.contents-branch>summary){padding:18px 8px;align-items:center}.navigator-contents :deep(.contents-branch>summary>span){font-size:17px}.navigator-contents :deep(.contents-branch-body){border-left:2px solid var(--primary);margin-left:14px;padding-left:18px}.navigator-contents :deep(.contents-leaf>button){background:transparent;border:0;border-bottom:1px dotted var(--line);border-radius:0;padding:14px 8px}.navigator-contents :deep(.contents-leaf>button:hover){background:var(--surface-2)}.navigator-contents :deep(.contents-tree),.navigator-contents :deep(.contents-results){max-height:48dvh}.navigator-page-panel>h3{margin:0}.navigator-page-panel>p,.navigator-info>p{color:var(--muted);line-height:1.7;font-size:14px}.navigator-page-panel details{margin-top:18px}.navigator-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:20px;border-top:1px solid var(--line);padding-top:16px}.navigator-footer>span{font-size:12px;color:var(--muted)}.navigator-footer button{border-color:var(--primary)}
.book-comparison-summary{border:1px solid var(--line);border-radius:12px;padding:0 16px 14px;background:var(--surface)}.book-comparison-summary p{line-height:1.65}.book-comparison-summary>input{width:100%;box-sizing:border-box;margin:0 0 12px}.book-audit-list{display:grid;gap:8px;max-height:440px;overflow:auto;margin-bottom:12px}.book-audit-list button{text-align:left;display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px}.book-audit-list b{color:var(--primary)}
.book-worked-example{padding:20px;border:1px solid var(--line);border-radius:12px;background:var(--surface);line-height:1.7}.book-worked-example h2{font-size:22px}.book-worked-example details{margin-top:16px}.book-worked-example img{height:auto;max-width:100%}
header h1{font-size:clamp(24px,3vw,34px);margin:8px 0}header p,.book-coverage{line-height:1.65}.book-tabs,.page-picker,.book-play{display:flex;gap:12px;flex-wrap:wrap}
button,input{font:inherit;color:inherit;border:1px solid var(--line,#536780);border-radius:10px;background:var(--surface,#172537);padding:12px 16px;min-height:46px}button{cursor:pointer}button:disabled{opacity:.45;cursor:default}button[aria-pressed=true],.book-play button:first-child{border-color:var(--primary,#568de0);background:var(--primary-soft,#172d48);color:var(--text);font-weight:700}
.page-picker label{display:grid;gap:8px;flex:1 1 200px}.page-picker small{font-size:.85em}.page-picker input{width:100%;box-sizing:border-box}.page-picker>button{align-self:end}.book-page-result{padding:0 0 16px;background:transparent}small{opacity:.8}.registered-book-pages{display:flex;flex-wrap:wrap;gap:8px;max-height:320px;overflow:auto;margin-top:14px}.registered-book-pages button{padding:8px 12px}.book-coverage{font-size:14px;opacity:.8}summary{cursor:pointer;padding:12px 0}
@media(max-width:600px){.page-picker>button,.book-play button{flex:1 1 130px}.book-question-links li{flex-direction:column}.book-tabs button{flex:1}.book-page-result{padding:14px}}
.book-sheet{border:1px solid var(--line,#536780);border-radius:3px;background:var(--surface,#fff);padding:24px;box-shadow:0 6px 24px #0000000d;animation:book-page-in .18s ease-out}.book-sheet>header,.book-sheet>footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0}.book-sheet>header{border-bottom:2px solid var(--primary,#568de0)}.book-sheet>footer{border-top:1px solid var(--line,#536780)}.book-sheet-columns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:32px;padding:20px 0}.book-sheet-column{min-width:0}.book-sheet-column+div{border-left:1px dashed var(--line,#536780);padding-left:24px}.book-sheet-question{break-inside:avoid;margin-bottom:24px}.book-sheet-question h3{font-size:20px;margin:0 0 10px;color:var(--primary)}.book-sheet :deep(.question-card){box-shadow:none;border:0;padding:0;background:transparent}.book-pending{padding:20px;line-height:1.7;background:var(--surface-2,#172537)}
@keyframes book-page-in{from{opacity:.5;transform:translateX(8px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.book-sheet{animation:none}}
@media(max-width:900px){.book-sheet-columns{grid-template-columns:minmax(0,1fr);gap:0}.book-sheet-column+div{padding-left:0;border-left:0}.book-sheet{padding:14px}}
@media(max-width:600px){.reader-toolbar{gap:7px;padding-left:10px;padding-right:10px;flex-wrap:wrap}.reader-back span,.reader-toolbar>button:last-child span{display:none}.reader-title h1{font-size:14px}.reader-navigator-trigger{order:4;width:100%;justify-content:space-between;min-height:40px}.reader-main{padding:14px 10px 24px}.book-page-result{align-items:start;flex-direction:column;padding:0 4px 12px}.book-play{width:100%}.book-play button{flex:1;min-height:44px}.book-sheet>footer button{min-width:0;flex:1}.book-navigator{width:calc(100vw - 16px);max-height:calc(100dvh - 24px);border-radius:14px}.book-navigator-body{padding:18px 14px}.navigator-header h2{font-size:23px}.navigator-header p{font-size:12px}.navigator-tabs{gap:16px}.navigator-tabs button{font-size:13px}.navigator-footer{flex-wrap:wrap}.navigator-footer button{width:100%}.navigator-contents :deep(.contents-branch>summary>span){font-size:15px}.page-picker{flex-direction:column}.page-picker label{flex:auto}.page-picker>button{width:100%}}
</style>
