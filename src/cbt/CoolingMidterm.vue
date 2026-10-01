<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { QuestionItem, StudyMode } from './types';
import type { ExamRecord } from './storage';
import { uniqueSchoolItems, coolingTopics, coolingTopicGroups } from './schoolQuestionBank';

type SavedSet = { id?: string; title: string; mode?: StudyMode; savedAt: number; itemIds: string[]; answers: Record<string, number> };
const props = defineProps<{ items: QuestionItem[]; wrongIds: string[]; attemptedIds: string[]; unusedIds: string[]; sessions: SavedSet[]; history: ExamRecord[]; loading: boolean; error: string }>();
const emit = defineEmits<{
  start: [payload: { items: QuestionItem[]; mode: StudyMode; randomCount: number; label?: string }];
  search: []; retry: []; resetDraws: []; resume: [id: string]; replay: [id: string];
}>();
const preferenceKey = 'school-cooling-selection-v1';
let savedPreferences: Record<string, unknown> = {};
try { savedPreferences = JSON.parse(localStorage.getItem(preferenceKey) || '{}') || {}; } catch { /* defaults */ }
const source = ref(['all', 'hvac', 'hvac-hansol'].includes(String(savedPreferences.source)) ? String(savedPreferences.source) : 'all');
const topic = ref(savedPreferences.layoutVersion === 3 && [...coolingTopics, '분류 미확인'].includes(savedPreferences.topic as string) ? String(savedPreferences.topic) : 'all');
const tab = ref(savedPreferences.layoutVersion === 3 && ['all', 'topics', 'wrong', 'history'].includes(String(savedPreferences.tab)) ? String(savedPreferences.tab) : 'topics');
const count = ref([10, 20, 40, 60].includes(Number(savedPreferences.count)) ? Number(savedPreferences.count) : 20);
const excludeSeen = ref(savedPreferences.excludeSeen !== false);
const sourceItems = computed(() => props.items.filter(item => source.value === 'all' || item.round.qualificationKey === source.value));
const groups = computed(() => coolingTopicGroups(sourceItems.value));
type TopicGroup = ReturnType<typeof coolingTopicGroups>[number];
const selectedGroup = computed(() => groups.value.find(group => group.label === topic.value));
const topicCount = (value: string) => groups.value.find(group => group.label === value)?.items.length || 0;
const filtered = computed(() => selectedGroup.value?.aliases || sourceItems.value);
const pool = computed(() => selectedGroup.value?.items || uniqueSchoolItems(sourceItems.value));
const totalCount = computed(() => groups.value.reduce((total, group) => total + group.items.length, 0));
const unused = computed(() => new Set(props.unusedIds));
const randomPool = computed(() => excludeSeen.value ? pool.value.filter(item => unused.value.has(item.id)) : pool.value);
const wrongItems = (items: QuestionItem[]) => uniqueSchoolItems(items.filter(item => props.wrongIds.includes(item.id)));
const wrongPool = computed(() => wrongItems(filtered.value));
const sourceCount = (key: string) => props.items.filter(item => item.round.qualificationKey === key).length;
const answered = (group: TopicGroup) => uniqueSchoolItems(group.aliases.filter(item => props.attemptedIds.includes(item.id))).length;
const wrongCount = (group: TopicGroup) => wrongItems(group.aliases).length;
watch([source, topic, tab, count, excludeSeen], () => {
  localStorage.setItem(preferenceKey, JSON.stringify({ layoutVersion: 3, source: source.value, topic: topic.value, tab: tab.value, count: count.value, excludeSeen: excludeSeen.value }));
});
const sourceLabel = computed(() => source.value === 'all' ? '공조 + 한솔' : source.value === 'hvac' ? '공조 기출' : '한솔 공조');
const scopeLabel = computed(() => `${topic.value === 'all' ? '냉동냉장설비 전체' : topic.value} · ${sourceLabel.value}`);
function startGroup(group: TopicGroup, mode: StudyMode, wrong = false): void {
  emit('start', { items: wrong ? wrongItems(group.aliases) : group.items, mode, randomCount: 0, label: `${group.label} · ${sourceLabel.value}${wrong ? ' 오답' : ''}` });
}
function resumeForGroup(group: TopicGroup): SavedSet | undefined {
  const ids = new Set(group.aliases.map(item => item.id));
  return props.sessions.find(saved => saved.itemIds.length && saved.itemIds.every(id => ids.has(id)));
}
function latestResult(group: TopicGroup): ExamRecord | undefined {
  const ids = new Set(group.aliases.map(item => item.id));
  return props.history.find(record => record.mode === 'exam' && record.itemIds?.length && record.itemIds.every(id => ids.has(id)));
}
</script>

