<script setup lang="ts">
import TextbookDirectRegion from './TextbookDirectRegion.vue';
import {type TextbookDirectSource, type TextbookDirectPage} from './textbookPages';
const props=defineProps<{source:TextbookDirectSource;page:TextbookDirectPage;asset:string;original:boolean}>();
const emit=defineEmits<{fallback:[page:string]}>();
function keyStyle(){const r=props.page.answerKeyRect;return {width:`${props.page.size[0]/r[2]*100}%`,left:`${-r[0]/r[2]*100}%`,top:`${-r[1]/r[3]*100}%`};}
</script>
<template>
 <div class="direct-solution-parts"><TextbookDirectRegion v-for="(part,index) in source.solutionParts" :key="`${source.id}-solution-${index}`" :part="part" :original="original" :alt="`교재 ${part.page}쪽 ${source.number}번 원문 풀이${index?' 이어짐':''}`" @fallback="emit('fallback',$event)"/></div>
 <small>인쇄 정답표 · 작게 줄이지 않습니다. 옆으로 밀어 확인하세요.</small>
 <div class="direct-key-scroll" tabindex="0" :aria-label="`${source.page}쪽 정답표 가로 스크롤`"><figure class="direct-viewport textbook-explanation-image" :style="{aspectRatio:`${page.answerKeyRect[2]}/${page.answerKeyRect[3]}`,width:`${page.answerKeyRect[2]}px`}"><img  :src="$problemImage(asset)" :style="keyStyle()" :class="{'restored-image-original':original}" :alt="`교재 ${source.page}쪽 인쇄 정답표`" loading="lazy" decoding="async" @error="emit('fallback',source.page)"></figure></div>
</template>
<style scoped>
.direct-key-scroll{max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;margin:5px 0 8px}.direct-key-scroll:focus-visible{outline:2px solid var(--primary)}.direct-viewport{position:relative;overflow:hidden;margin:0!important;background:white;contain:paint}.direct-viewport img{position:absolute;max-width:none!important;height:auto!important;display:block;object-fit:initial;pointer-events:none}:root[data-theme=dark] .direct-viewport{background:#0d1824}
</style>
