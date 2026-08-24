<script setup lang="ts">
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { computed } from 'vue';

const props = defineProps<{ tex: string; label: string }>();
const markup = computed(() => katex.renderToString(props.tex, {
  displayMode: true,
  throwOnError: false,
  strict: 'ignore',
  output: 'htmlAndMathml',
}));
</script>

<template>
  <div class="math-formula" :aria-label="label" v-html="markup" />
</template>
