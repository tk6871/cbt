<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { PracticalPrompt } from './hvacPracticalTypes';
import { calculationLesson, calculationPrompts, practicalSiBasics, practicalCalculationPdf, practicalCalculationReferences } from './practicalCalculations';
defineOptions({ name:'PracticalCalculationLibrary' });
const props = defineProps<{ prompts: PracticalPrompt[] }>();
const emit = defineEmits<{ start: [ids: string[], memorize: boolean] }>();
const storageKey = 'cbt-practical-calculation-filters';
function readFilters(): Record<string, unknown> {
  try { const value = JSON.parse(localStorage.getItem(storageKey) || '{}'); return value && typeof value === 'object' ? value : {}; }
  catch { return {}; }
}
const stored = readFilters();
const topic = ref(typeof stored.topic === 'string' && ['all','공기조화','열관류','배관','냉동사이클','열량·부하','펌프','압력'].includes(stored.topic) ? stored.topic : 'all');
const source = ref(typeof stored.source === 'string' && ['all','restored','practice'].includes(stored.source) ? stored.source : 'all');
const kind = ref(typeof stored.kind === 'string' && ['all','numeric','formula'].includes(stored.kind) ? stored.kind : 'all');
watch([topic, source, kind], () => {
  try { localStorage.setItem(storageKey, JSON.stringify({ topic:topic.value, source:source.value, kind:kind.value })); } catch { /* Viewing remains available if device storage is full. */ }
});
const rows = computed(() => calculationPrompts(props.prompts));
const topics = computed(() => [...new Set(rows.value.map(p => calculationLesson(p)!.topic))]);
const filtered = computed(() => rows.value.filter(p => {
  const lesson = calculationLesson(p)!;
  return (topic.value === 'all' || lesson.topic === topic.value)
    && (source.value === 'all' || (source.value === 'restored' ? p.group === 'restored' : p.group !== 'restored'))
    && (kind.value === 'all' || lesson.kind === kind.value);
}));
function start(memorize: boolean, prompt?: PracticalPrompt) {
  emit('start', prompt ? [prompt.id] : filtered.value.map(p => p.id), memorize);
}
</script>

<template>
  <section class="practical-calculation-library">
    <header><div><h3>필답형 계산문제 모아보기</h3><p>기호 읽기부터 숫자 대입·단위 약분까지. 복원문제와 연습문제를 함께 공부합니다.</p></div><a :href="practicalCalculationPdf" download>공식·풀이 PDF 받기 ↓</a></header>
    <details class="practical-si-basics"><summary>계산이 처음이라면 · SI 단위부터 읽기</summary><article v-for="item in practicalSiBasics" :key="item.title"><h4>{{ item.title }}</h4><p>{{ item.text }}</p></article></details>
    <div class="practical-calculation-filters">
      <label>유형<select v-model="topic"><option value="all">모든 유형</option><option v-for="item in topics" :key="item">{{ item }}</option></select></label>
      <label>출처<select v-model="source"><option value="all">복원 + 연습 전체</option><option value="restored">회차별 복원문제</option><option value="practice">추가 자료·기초·심화</option></select></label>
      <label>문제 종류<select v-model="kind"><option value="all">계산 + 공식 쓰기</option><option value="numeric">숫자 계산만</option><option value="formula">공식 쓰기만</option></select></label>
    </div>
    <div class="practical-calculation-start"><strong>{{ filtered.length }}문제</strong><button :disabled="!filtered.length" type="button" @click="start(false)">선택 범위 문제부터 풀기</button><button :disabled="!filtered.length" type="button" @click="start(true)">풀이·공식 공부하기</button></div>
    <p class="calculation-scope-note">기존 계산 분류에 공기조화의 혼합공기·전열 계산도 포함했습니다. 단순 명칭·운전 서술은 제외했습니다. 기존 답안과 추가 계산 풀이를 함께 제공합니다.</p>
    <ol class="practical-calculation-index"><li v-for="prompt in filtered" :key="prompt.id"><div><small>{{ calculationLesson(prompt)!.topic }} · {{ calculationLesson(prompt)!.kind === 'numeric' ? '수치 계산' : '공식 쓰기' }} · {{ prompt.year ? `${prompt.year}년 ${prompt.session}회 ${prompt.number}번` : prompt.group === 'foundation' ? '기초 연습' : prompt.group === 'drill' ? '심화 연습' : '추가 자료' }}</small><strong>{{ calculationLesson(prompt)!.title }}</strong><p>{{ prompt.question }}</p></div><button type="button" @click="start(true, prompt)">이 문제 공부 →</button></li></ol>
    <p v-if="!filtered.length">해당 조건의 문제가 없습니다. 유형이나 출처를 전체로 바꿔 보세요.</p>
    <details><summary>공식 원리 참고 자료</summary><p>문항 수치와 조건은 기존 복원·연습 자료를 따릅니다. 기본 원리는 아래 자료와 대조했습니다. 문제에서 준 비열·밀도·환산값이 우선입니다.</p><a v-for="reference in practicalCalculationReferences" :key="reference.url" :href="reference.url" target="_blank" rel="noreferrer">{{ reference.title }} ↗ </a></details>
  </section>
</template>
