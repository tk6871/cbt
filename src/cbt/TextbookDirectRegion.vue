<script setup lang="ts">
import {computed,ref,watch} from 'vue';
import {textbookAssetUrl,textbookDirectImage,textbookDirectPageMap,type TextbookDirectPart} from './textbookPages';
const props=defineProps<{part:TextbookDirectPart;original:boolean;alt:string}>();
const emit=defineEmits<{fallback:[page:string]}>();
const failed=ref(false);
const page=computed(()=>textbookDirectPageMap.get(props.part.page));
const size=computed(()=>props.part.size||page.value?.size||[1,1]);
const image=computed(()=>props.part.asset?{asset:props.part.asset,fallbackAsset:props.part.asset,improved:false}:page.value?textbookDirectImage(page.value):undefined);
const asset=computed(()=>textbookAssetUrl((failed.value?image.value?.fallbackAsset:image.value?.asset)||''));
watch(()=>props.part,()=>{failed.value=false;});
function imageError(){if(image.value?.improved&&!failed.value){failed.value=true;emit('fallback',props.part.page);}}
const frame=computed(()=>({aspectRatio:`${props.part.rect[2]}/${props.part.rect[3]}`}));
const style=computed(()=>{const r=props.part.rect;return {width:`${size.value[0]!/r[2]!*100}%`,left:`${-r[0]!/r[2]!*100}%`,top:`${-r[1]!/r[3]!*100}%`};});
</script>
<template>
 <div class="direct-region" :data-page="part.page" :data-rect="part.rect.join(',')">
  <small v-if="part.label" class="direct-part-label">{{part.label}} · {{part.page}}쪽</small>
  <figure class="direct-viewport textbook-explanation-image" :style="frame">
   <img  v-if="image" :src="$problemImage(asset)" :style="style" :class="{'restored-image-original':original}" :width="size[0]" :height="size[1]" :alt="alt" loading="lazy" decoding="async" @error="imageError">
  </figure>
 </div>
</template>
<style scoped>
.direct-region{min-width:0}.direct-region+.direct-region{margin-top:8px}.direct-part-label{display:block;color:var(--muted);font-size:12px;margin-bottom:4px}.direct-viewport{position:relative;overflow:hidden;margin:0!important;width:100%;background:white;contain:paint}.direct-viewport img{position:absolute;max-width:none!important;height:auto!important;display:block;object-fit:initial;pointer-events:none}:root[data-theme=dark] .direct-viewport{background:#0d1824}
</style>
