<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { QuestionItem, StudyMode } from './types';
import type { ExamRecord } from './storage';
import { uniqueSchoolItems, coolingTopics, coolingTopic } from './schoolQuestionBank';

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
const year = ref(/^\d{4}$/.test(String(savedPreferences.year)) ? String(savedPreferences.year) : 'all');
const topic = ref([...coolingTopics, '분류 미확인'].includes(savedPreferences.topic as string) ? String(savedPreferences.topic) : 'all');
const roundId = ref(typeof savedPreferences.roundId === 'string' ? savedPreferences.roundId : 'all');
const tab = ref(['all', 'rounds', 'wrong', 'history'].includes(String(savedPreferences.tab)) ? String(savedPreferences.tab) : 'all');
const count = ref([10, 20, 40, 60].includes(Number(savedPreferences.count)) ? Number(savedPreferences.count) : 20);
const excludeSeen = ref(savedPreferences.excludeSeen !== false);
const topicMap = computed(() => new Map(props.items.map(item => [item.id, coolingTopic(item)])));
const sourceItems = computed(() => props.items.filter(item => source.value === 'all' || item.round.qualificationKey === source.value));
const years = computed(() => [...new Set(sourceItems.value.map(item => item.round.year))].sort((a, b) => b - a));
const yearItems = computed(() => sourceItems.value.filter(item => year.value === 'all' || item.round.year === Number(year.value)));
const topicCount = (value: string) => yearItems.value.filter(item => topicMap.value.get(item.id) === value).length;
const topicItems = computed(() => yearItems.value.filter(item => topic.value === 'all' || topicMap.value.get(item.id) === topic.value));
const rounds = computed(() => {
  const groups = new Map<string, { id: string; label: string; year: number; items: QuestionItem[] }>();
  for (const item of topicItems.value) {
    let group = groups.get(item.round.id);
    if (!group) {
      group = { id: item.round.id, label: `${item.round.session || item.round.date || '기출'} · ${item.round.qualificationKey === 'hvac-hansol' ? '한솔 공조' : '공조 기출'}`, year: item.round.year, items: [] };
      groups.set(group.id, group);
    }
    group.items.push(item);
  }
  return [...groups.values()].sort((a, b) => b.year - a.year || a.label.localeCompare(b.label, 'ko', { numeric: true }));
});
const roundYears = computed(() => [...new Set(rounds.value.map(round => round.year))]);
const filtered = computed(() => topicItems.value.filter(item => roundId.value === 'all' || item.round.id === roundId.value));
const pool = computed(() => uniqueSchoolItems(filtered.value));
const unused = computed(() => new Set(props.unusedIds));
const randomPool = computed(() => excludeSeen.value ? pool.value.filter(item => unused.value.has(item.id)) : pool.value);
const wrongPool = computed(() => uniqueSchoolItems(filtered.value.filter(item => props.wrongIds.includes(item.id))));
const sourceCount = (key: string) => props.items.filter(item => item.round.qualificationKey === key).length;
const answered = (items: QuestionItem[]) => items.filter(item => props.attemptedIds.includes(item.id)).length;
const wrongCount = (items: QuestionItem[]) => items.filter(item => props.wrongIds.includes(item.id)).length;
watch(source, () => { if (!years.value.includes(Number(year.value))) year.value = 'all'; roundId.value = 'all'; });
watch([year, topic], () => { roundId.value = 'all'; });
watch([source, year, topic, roundId, tab, count, excludeSeen], () => {
  localStorage.setItem(preferenceKey, JSON.stringify({ source: source.value, year: year.value, topic: topic.value, roundId: roundId.value, tab: tab.value, count: count.value, excludeSeen: excludeSeen.value }));
});
const scopeLabel = computed(() => [source.value === 'all' ? '' : source.value === 'hvac' ? '공조 기출' : '한솔 공조', year.value === 'all' ? '' : `${year.value}년`, topic.value === 'all' ? '' : topic.value, roundId.value === 'all' ? '' : rounds.value.find(round => round.id === roundId.value)?.label].filter(Boolean).join(' · ') || undefined);
function startRound(round: (typeof rounds.value)[number], mode: StudyMode): void {
  emit('start', { items: round.items, mode, randomCount: 0, label: `${round.year}년 ${round.label}${topic.value === 'all' ? '' : ` · ${topic.value}`}` });
}
</script>