<template>
  <section class="cooling-midterm" aria-label="냉동공학 중간고사">
    <header class="rounds-heading midterm-heading">
      <div><h1>냉동공학 중간고사</h1><p>소과목별 학습 · {{ totalCount.toLocaleString() }}문제 · 기존 공조와 기록 분리</p></div>
      <button type="button" aria-label="통합 검색으로 문제 찾기" @click="emit('search')"><span class="wide-label">통합 검색으로 문제 찾기</span><span class="compact-label">문제 찾기</span></button>
    </header>
    <nav class="midterm-tabs" aria-label="중간고사 문제 선택 방식">
      <button v-for="[key, label, shortLabel] in [['topics', '소과목별', '소과목별'], ['all', '전체·랜덤', '전체·랜덤'], ['wrong', '중간고사 오답', '오답'], ['history', '풀이 기록', '풀이 기록']]" :key="key" :class="{ active: tab === key }" :aria-label="label" :aria-pressed="tab === key" @click="tab = key"><span class="wide-label">{{ label }}</span><span class="compact-label">{{ shortLabel }}</span></button>
    </nav>
    <div v-if="tab !== 'history'" class="midterm-controls">
      <label>문제 출처<select v-model="source"><option value="all">공조 + 한솔 전체</option><option value="hvac">공조 기출 · {{ sourceCount('hvac') }}문제</option><option value="hvac-hansol">한솔 공조 · {{ sourceCount('hvac-hansol') }}문제</option></select></label>
      <label v-if="tab !== 'topics'">소과목<select v-model="topic"><option value="all">냉동냉장설비 전체</option><option v-for="value in [...coolingTopics, '분류 미확인']" :key="value" :value="value">{{ value }} · {{ topicCount(value) }}문제</option></select></label>
      <button v-if="source !== 'all' || (tab !== 'topics' && topic !== 'all')" class="filter-reset" @click="source = 'all'; topic = 'all'">전체 범위 보기</button>
    </div>
    <p v-if="tab !== 'history'" class="topic-warning">소과목은 임시 자동 분류입니다. 범위 누락을 막으려면 ‘분류 미확인’ {{ topicCount('분류 미확인') }}문제도 확인하세요.</p>
    <p v-if="error" role="alert">{{ error }} <button type="button" @click="emit('retry')">다시 불러오기</button></p>
    <p v-else-if="loading" role="status">공조·한솔 문제를 불러오는 중입니다…</p>
    <template v-if="tab === 'topics'">
      <div class="round-grid midterm-rounds">
        <article v-for="group in groups" :key="group.label" :data-topic="group.label" class="round-card">
          <header><span>{{ group.label === '분류 미확인' ? '범위 확인' : '소과목' }}</span><b>{{ sourceLabel }}</b></header>
          <div v-if="latestResult(group)" class="round-record-badge"><span>최근 중간고사 CBT</span><strong>{{ latestResult(group)!.score }}점</strong><small>{{ new Date(latestResult(group)!.finishedAt).toLocaleDateString('ko-KR') }}</small></div>
          <h2>{{ group.label }}</h2>
          <p>{{ group.items.length.toLocaleString() }}문제 · 중복 문항 제외</p>
          <div class="round-progress"><span><i :style="{ width: `${group.items.length ? Math.round(answered(group) / group.items.length * 100) : 0}%` }" /></span></div>
          <small class="round-progress-copy">풀이 {{ answered(group) }}/{{ group.items.length }} · 오답 {{ wrongCount(group) }}</small>
          <footer>
            <button v-if="resumeForGroup(group)" @click="emit('resume', resumeForGroup(group)!.id!)">이어서 풀기</button>
            <button :disabled="loading || !group.items.length" :aria-label="`학습모드 · ${group.label}`" @click="startGroup(group, 'learn')">학습모드</button>
            <button v-if="wrongCount(group)" class="round-wrong-button" @click="startGroup(group, 'learn', true)">오답 {{ wrongCount(group) }}개</button>
            <button :disabled="loading || !group.items.length" :aria-label="`CBT 시험모드 · ${group.label}`" @click="startGroup(group, 'exam')">CBT 시험모드</button>
          </footer>
        </article>
      </div>
    </template>
    <section v-else-if="tab === 'all'" class="selection-panel">
      <h2>선택 범위를 한 번에 풀기</h2>
      <p class="muted">{{ scopeLabel }} · {{ pool.length.toLocaleString() }}문제</p>
      <div class="midterm-actions">
        <button :disabled="loading || !pool.length" @click="emit('start', { items: pool, mode: 'learn', randomCount: 0, label: scopeLabel })">전체 문제 학습</button>
        <button :disabled="loading || !pool.length" @click="emit('start', { items: pool, mode: 'exam', randomCount: 0, label: scopeLabel })">전체 문제 CBT</button>
      </div>
      <hr>
      <h2>랜덤으로 골라 풀기</h2>
      <div class="random-options">
        <label>랜덤 문제 수<select v-model.number="count"><option v-for="size in [10, 20, 40, 60]" :key="size" :value="size">{{ size }}문제</option></select></label>
        <label class="check"><input v-model="excludeSeen" type="checkbox">이미 나온 문제 제외</label>
        <span class="muted">{{ excludeSeen ? '새로 풀 수 있는' : '반복 포함' }} {{ randomPool.length.toLocaleString() }}문제</span>
      </div>
      <div class="midterm-actions">
        <button :disabled="loading || !randomPool.length" @click="emit('start', { items: randomPool, mode: 'learn', randomCount: count, label: scopeLabel })">랜덤 {{ Math.min(count, randomPool.length) }}문제 학습</button>
        <button :disabled="loading || !randomPool.length" @click="emit('start', { items: randomPool, mode: 'exam', randomCount: count, label: scopeLabel })">랜덤 {{ Math.min(count, randomPool.length) }}문제 CBT</button>
      </div>
      <button class="cycle-reset" @click="emit('resetDraws')">랜덤 출제 순환 다시 시작</button>
      <p v-if="!loading && !randomPool.length && excludeSeen" class="muted">선택 범위가 모두 출제됐습니다. 풀이 기록에서 이어 풀거나 출제 순환을 다시 시작하세요. 오답 기록은 지워지지 않습니다.</p>
    </section>
    <section v-else-if="tab === 'wrong'" class="selection-panel">
      <h2>중간고사 전용 오답 {{ wrongPool.length }}문제</h2><p class="muted">기존 공조·한솔 오답과 섞이지 않습니다.</p>
      <div class="midterm-actions"><button :disabled="!wrongPool.length" @click="emit('start', { items: wrongPool, mode: 'learn', randomCount: 0, label: '오답 복습' })">오답 {{ wrongPool.length }}문제 복습</button></div>
      <div class="record-grid"><article v-for="group in groups.filter(group => wrongCount(group) && (topic === 'all' || group.label === topic))" :key="group.label">
        <h3>{{ group.label }}</h3><p>오답 {{ wrongCount(group) }}문제</p><button @click="startGroup(group, 'learn', true)">이 소과목 오답 풀기</button>
      </article></div>
    </section>
    <section v-else class="selection-panel">
      <h2>진행 중인 문제 묶음 {{ sessions.length }}개</h2><p class="muted">다른 랜덤 묶음을 시작해도 이전 문제·답안·위치를 보관합니다.</p>
      <div class="record-grid"><article v-for="saved in sessions" :key="saved.id" :data-session-id="saved.id"><h3>{{ saved.title }}</h3><p>{{ Object.keys(saved.answers).length }}/{{ saved.itemIds.length }}문제 · {{ new Date(saved.savedAt).toLocaleString('ko-KR') }}</p><button @click="emit('resume', saved.id!)">이 묶음 이어풀기</button></article></div>
      <h2>완료한 중간고사 {{ history.length }}개</h2>
      <div class="record-grid"><article v-for="record in history" :key="record.id"><h3>{{ record.title }}</h3><p>{{ record.mode === 'exam' ? 'CBT' : '학습' }} · {{ record.score }}점 · {{ new Date(record.finishedAt).toLocaleString('ko-KR') }}</p><button @click="emit('replay', record.id)">같은 문제 다시 풀기</button></article></div>
    </section>
    <details class="classification-help"><summary>시험 범위·소과목 분류 안내</summary>
      <p>공조·한솔의 냉동냉장설비와 구 냉동공학 기출입니다. 교재 핵심예상문제의 페이지별 대조는 아직 하지 않았습니다.</p>
      <p>소과목은 문제·보기·해설의 키워드로 임시 분류했습니다. 현재 출처에 ‘분류 미확인’ {{ topicCount('분류 미확인') }}문제가 있으니 ‘냉동냉장설비 전체’ 또는 ‘분류 미확인’도 확인하세요.</p>
      <p>원래 문제 그림·정답·해설과 기존 기록은 유지됩니다. 완전히 같은 문항은 한 번만 출제하지만 다른 그림의 유사문제까지 모두 같은 문제로 판정한 것은 아닙니다.</p>
    </details>
  </section>
