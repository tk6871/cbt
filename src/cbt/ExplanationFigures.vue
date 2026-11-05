<script setup lang="ts">
import {explanationDisplay} from './explanationDisplay';
import TranscribedFigure from './TranscribedFigure.vue';
defineProps<{images?:string[];folded?:boolean;imageClass?:string}>();
const emit=defineEmits<{interact:[]}>();
</script>
<template>
 <details v-if="folded&&explanationDisplay==='text'&&images?.length" class="original-textbook-explanation" @click="emit('interact')"><summary>교재 원문 해설 이미지 보기</summary><figure v-for="image in images" :key="image" class="textbook-explanation-image"><figcaption>교재 원문 해설</figcaption><img  :src="$problemImage(image)" :class="imageClass" alt="교재 원문 해설" loading="lazy" decoding="async"></figure></details>
 <template v-else><TranscribedFigure v-for="image in images||[]" :key="image" :source="image" :image-class="imageClass" @click="emit('interact')"/></template>
</template>
