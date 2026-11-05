<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import {useImageTranscription} from './imageTranscription';
const props=defineProps<{source:string;imageClass?:string}>();
const {entry,pending}=useImageTranscription(computed(()=>props.source));
const imageOverride=ref(false);
watch(()=>props.source,()=>imageOverride.value=false);
const visibleText=computed(()=>!imageOverride.value&&entry.value?.kind==='explanation'?entry.value:undefined);
</script>
<template>
 <figure class="textbook-explanation-image transcription-figure">
  <figcaption>교재 원문 해설 <button v-if="entry" type="button" @click="imageOverride=!imageOverride">{{visibleText?'이미지로 보기':'텍스트로 보기'}}</button></figcaption>
  <small v-if="pending" role="status">텍스트 확인 중…</small>
  <template v-else-if="visibleText">
   <small>{{visibleText.status==='reviewed'?'원문 대조 텍스트':'OCR 임시 텍스트 · 글자·수식이 다르면 이미지로 확인'}}</small>
   <p class="transcription-text">{{visibleText.text}}</p>
  </template>
  <img v-else :src="$problemImage(source)" :class="imageClass" alt="교재 원문 해설" loading="lazy" decoding="async">
 </figure>
</template>
<style scoped>
.transcription-figure figcaption{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.transcription-figure button{font:inherit;padding:5px 9px;min-height:36px;border:1px solid var(--line);border-radius:6px;background:var(--surface-2);color:var(--text);cursor:pointer}.transcription-figure small{display:block;color:var(--muted);font-size:.78rem}.transcription-text{white-space:pre-line;overflow-wrap:anywhere;font-size:max(16px,var(--explanation-text-size,1rem));line-height:1.7;margin:7px 0;color:var(--text)}
</style>
