<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
const emit = defineEmits<{ more: [] }>();
const target = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | undefined;
onMounted(() => {
  observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) emit('more');
  }, { rootMargin: '400px' });
  if (target.value) observer.observe(target.value);
});
onBeforeUnmount(() => observer?.disconnect());
</script>
<template><button ref="target" type="button" class="practical-load-more" @click="emit('more')">아래 문제 계속 보기</button></template>
