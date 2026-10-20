<script setup lang="ts">
import { ref } from 'vue';
defineProps<{ text: string; image?: string | null; imageTheme?: string }>();
const expanded = ref(false);
const failed = ref(false);
</script>

<template>
  <details v-if="image" class="library-image-preview" @toggle="expanded = ($event.target as HTMLDetailsElement).open">
    <summary>문제 원문 미리보기 <small>이미지 지문</small></summary>
    <img v-if="expanded && !failed" :src="image" :class="`restored-image-${imageTheme || 'auto'}`" alt="문제 원문 미리보기" decoding="async" @error="failed = true">
    <p v-if="failed" role="status">그림을 불러오지 못했습니다. <button type="button" @click="failed = false">다시 불러오기</button></p>
    <small>답안 선택·확대는 문제를 열어 이용하세요.</small>
  </details>
  <p v-else>{{ text || '문제를 열어 지문을 확인하세요.' }}</p>
</template>

<style scoped>
.library-image-preview { margin-block:.8rem; min-width:0; }
.library-image-preview summary { cursor:pointer; padding:.5rem 0; font-weight:700; }
.library-image-preview small { display:block; margin-top:.3rem; font-size:.85rem; color:var(--muted); }
.library-image-preview img { display:block; width:100%; height:auto; max-height:none; margin-top:.7rem; border-radius:6px; object-fit:contain; }
.library-image-preview button { min-height:44px; padding:.5rem; color:inherit; border:1px solid currentColor; border-radius:6px; background:transparent; }
</style>
