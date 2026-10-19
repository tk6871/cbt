<script setup lang="ts">
import type { CalculationLesson } from './practicalCalculations';
defineProps<{ lesson: CalculationLesson }>();
</script>

<template>
  <section class="practical-calculation-lesson" aria-label="초보자 계산 풀이">
    <h4>{{ lesson.title }}</h4>
    <section v-if="lesson.numberSelection" class="calculation-number-selection" aria-label="함정과 조건 구별">
      <h5>숫자부터 골라보기 · 함정과 조건 구별</h5>
      <p><b>이번 계산에 쓰는 값</b> {{ lesson.numberSelection.used }}</p>
      <p v-if="lesson.numberSelection.unused" class="calculation-unused"><b>이번 식에는 안 쓰는 값</b> {{ lesson.numberSelection.unused }}</p>
      <p><b>반드시 읽을 조건</b> {{ lesson.numberSelection.condition }}</p>
    </section>
    <div class="calculation-formula"><b>먼저 외울 공식</b><p>{{ lesson.formula }}</p></div>
    <details class="calculation-symbols" open><summary>기호는 무슨 뜻일까?</summary><ul><li v-for="symbol in lesson.symbols" :key="symbol">{{ symbol }}</li></ul></details>
    <p><b>왜 이렇게 계산할까?</b> {{ lesson.why }}</p>
    <div class="calculation-steps"><b>숫자 넣어 풀기</b><ol><li v-for="step in lesson.steps" :key="step">{{ step }}</li></ol></div>
    <details class="calculation-units" open><summary>단위가 왜 이렇게 남을까?</summary><ul><li v-for="unit in lesson.units" :key="unit">{{ unit }}</li></ul></details>
    <div v-if="lesson.examAnswer" class="calculation-final"><b>시험 답안의 최종값 예시</b><p>{{ lesson.examAnswer }}</p><small>{{ lesson.rounding }} 위 계산과정도 함께 작성하세요.</small></div>
    <p class="calculation-memory"><b>한 줄로 기억</b> {{ lesson.memory }}</p>
    <p v-if="lesson.caution" class="calculation-caution"><b>이 문제의 조건</b> {{ lesson.caution }}</p>
  </section>
</template>
