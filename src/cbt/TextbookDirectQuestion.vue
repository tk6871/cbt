<script setup lang="ts">
import {computed,ref,watch} from 'vue';
import {textbookAssetUrl,textbookDirectImage,type TextbookDirectSource,type TextbookDirectPage} from './textbookPages';
const props=defineProps<{source:TextbookDirectSource;page:TextbookDirectPage;original:boolean}>();
const chosen=ref(0),storageFailed=ref(false),fullOpen=ref(false),answerOpen=ref(false),upscaleFailed=ref(false);
const storageKey=computed(()=>`cbt-book-direct-choice-v1::${props.source.id}`);
watch(storageKey,key=>{try{const n=Number(localStorage.getItem(key));chosen.value=n>=1&&n<=4?n:0;}catch{chosen.value=0;}fullOpen.value=false;answerOpen.value=false;upscaleFailed.value=false;},{immediate:true});
function choose(n:number){chosen.value=chosen.value===n?0:n;try{if(chosen.value)localStorage.setItem(storageKey.value,String(chosen.value));else localStorage.removeItem(storageKey.value);storageFailed.value=false;}catch{storageFailed.value=true;}}
const image=computed(()=>textbookDirectImage(props.page));
const asset=computed(()=>textbookAssetUrl(upscaleFailed.value?image.value.fallbackAsset:image.value.asset));
function imageError(){if(image.value.improved&&!upscaleFailed.value)upscaleFailed.value=true;}
function frame(rect:number[]){return {aspectRatio:`${rect[2]}/${rect[3]}`};}
function imageStyle(rect:number[]){return {width:`${props.page.size[0]/rect[2]*100}%`,left:`${-rect[0]/rect[2]*100}%`,top:`${-rect[1]/rect[3]*100}%`};}
</script>
<template>
 <article class="book-direct-question" :data-source-id="source.id">
  <small class="direct-status">교재 원문 · 자가확인<template v-if="image.improved&&!upscaleFailed"> · 2배 화질 개선</template><template v-if="upscaleFailed"> · 원해상도 대체 표시</template></small>
  <p v-if="!source.split" class="direct-caution">풀이가 함께 포함될 수 있는 원문입니다. 아래 ‘원문 쪽 전체 보기’에서 이어지는 그림·풀이도 확인하세요.</p>
  <figure class="direct-viewport textbook-explanation-image" :style="frame(source.questionRect)">
   <img :src="asset" :style="imageStyle(source.questionRect)" :class="{'restored-image-original':original}" :width="page.size[0]" :height="page.size[1]" :alt="`한솔 교재 ${source.page}쪽 원문 문제`" loading="lazy" decoding="async" @error="imageError">
  </figure>
  <div class="direct-choices" role="group" :aria-label="`${source.page}쪽 ${source.number}번 내 답안 기록`">
   <button v-for="n in 4" :key="n" type="button" :aria-pressed="chosen===n" @click="choose(n)">{{['①','②','③','④'][n-1]}}</button>
   <small>{{chosen?`${chosen}번 선택 · 다시 누르면 취소`:'내 답안 선택'}}</small>
  </div>
  <p v-if="storageFailed" role="status">현재 기기에 선택을 저장하지 못했습니다.</p>
  <details class="direct-solution" :open="answerOpen" @toggle="answerOpen=($event.target as HTMLDetailsElement).open">
   <summary>{{source.split?'교재 풀이·정답표 확인':'교재 정답표 확인'}}</summary>
   <figure v-if="source.solutionRect" class="direct-viewport textbook-explanation-image" :style="frame(source.solutionRect)"><img :src="asset" :style="imageStyle(source.solutionRect)" :class="{'restored-image-original':original}" :alt="`교재 ${source.page}쪽 원문 풀이`" loading="lazy" decoding="async" @error="imageError"></figure>
   <small>인쇄 정답표 · 작게 줄이지 않습니다. 옆으로 밀어 확인하세요.</small>
   <div class="direct-key-scroll" tabindex="0" :aria-label="`${source.page}쪽 정답표 가로 스크롤`"><figure class="direct-viewport textbook-explanation-image" :style="{...frame(page.answerKeyRect),width:`${page.answerKeyRect[2]}px`}"><img :src="asset" :style="imageStyle(page.answerKeyRect)" :class="{'restored-image-original':original}" :alt="`교재 ${source.page}쪽 인쇄 정답표`" loading="lazy" decoding="async" @error="imageError"></figure></div>
   <small>책에 인쇄된 문제 번호로 확인하세요. 이 원문은 자동채점·점수에 포함하지 않습니다.</small>
  </details>
  <details class="direct-full-page" :open="fullOpen" @toggle="fullOpen=($event.target as HTMLDetailsElement).open"><summary>원문 쪽 전체 보기 · {{source.page}}쪽</summary><p>잘린 듯 보이거나 다음 열로 이어지는 문제·풀이를 책 한 쪽 전체에서 확인합니다. 정답표도 포함됩니다. <a :href="asset" target="_blank" rel="noopener">원문 이미지 크게 열기 ↗</a></p><figure class="textbook-explanation-image"><img v-if="fullOpen" :src="asset" :class="{'restored-image-original':original}" :width="page.size[0]" :height="page.size[1]" :alt="`교재 ${source.page}쪽 전체 원문`"></figure></details>
 </article>
</template>
<style scoped>
.direct-key-scroll{max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;margin:5px 0 8px}.direct-key-scroll:focus-visible{outline:2px solid var(--primary)}.direct-full-page a{color:var(--book-accent,var(--primary))}
.book-direct-question{min-width:0}.direct-status{display:block;color:var(--muted);font-size:11px;margin-bottom:7px}.direct-caution{font-size:12px;line-height:1.5;color:var(--muted);padding:7px;border-left:2px solid var(--primary)}.direct-viewport{position:relative;overflow:hidden;margin:0!important;width:100%;background:white;contain:paint}.direct-viewport img{position:absolute;max-width:none!important;height:auto!important;display:block;object-fit:initial;pointer-events:none}.direct-choices{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:7px}.direct-choices button{font:inherit;font-size:20px;min-width:42px;min-height:42px;border:1px solid var(--line);border-radius:4px;color:var(--book-ink,var(--text));background:transparent;cursor:pointer}.direct-choices button[aria-pressed=true]{border-color:var(--book-accent,var(--primary));background:var(--primary-soft)}.direct-choices small{color:var(--muted);font-size:11px}.direct-solution,.direct-full-page{margin-top:9px;font-size:12px;color:var(--muted)}summary{cursor:pointer;min-height:32px;padding:7px 0}.direct-solution[open]{padding:8px;background:var(--surface-2);border-left:2px solid var(--book-accent,var(--primary))}.direct-solution .direct-viewport+figure{margin-top:12px!important}.direct-full-page img{max-width:none;width:100%}.direct-full-page p{line-height:1.5}:root[data-theme=dark] .direct-viewport{background:#0d1824}@media(max-width:600px){.direct-choices button{min-width:44px;min-height:44px}.direct-solution,.direct-full-page{font-size:13px}}
</style>