<template>
  <section class="cooling-midterm" aria-label="냉동공학 중간고사">
    <header><div><span>학교 시험 · 냉동냉장설비 전체</span><h2>냉동공학 중간고사</h2><p>공조·한솔의 냉동냉장설비와 구 냉동공학 기출입니다. 중간고사 오답·진도는 기존 공조 기록과 따로 저장합니다.</p></div><strong>{{ loading ? '불러오는 중' : `${pool.length.toLocaleString()}문제` }}</strong></header>
    <p class="range-note">교재 핵심예상문제의 페이지별 대조는 아직 하지 않았습니다. 기존 공조 기록은 유지하며 새 중간고사 풀이부터 분리됩니다.</p>
    <div class="midterm-tabs" role="group" aria-label="중간고사 문제 선택 방식">
      <button v-for="[key, label] in [['all', '전체·랜덤'], ['rounds', '연도·회차별'], ['wrong', '중간고사 오답'], ['history', '풀이 기록']]" :key="key" :class="{ active: tab === key }" @click="tab = key">{{ label }}</button>
    </div>
    <div v-if="tab !== 'history'" class="midterm-controls">
      <label>문제 출처<select v-model="source"><option value="all">공조 + 한솔 전체</option><option value="hvac">공조 기출 · {{ sourceCount('hvac') }}문제</option><option value="hvac-hansol">한솔 공조 · {{ sourceCount('hvac-hansol') }}문제</option></select></label>
      <label>연도<select v-model="year"><option value="all">모든 연도</option><option v-for="value in years" :key="value" :value="String(value)">{{ value }}년</option></select></label>
      <label>회차<select v-model="roundId"><option value="all">모든 회차</option><option v-for="round in rounds" :key="round.id" :value="round.id">{{ round.year }}년 {{ round.label }}</option></select></label>
      <label>소과목<select v-model="topic"><option value="all">냉동냉장설비 전체</option><option v-for="value in [...coolingTopics, '분류 미확인']" :key="value" :value="value">{{ value }} · {{ topicCount(value) }}문제</option></select></label>
      <button type="button" @click="emit('search')">통합 검색으로 문제 찾기</button>
    </div>
    <p v-if="tab !== 'history'" class="range-note">소과목은 문제·보기·해설로 자동 분류한 공부용 구분입니다. 교재 문항 위치를 확인한 분류가 아닙니다. 현재 출처·연도에 ‘분류 미확인’ {{ topicCount('분류 미확인') }}문제가 있으니 시험 범위를 빠짐없이 풀려면 ‘냉동냉장설비 전체’ 또는 ‘분류 미확인’도 함께 확인하세요.</p>
    <p v-if="error" role="alert">{{ error }} <button type="button" @click="emit('retry')">다시 불러오기</button></p>
    <template v-if="tab === 'all'">
      <div class="midterm-actions">
        <button type="button" :disabled="loading || !pool.length" @click="emit('start', { items: pool, mode: 'learn', randomCount: 0, label: scopeLabel })">전체 문제 학습</button>
        <button type="button" :disabled="loading || !pool.length" @click="emit('start', { items: pool, mode: 'exam', randomCount: 0, label: scopeLabel })">전체 문제 CBT</button>
      </div>
      <div class="random-options">
        <label>랜덤 문제 수<select v-model.number="count"><option v-for="size in [10, 20, 40, 60]" :key="size" :value="size">{{ size }}문제</option></select></label>
        <label class="check"><input v-model="excludeSeen" type="checkbox">이미 나온 문제 제외</label>
        <span>{{ excludeSeen ? '새로 풀 수 있는' : '반복 포함' }} {{ randomPool.length.toLocaleString() }}문제</span>
        <button @click="emit('resetDraws')">랜덤 출제 순환 다시 시작</button>
      </div>
      <div class="midterm-actions">
        <button type="button" :disabled="loading || !randomPool.length" @click="emit('start', { items: randomPool, mode: 'learn', randomCount: count, label: scopeLabel })">랜덤 {{ Math.min(count, randomPool.length) }}문제 학습</button>
        <button type="button" :disabled="loading || !randomPool.length" @click="emit('start', { items: randomPool, mode: 'exam', randomCount: count, label: scopeLabel })">랜덤 {{ Math.min(count, randomPool.length) }}문제 CBT</button>
      </div>
      <p v-if="!loading && !randomPool.length && excludeSeen" class="range-note">선택 범위가 모두 출제됐습니다. 풀이 기록에서 이어 풀거나 출제 순환을 다시 시작하세요. 오답 기록은 지워지지 않습니다.</p>
    </template>
    <div v-else-if="tab === 'rounds'" class="midterm-rounds">
      <details v-for="value in roundYears" :key="value" :open="year !== 'all' || value === roundYears[0]">
        <summary>{{ value }}년 · {{ rounds.filter(round => round.year === value).length }}회차</summary>
        <div class="round-grid"><article v-for="round in rounds.filter(round => round.year === value && (roundId === 'all' || round.id === roundId))" :key="round.id">
          <h3>{{ round.label }}</h3><p>{{ round.items.length }}문제 · 풀이 {{ answered(round.items) }} · 오답 {{ wrongCount(round.items) }}</p>
          <button @click="startRound(round, 'learn')">회차 학습</button><button @click="startRound(round, 'exam')">회차 CBT</button>
        </article></div>
      </details>
    </div>
    <template v-else-if="tab === 'wrong'">
      <h3>중간고사 전용 오답 {{ wrongPool.length }}문제</h3><p class="range-note">이 중간고사에서 틀린 문제만 표시합니다. 기존 공조·한솔 오답과 섞이지 않습니다.</p>
      <div class="midterm-actions"><button :disabled="!wrongPool.length" @click="emit('start', { items: wrongPool, mode: 'learn', randomCount: 0, label: '오답 복습' })">오답 {{ wrongPool.length }}문제 복습</button></div>
      <div class="round-grid"><article v-for="round in rounds.filter(round => wrongCount(round.items) && (roundId === 'all' || round.id === roundId))" :key="round.id">
        <h3>{{ round.year }}년 {{ round.label }}</h3><p>오답 {{ wrongCount(round.items) }}문제</p><button @click="emit('start', { items: round.items.filter(item => wrongIds.includes(item.id)), mode: 'learn', randomCount: 0, label: `${round.year}년 ${round.label} 오답` })">이 회차 오답 풀기</button>
      </article></div>
    </template>
    <template v-else>
      <h3>진행 중인 문제 묶음 {{ sessions.length }}개</h3><p class="range-note">다른 랜덤 묶음을 시작해도 이전 문제·답안·위치를 보관합니다.</p>
      <div class="round-grid"><article v-for="saved in sessions" :key="saved.id" :data-session-id="saved.id"><h3>{{ saved.title }}</h3><p>{{ Object.keys(saved.answers).length }}/{{ saved.itemIds.length }}문제 · {{ new Date(saved.savedAt).toLocaleString('ko-KR') }}</p><button @click="emit('resume', saved.id!)">이 묶음 이어풀기</button></article></div>
      <h3>완료한 중간고사 {{ history.length }}개</h3>
      <div class="round-grid"><article v-for="record in history" :key="record.id"><h3>{{ record.title }}</h3><p>{{ record.mode === 'exam' ? 'CBT' : '학습' }} · {{ record.score }}점 · {{ new Date(record.finishedAt).toLocaleString('ko-KR') }}</p><button @click="emit('replay', record.id)">같은 문제 다시 풀기</button></article></div>
    </template>
    <small>원래 문제 그림·정답·해설을 사용합니다. 완전히 같은 문제는 한 번만 출제하며 새 랜덤 묶음에서도 출제 순환 기록을 확인합니다. 다른 그림의 유사문제까지 모두 같은 문제로 판정한 것은 아닙니다.</small>
  </section>
