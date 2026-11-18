<script setup lang="ts">
import {explanationDisplay} from './explanationDisplay';
import TranscribedFigure from './TranscribedFigure.vue';
defineProps<{images?:string[];folded?:boolean;imageClass?:string}>();
const emit=defineEmits<{interact:[]}>();
</script>
<template>
 <details v-if="folded&&explanationDisplay==='text'&&images?.length" class="original-textbook-explanation" @click="emit('interact')">
  <summary>교재 원문 해설 보기</summary>
  <TranscribedFigure v-for="image in images" :key="image" :source="image" :image-class="imageClass" />
 </details>
 <template v-else><TranscribedFigure v-for="image in images||[]" :key="image" :source="image" :image-class="imageClass" @click="emit('interact')"/></template>
</template>
