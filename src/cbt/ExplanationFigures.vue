<script setup lang="ts">
defineProps<{images?:string[];folded?:boolean;imageClass?:string}>();
const emit=defineEmits<{interact:[]}>();
</script>
<template>
 <details v-if="folded&&images?.length" class="original-textbook-explanation" @click="emit('interact')"><summary>교재 원문 해설 이미지 보기</summary><figure v-for="image in images" :key="image" class="textbook-explanation-image"><figcaption>교재 원문 해설</figcaption><img :src="image" :class="imageClass" alt="교재 원문 해설" loading="lazy" decoding="async"></figure></details>
 <template v-else><figure v-for="image in images||[]" :key="image" class="textbook-explanation-image" @click="emit('interact')"><figcaption>교재 원문 해설</figcaption><img :src="image" :class="imageClass" alt="교재 원문 해설" loading="lazy" decoding="async"></figure></template>
</template>