</template>

<style scoped>
.cooling-midterm { margin-bottom:28px; color:var(--text); min-width:0; }
.midterm-heading { margin-bottom:20px; gap:16px; }
.midterm-heading h1 { font-size:1.75rem; }
.midterm-heading p { line-height:1.6; }
.compact-label { display:none; }
.midterm-tabs { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:18px; border-bottom:1px solid var(--line); padding-bottom:12px; }
button,select { min-height:44px; border:1px solid var(--line); border-radius:9px; padding:9px 14px; background:var(--surface); color:var(--text); font:inherit; max-width:100%; }
button { font-weight:800; cursor:pointer; }
button:disabled { opacity:.45; cursor:default; }
.midterm-tabs .active { background:var(--primary); border-color:var(--primary); color:#fff; }
.midterm-controls { display:flex; flex-wrap:wrap; gap:12px; align-items:end; margin-bottom:20px; }
.midterm-controls label { flex:1 1 240px; max-width:440px; }
label { display:grid; gap:6px; font-size:.9rem; font-weight:800; min-width:0; }
select { min-width:0; width:100%; }
.filter-reset { font-size:.85rem; }
.topic-warning { font-size:.85rem; color:var(--muted); line-height:1.7; }
.midterm-rounds .round-card { min-height:250px; }
.midterm-rounds .round-card h2 { min-height:0; font-size:1.1rem; margin:18px 0 9px; }
.midterm-rounds .round-card footer button { min-height:44px; }
.midterm-rounds .round-progress { margin-top:16px; }
.selection-panel { padding:22px; background:var(--surface); border:1px solid var(--line); border-radius:16px; }
.selection-panel h2 { font-size:1.1rem; margin:0 0 10px; }
.selection-panel h2:not(:first-child) { margin-top:24px; }
.muted,.record-grid p { color:var(--muted); font-size:.85rem; line-height:1.7; }
.midterm-actions { display:flex; gap:12px; margin:18px 0; }
.midterm-actions button { flex:1; color:#fff; background:var(--primary); border-color:var(--primary); }
.random-options { display:flex; gap:16px; flex-wrap:wrap; align-items:center; margin:16px 0; }
.random-options label:first-child { min-width:120px; }
.check { display:flex; align-items:center; }
.check input { width:20px; height:20px; }
.cycle-reset { font-size:.85rem; }
hr { border:0; border-top:1px solid var(--line); margin:24px 0; }
.record-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr)); gap:12px; }
.record-grid article { min-width:0; padding:16px; border:1px solid var(--line); border-radius:12px; background:var(--surface-2); }
.record-grid h3 { font-size:1rem; line-height:1.5; overflow-wrap:anywhere; margin:0; }
.classification-help { margin-top:22px; border-top:1px solid var(--line); padding-top:14px; color:var(--muted); font-size:.85rem; line-height:1.7; }
.classification-help summary { font-weight:800; cursor:pointer; }
.empty-state { padding:24px; color:var(--muted); text-align:center; }
@media(max-width:600px) {
  .midterm-heading { flex-direction:row; align-items:center; gap:10px; margin-bottom:14px; }
  .midterm-heading h1 { font-size:1.25rem; margin-bottom:6px; }
  .midterm-heading p { font-size:.75rem; }
  .midterm-heading>button { flex-shrink:0; padding:9px; font-size:.8rem; }
  .wide-label { display:none; } .compact-label { display:inline; }
  .midterm-tabs { flex-wrap:nowrap; gap:6px; margin-bottom:14px; }
  .midterm-tabs button { flex:1; min-width:0; padding:9px 4px; font-size:.82rem; white-space:nowrap; }
  .selection-panel { padding:18px; } .midterm-actions { display:grid; grid-template-columns:1fr; } .midterm-rounds .round-card { min-height:240px; }
}
</style>
