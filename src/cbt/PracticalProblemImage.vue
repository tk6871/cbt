<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';
defineProps<{ src: string; alt: string; maxHeight?: number }>();
const dialog = ref<HTMLDialogElement | null>(null);
const zoom = ref(100);
const opened = ref(false);
const viewport = ref<HTMLDivElement | null>(null);
watch(zoom, async () => {
  await nextTick();
  const area = viewport.value;
  if (!area) return;
  // Center the enlarged image, not the letterbox margin of a portrait diagram.
  area.scrollLeft = Math.max(0, (area.scrollWidth - area.clientWidth) / 2);
  area.scrollTop = Math.max(0, (area.scrollHeight - area.clientHeight) / 2);
});
function open(): void { zoom.value = 100; opened.value = true; dialog.value?.showModal(); }
onBeforeUnmount(() => dialog.value?.close());
</script>
<template>
  <button type="button" class="practical-image-button" :aria-label="alt + ' 크게 보기'" @click="open">
    <img class="practical-prompt-image" :src="src" :alt="alt" :style="maxHeight ? {maxHeight: maxHeight + 'px', height: 'auto', width: 'auto', maxWidth: '100%', marginInline: 'auto'} : undefined" loading="lazy" decoding="async">
    <span>그림 크게 보기 ↗</span>
  </button>
  <dialog ref="dialog" class="practical-image-dialog" :aria-label="alt" @close="opened = false">
    <header><strong>{{ alt }}</strong><label>확대 <select v-model.number="zoom" aria-label="그림 확대 비율"><option v-for="size in [100,150,200,300,400]" :key="size" :value="size">{{ size === 100 ? '그림 전체 맞춤' : size + '%' }}</option></select></label><button type="button" autofocus @click="dialog?.close()">닫기</button></header>
    <div v-if="opened" ref="viewport" class="practical-image-viewport">
      <button type="button" class="practical-image-close-target" :aria-label="alt + ' 확대 닫기'" :style="{ width: zoom + '%', height: zoom + '%' }" @click="dialog?.close()">
        <img :src="src" :alt="alt">
      </button>
    </div>
  </dialog>
</template>
