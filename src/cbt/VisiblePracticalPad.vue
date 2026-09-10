<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue';
const Pad = defineAsyncComponent(() => import('./PracticalAnswerPad.vue'));
defineProps<{ promptId: string; disabled?: boolean; answerImages?: string[]; overlayAllowed?: boolean }>();
const host = ref<HTMLElement | null>(null);
const near = ref(false);
const expanded = ref(false);
const height = ref(540);
let observer: IntersectionObserver | undefined;
let resize: ResizeObserver | undefined;
onMounted(() => {
  if (!host.value) return;
  observer = new IntersectionObserver(entries => {
    const entry = entries[0];
    if (!entry) return;
    if (!entry.isIntersecting && near.value) height.value = host.value?.offsetHeight || height.value;
    near.value = entry.isIntersecting;
  }, { rootMargin: '500px' });
  observer.observe(host.value);
  resize = new ResizeObserver(() => {
    if (near.value && host.value && !expanded.value && host.value.offsetHeight > 100) height.value = host.value.offsetHeight;
  });
  resize.observe(host.value);
});
onBeforeUnmount(() => { observer?.disconnect(); resize?.disconnect(); });
</script>
<template><div ref="host" :style="near && !expanded ? undefined : { minHeight: height + 'px' }"><Pad v-if="near || expanded" :prompt-id="promptId" :disabled="disabled" :answer-images="answerImages" :overlay-allowed="overlayAllowed" @expanded="expanded = $event" /></div></template>
