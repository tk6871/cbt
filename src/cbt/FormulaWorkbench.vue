<script setup lang="ts">
import { computed, ref } from 'vue';
import { ComputeEngine } from '@cortex-js/compute-engine';
import { Calculator, RotateCcw, X } from '@lucide/vue';
import MathFormula from './MathFormula.vue';

defineEmits<{ close: [] }>();
const engine = new ComputeEngine();
const latex = ref(String.raw`\frac{(760-300)\times101.325}{760}`);
const parsed = computed(() => {
  try {
    const expression = engine.parse(latex.value);
    return {
      valid: expression.errors.length === 0,
      simplified: expression.simplify().latex,
      result: expression.N().latex,
    };
  } catch {
    return { valid: false, simplified: '', result: '' };
  }
});

function reset(): void {
  latex.value = String.raw`\frac{(760-300)\times101.325}{760}`;
}
</script>

<template>
  <section class="formula-workbench">
    <header><div><span><Calculator :size="18" /></span><strong>수식 계산 실험실</strong><small>LaTeX 수식을 해석하고 계산 결과를 확인합니다</small></div><button type="button" aria-label="닫기" @click="$emit('close')"><X :size="18" /></button></header>
    <label>LaTeX 수식<textarea v-model="latex" rows="3" spellcheck="false" /></label>
    <div v-if="parsed.valid" class="formula-workbench-result">
      <article><span>입력 수식</span><MathFormula :tex="latex" label="입력한 계산식" /></article>
      <article><span>정리된 식</span><MathFormula :tex="parsed.simplified" label="정리된 계산식" /></article>
      <article class="answer"><span>계산 결과</span><MathFormula :tex="parsed.result" label="계산 결과" /></article>
    </div>
    <p v-else>수식 기호나 괄호를 확인해 주세요. 원본 공식과 답은 변경하지 않습니다.</p>
    <footer><button type="button" @click="reset"><RotateCcw :size="15" /> 예시로 초기화</button><small>이 도구는 직접 열었을 때만 약 3MB 계산 엔진을 불러옵니다.</small></footer>
  </section>
</template>

<style scoped>
.formula-workbench{margin:12px 0;padding:16px;border:1px solid var(--line);border-radius:18px;background:var(--surface);box-shadow:var(--shadow)}.formula-workbench>header{display:flex;align-items:center;justify-content:space-between;gap:12px}.formula-workbench>header>div{display:grid;grid-template-columns:38px 1fr;align-items:center;column-gap:9px}.formula-workbench>header span{grid-row:1/3;width:38px;height:38px;border-radius:11px;color:var(--primary);background:var(--primary-soft);display:grid;place-items:center}.formula-workbench>header strong,.formula-workbench>header small{display:block}.formula-workbench>header strong{font-size:.78rem}.formula-workbench>header small{color:var(--muted);font-size:.56rem}.formula-workbench>header>button{width:34px;height:34px;border-radius:8px;color:var(--muted);background:var(--surface-2);display:grid;place-items:center}.formula-workbench>label{margin-top:13px;color:var(--muted);display:grid;gap:6px;font-size:.58rem;font-weight:850}.formula-workbench textarea{width:100%;padding:10px;border:1px solid var(--line);border-radius:9px;color:var(--text);background:var(--surface-2);font-family:"D2Coding",monospace;font-size:.68rem;resize:vertical}.formula-workbench-result{margin-top:11px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.formula-workbench-result article{min-width:0;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2)}.formula-workbench-result article>span{color:var(--muted);font-size:.51rem;font-weight:850}.formula-workbench-result article.answer{border-color:color-mix(in srgb,var(--primary) 50%,var(--line));background:var(--primary-soft)}.formula-workbench>p{padding:10px;border-radius:8px;color:var(--red);background:var(--red-soft);font-size:.59rem}.formula-workbench>footer{margin-top:10px;display:flex;align-items:center;justify-content:space-between;gap:9px}.formula-workbench>footer button{min-height:34px;padding:0 9px;border:1px solid var(--line);border-radius:8px;color:var(--text);background:var(--surface-2);display:flex;align-items:center;gap:5px;font-size:.53rem;font-weight:800}.formula-workbench>footer small{color:var(--muted);font-size:.5rem}@media(max-width:720px){.formula-workbench-result{grid-template-columns:1fr}.formula-workbench>footer{align-items:flex-start;flex-direction:column}}
</style>