</template>

<style scoped>
.cooling-midterm{padding:24px;margin-bottom:20px;border:1px solid var(--primary);border-radius:20px;background:var(--surface);color:var(--text)}header{display:flex;align-items:start;justify-content:space-between;gap:16px}header span{color:var(--primary);font-weight:800;font-size:.9rem}h2{margin:7px 0;font-size:1.6rem}h3{font-size:1rem;line-height:1.5}p{line-height:1.65;margin:8px 0}header strong{white-space:nowrap;font-size:1.1rem}.range-note{color:var(--muted);font-size:.85rem}.midterm-controls,.midterm-actions,.random-options,.midterm-tabs{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin:18px 0}label{display:grid;gap:6px;font-weight:800;font-size:.9rem}.midterm-controls label{flex:1;min-width:140px}select,button{min-height:46px;padding:9px 14px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);color:var(--text);font:inherit;max-width:100%}button{cursor:pointer;font-weight:800}button:disabled{opacity:.45;cursor:default}.midterm-tabs button{flex:1}.midterm-tabs .active{border-color:var(--primary);color:var(--primary);background:color-mix(in srgb,var(--primary) 12%,var(--surface))}.midterm-actions button{flex:1;background:var(--primary);color:#fff}.random-options{align-items:center}.check{display:flex;align-items:center}.check input{width:20px;height:20px}.random-options span{font-size:.85rem;color:var(--muted)}small{display:block;margin-top:20px;color:var(--muted);line-height:1.7;font-size:.85rem}.midterm-rounds details{border-top:1px solid var(--line);margin:12px 0}summary{padding:16px 0;cursor:pointer;font-weight:800}.round-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px}.round-grid article{padding:16px;background:var(--surface-2);border:1px solid var(--line);border-radius:12px;min-width:0}.round-grid h3{margin:0}.round-grid p{font-size:.85rem;color:var(--muted)}.round-grid button{margin:5px 5px 0 0}@media(max-width:600px){.cooling-midterm{padding:18px}header{display:block}.midterm-controls,.midterm-tabs{display:grid;grid-template-columns:1fr 1fr}.midterm-controls label{min-width:0}.midterm-controls>button,.midterm-controls>label:nth-child(3),.midterm-controls>label:nth-child(4){grid-column:1/-1}select{width:100%;min-width:0}.midterm-actions{display:grid;grid-template-columns:1fr}h2{font-size:1.35rem}.random-options{gap:12px}.random-options button{width:100%}}
.midterm-controls select{width:100%;min-width:0}
</style>
