<script setup lang="ts">
import MathFormula from './MathFormula.vue';
import { fractionTex, fractionText, type FractionLine } from './practicalFractions';
defineProps<{ rows: FractionLine[] }>();
</script>
<template>
  <div class="practical-fraction-lines">
    <div v-for="(row, index) in rows" :key="index" class="practical-fraction-line">
      <MathFormula :tex="fractionTex(row.parts)" :label="fractionText(row.parts)" />
      <p v-if="row.note" class="fraction-reading">{{ row.note }}</p>
    </div>
  </div>
</template>
<style scoped>
.practical-fraction-lines{min-width:0;margin-block:.5rem}
.practical-fraction-line{min-width:0;padding:.35rem 0}
.practical-fraction-line :deep(.math-formula){overflow-x:auto;max-width:100%;padding:.4rem 0;font-size:1rem}
.practical-fraction-line :deep(.katex-display){margin:.3rem 0;text-align:left}
.practical-fraction-line :deep(.katex-display>.katex){text-align:left}
.fraction-reading{margin:.4rem 0 0;font-size:.95rem;line-height:1.65;color:var(--muted)}
</style>
