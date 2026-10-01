<script setup lang="ts">
import { computed, ref } from 'vue';
import type { QuestionItem, StudyMode } from './types';
import { uniqueSchoolItems } from './schoolQuestionBank';

const props = defineProps<{ items: QuestionItem[]; wrongIds: string[]; loading: boolean; error: string }>();
const emit = defineEmits<{
  start: [payload: { items: QuestionItem[]; mode: StudyMode; randomCount: number }];
  search: [];
  retry: [];
}>();
const source = ref('all');
const count = ref(20);
const pool = computed(() => uniqueSchoolItems(props.items.filter(item => source.value === 'all' || item.round.qualificationKey === source.value)));
const wrongPool = computed(() => pool.value.filter(item => props.wrongIds.includes(item.id)));
const sourceCount = (key: string) => props.items.filter(item => item.round.qualificationKey === key).length;
</script>

<template>
  <section class="cooling-midterm" aria-label="냉동공학 중간고사">
    <header><div><span>학교 시험 · 냉동냉장설비 전체</span><h2>냉동공학 중간고사</h2><p>공조와 한솔의 냉동냉장설비 기출을 함께 풉니다. 예전 과목명 ‘냉동공학’도 포함합니다.</p></div><strong>{{ loading ? '불러오는 중' : `${pool.length.toLocaleString()}문제` }}</strong></header>
    <p class="range-note">시험 범위: 냉동냉장설비 전체 · 교재 핵심예상문제의 페이지별 대조는 아직 하지 않았습니다.</p>
    <div class="midterm-controls">
      <label>문제 출처<select v-model="source"><option value="all">공조 + 한솔 전체</option><option value="hvac">공조 기출 · {{ sourceCount('hvac') }}문제</option><option value="hvac-hansol">한솔 공조 · {{ sourceCount('hvac-hansol') }}문제</option></select></label>
      <label>랜덤 문제 수<select v-model.number="count"><option v-for="size in [10, 20, 40, 60]" :key="size" :value="size">{{ size }}문제</option></select></label>
      <button type="button" @click="emit('search')">통합 검색으로 문제 찾기</button>
    </div>
    <p v-if="error" role="alert">{{ error }} <button type="button" @click="emit('retry')">다시 불러오기</button></p>
    <div class="midterm-actions">
      <button type="button" :disabled="loading || !pool.length" @click="emit('start', { items: pool, mode: 'learn', randomCount: 0 })">전체 문제 학습</button>
      <button type="button" :disabled="loading || !pool.length" @click="emit('start', { items: pool, mode: 'learn', randomCount: count })">랜덤 {{ Math.min(count, pool.length) }}문제 학습</button>
      <button type="button" :disabled="loading || !pool.length" @click="emit('start', { items: pool, mode: 'exam', randomCount: count })">랜덤 {{ Math.min(count, pool.length) }}문제 CBT</button>
      <button type="button" :disabled="loading || !wrongPool.length" @click="emit('start', { items: wrongPool, mode: 'learn', randomCount: 0 })">오답 {{ wrongPool.length }}문제 복습</button>
    </div>
    <small>문제 그림·정답·해설은 기존 자료를 사용하며 완전히 같은 문제는 한 번만 표시합니다. 학습 내역에서 이어 풀고 오답노트에서 틀린 문제를 복습할 수 있습니다.</small>
  </section>
</template>

<style scoped>
.cooling-midterm{padding:24px;margin-bottom:20px;border:1px solid var(--primary);border-radius:20px;background:var(--surface);color:var(--text)}header{display:flex;align-items:start;justify-content:space-between;gap:16px}header span{color:var(--primary);font-weight:800;font-size:.9rem}h2{margin:7px 0;font-size:1.6rem}p{line-height:1.65;margin:8px 0}header strong{white-space:nowrap;font-size:1.1rem}.range-note{color:var(--muted);font-size:.85rem}.midterm-controls,.midterm-actions{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin:18px 0}label{display:grid;gap:6px;font-weight:800;font-size:.9rem}select,button{min-height:46px;padding:9px 14px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);color:var(--text);font:inherit}button{cursor:pointer;font-weight:800}button:disabled{opacity:.45;cursor:default}.midterm-actions button{flex:1;background:var(--primary);color:#fff}small{display:block;color:var(--muted);line-height:1.7;font-size:.85rem}@media(max-width:600px){.cooling-midterm{padding:18px}header{display:block}.midterm-controls{display:grid;grid-template-columns:1fr 1fr}.midterm-controls>button{grid-column:1/-1}select{width:100%;min-width:0}.midterm-actions{display:grid;grid-template-columns:1fr}h2{font-size:1.35rem}}
</style>
