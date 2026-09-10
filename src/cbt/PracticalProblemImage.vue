<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
defineProps<{ src: string; alt: string }>();
const dialog = ref<HTMLDialogElement | null>(null);
const zoom = ref(100);
const opened = ref(false);
function open(): void { zoom.value = 100; opened.value = true; dialog.value?.showModal(); }
onBeforeUnmount(() => dialog.value?.close());
</script>
<template>
  <button type="button" class="practical-image-button" :aria-label="alt + ' 크게 보기'" @click="open">
    <img class="practical-prompt-image" :src="src" :alt="alt" loading="lazy" decoding="async">
    <span>그림 크게 보기 ↗</span>
  </button>
  <dialog ref="dialog" class="practical-image-dialog" :aria-label="alt" @close="opened = false">
    <header><strong>{{ alt }}</strong><label>확대 <select v-model.number="zoom"><option v-for="size in [100,150,200]" :key="size" :value="size">{{ size }}%</option></select></label><button type="button" autofocus @click="dialog?.close()">닫기</button></header>
    <div v-if="opened"><img :src="src" :alt="alt" :style="{ width: zoom + '%', maxWidth: 'none' }"></div>
  </dialog>
</template>
