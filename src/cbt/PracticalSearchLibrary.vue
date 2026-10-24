<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { practicalCategoryLabels, type PracticalPrompt } from './hvacPracticalTypes';
import { practicalSourceLabel } from './practicalLabels';
import { createPracticalSearchIndex, practicalSearchGroupLabels, searchPracticalPrompts, type PracticalSearchOptions } from './practicalSearch';

const props = defineProps<{ prompts: PracticalPrompt[] }>();
const emit = defineEmits<{ open: [ids: string[], selectedId?: string] }>();
const storageKey = 'cbt-practical-library-search-v1';
const options = ref<PracticalSearchOptions>({ query: '', group: 'all', category: 'all', field: 'all' });
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
  if (saved && typeof saved === 'object') {
    if (typeof saved.query === 'string') options.value.query = saved.query.slice(0, 200);
    if (saved.group === 'all' || Object.hasOwn(practicalSearchGroupLabels, saved.group)) options.value.group = saved.group;
    if (saved.category === 'all' || Object.hasOwn(practicalCategoryLabels, saved.category)) options.value.category = saved.category;
    if (['all', 'question', 'answer', 'explanation'].includes(saved.field)) options.value.field = saved.field;
  }
} catch { /* Invalid search preferences must not affect saved answers. */ }
const index = computed(() => createPracticalSearchIndex(props.prompts));
const results = computed(() => searchPracticalPrompts(index.value, options.value));
const limit = ref(40);
const visible = computed(() => results.value.slice(0, limit.value));
const fieldLabels = { question: '문제', answer: '정답', explanation: '해설' };
watch(options, value => {
  limit.value = 40;
  try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* Search still works without storage. */ }
}, { deep: true });
function open(selectedId?: string) {
  if (results.value.length) emit('open', results.value.map(result => result.prompt.id), selectedId);
}
</script>

<template>
  <section class="practical-search-library" aria-label="필답형 문제 검색">
    <form class="practical-search-form" @submit.prevent>
      <label class="practical-search-query"><span>찾을 내용</span><input v-model="options.query" maxlength="200" type="search" placeholder="예: 압축기, COP, 냉매 순환량, 2024 3회" aria-label="필답형 검색어"><small>띄어쓰기·영문 대소문자와 관계없이 검색합니다. 여러 단어는 모두 포함된 문제를 찾습니다.</small></label>
      <label><span>검색 위치</span><select v-model="options.field"><option value="all">문제·정답·해설·회차 전체</option><option value="question">문제 내용만</option><option value="answer">정답만</option><option value="explanation">해설·핵심 답안만</option></select></label>
      <label><span>자료</span><select v-model="options.group"><option value="all">모든 자료</option><option v-for="(label, group) in practicalSearchGroupLabels" :key="group" :value="group">{{ label }}</option></select></label>
      <label><span>분야</span><select v-model="options.category"><option value="all">모든 분야</option><option v-for="(label, category) in practicalCategoryLabels" :key="category" :value="category">{{ label }}</option></select></label>
    </form>
    <div v-if="options.query.trim()" class="practical-search-status" aria-live="polite"><span><strong>{{ results.length }}</strong>문제 · 목록에는 정답을 표시하지 않습니다.</span><button type="button" :disabled="!results.length" @click="open()">검색 결과 모아 풀기 →</button></div>
    <p v-if="!options.query.trim()" class="practical-search-empty">검색어를 입력하면 회차별 기출과 PDF·사진·연습 자료를 함께 찾습니다. 이미지 안 글자는 등록된 문제·정답·해설 텍스트 기준으로 찾습니다.</p>
    <p v-else-if="!results.length" class="practical-search-empty">일치하는 문제가 없습니다. 검색어를 짧게 하거나 자료·분야·검색 위치를 ‘전체’로 바꿔 보세요.</p>
    <ol v-else class="practical-search-results">
      <li v-for="result in visible" :key="result.prompt.id">
        <button type="button" @click="open(result.prompt.id)">
          <small>{{ practicalSearchGroupLabels[result.prompt.group] }} · {{ practicalSourceLabel(result.prompt) }} · {{ practicalCategoryLabels[result.prompt.category] }}<template v-if="result.prompt.image || result.prompt.images?.length"> · 그림 있음</template></small>
          <strong>{{ result.prompt.question }}</strong>
          <span>{{ result.matchedIn.length ? result.matchedIn.map(field => fieldLabels[field]).join('·') : '회차·분류' }}에서 일치 · 문제 열기 →</span>
        </button>
      </li>
    </ol>
    <button v-if="results.length > limit" class="practical-search-more" type="button" @click="limit += 40">40문제 더 보기 ({{ visible.length }} / {{ results.length }})</button>
  </section>
</template>

<style scoped>
.practical-search-form { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
.practical-search-form label { display:grid; gap:7px; min-width:0; }
.practical-search-query { grid-column:1/-1; }
.practical-search-form input, .practical-search-form select { width:100%; min-width:0; box-sizing:border-box; min-height:46px; padding:10px 12px; border:1px solid var(--line); border-radius:10px; background:var(--surface); color:var(--text); font:inherit; }
.practical-search-form small, .practical-search-empty, .practical-search-results small, .practical-search-results span { color:var(--muted); line-height:1.6; overflow-wrap:anywhere; }
.practical-search-status { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin:18px 0 12px; }
.practical-search-status button, .practical-search-more { min-height:44px; padding:10px 14px; border:1px solid var(--line); border-radius:10px; background:var(--surface); color:var(--text); font:inherit; }
.practical-search-results { display:grid; gap:9px; list-style:none; margin:0; padding:0; }
.practical-search-results li { min-width:0; }
.practical-search-results button { width:100%; display:grid; gap:8px; padding:15px; border:1px solid var(--line); border-radius:12px; background:var(--surface); color:var(--text); text-align:left; font:inherit; overflow-wrap:anywhere; }
.practical-search-results button:hover { background:var(--surface-2); }
.practical-search-results strong { white-space:pre-line; line-height:1.6; }
.practical-search-results span { font-size:.88rem; }
.practical-search-more { display:block; margin:14px auto 0; }
@media(max-width:600px) { .practical-search-form { grid-template-columns:1fr; } .practical-search-form input, .practical-search-form select { font-size:16px; } }
</style>
