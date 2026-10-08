<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { QuestionItem, StudyMode } from './types';
import type { ExamRecord } from './storage';
import { uniqueSchoolItems, coolingTopics, coolingTopicGroups, coolingBookChapters, coolingSectionGroups } from './schoolQuestionBank';
import { coolingCalculation } from './coolingPractice';
import { coolingSafetyKind } from './coolingScope';

type SavedSet = { id?: string; title: string; mode?: StudyMode; savedAt: number; itemIds: string[]; answers: Record<string, number> };
const props = defineProps<{ items: QuestionItem[]; safetyItems: QuestionItem[]; wrongIds: string[]; attemptedIds: string[]; unusedIds: string[]; sessions: SavedSet[]; history: ExamRecord[]; loading: boolean; error: string }>();
const emit = defineEmits<{
  start: [payload: { items: QuestionItem[]; mode: StudyMode; randomCount: number; calculationCount?: number; label?: string }];
  search: []; retry: []; resetDraws: []; resume: [id: string]; replay: [id: string];
}>();
const preferenceKey = 'school-cooling-selection-v1';
let savedPreferences: Record<string, unknown> = {};
try { savedPreferences = JSON.parse(localStorage.getItem(preferenceKey) || '{}') || {}; } catch { /* defaults */ }
// Keep the source selector, within the year-based bank supplied by the parent.
const source = ref(['all', 'hvac', 'hvac-hansol'].includes(String(savedPreferences.source)) ? String(savedPreferences.source) : 'all');
const topic = ref(savedPreferences.layoutVersion === 3 && [...coolingTopics, '분류 미확인'].includes(savedPreferences.topic as string) ? String(savedPreferences.topic) : 'all');
const tab = ref(savedPreferences.layoutVersion === 3 && ['all', 'topics', 'sections', 'wrong', 'history'].includes(String(savedPreferences.tab)) ? String(savedPreferences.tab) : 'topics');
const section = ref(typeof savedPreferences.section === 'string' ? savedPreferences.section : 'all');
const count = ref([10, 20, 40, 60].includes(Number(savedPreferences.count)) ? Number(savedPreferences.count) : 20);
const excludeSeen = ref(savedPreferences.excludeSeen !== false);
const includeFiveCalculations = ref(savedPreferences.includeFiveCalculations === true);
const sourceItems = computed(() => props.items.filter(item => source.value === 'all' || item.round.qualificationKey === source.value));
const groups = computed(() => coolingTopicGroups(sourceItems.value));
type TopicGroup = ReturnType<typeof coolingTopicGroups>[number];
const selectedGroup = computed(() => groups.value.find(group => group.label === topic.value));
const sections = computed(() => selectedGroup.value ? coolingSectionGroups(selectedGroup.value) : []);
const selectedSection = computed(() => sections.value.find(group => group.label === section.value));
const scopeGroup = computed(() => selectedSection.value || selectedGroup.value);
const displayedGroups = computed(() => tab.value === 'sections' ? sections.value : groups.value);
const chapterInfo = (label: string) => coolingBookChapters.find(chapter => chapter.title === label);
const topicCount = (value: string) => groups.value.find(group => group.label === value)?.items.length || 0;
const filtered = computed(() => scopeGroup.value?.aliases || sourceItems.value);
const pool = computed(() => scopeGroup.value?.items || uniqueSchoolItems(sourceItems.value));
const totalCount = computed(() => groups.value.reduce((total, group) => total + group.items.length, 0));
const safetyPool = computed(() => uniqueSchoolItems(props.safetyItems));
const safetyCounts = computed(() => ['management', 'protection', 'leak'].map(kind => safetyPool.value.filter(item => coolingSafetyKind(item) === kind).length));
const unused = computed(() => new Set(props.unusedIds));
const randomPool = computed(() => excludeSeen.value ? pool.value.filter(item => unused.value.has(item.id)) : pool.value);
const calculationAvailable = computed(() => randomPool.value.filter(coolingCalculation).length);
const theoryAvailable = computed(() => randomPool.value.length - calculationAvailable.value);
const calculationShortage = computed(() => includeFiveCalculations.value && (calculationAvailable.value < 5 || theoryAvailable.value < count.value - 5));
const wrongItems = (items: QuestionItem[]) => uniqueSchoolItems(items.filter(item => props.wrongIds.includes(item.id)));
const wrongPool = computed(() => wrongItems(filtered.value));
const wrongGroups = computed(() => (selectedSection.value ? [selectedSection.value] : groups.value.filter(group => topic.value === 'all' || group.label === topic.value)).filter(group => wrongItems(group.aliases).length));
const sourceCount = (key: string) => props.items.filter(item => item.round.qualificationKey === key).length;
const answered = (group: TopicGroup) => uniqueSchoolItems(group.aliases.filter(item => props.attemptedIds.includes(item.id))).length;
const wrongCount = (group: TopicGroup) => wrongItems(group.aliases).length;
watch(topic, () => { section.value = 'all'; });
watch([source, topic, section, tab, count, excludeSeen, includeFiveCalculations], () => {
  localStorage.setItem(preferenceKey, JSON.stringify({ layoutVersion: 3, source: source.value, topic: topic.value, section: section.value, tab: tab.value, count: count.value, excludeSeen: excludeSeen.value, includeFiveCalculations: includeFiveCalculations.value }));
});
const sourceLabel = computed(() => source.value === 'all' ? '구 기출 + 한솔' : source.value === 'hvac' ? '2006년3회~2016년 공조' : '한솔 공조');
const scopeLabel = computed(() => `${topic.value === 'all' ? '냉동냉장설비 전체' : topic.value}${selectedSection.value ? ` · ${selectedSection.value.label}` : ''} · ${sourceLabel.value}`);
function openChapter(group: TopicGroup): void {
  topic.value = group.label; section.value = 'all'; tab.value = 'sections';
}
function startGroup(group: TopicGroup, mode: StudyMode, wrong = false): void {
  emit('start', { items: wrong ? wrongItems(group.aliases) : group.items, mode, randomCount: 0, label: `${tab.value === 'sections' ? `${topic.value} · ` : ''}${group.label} · ${sourceLabel.value}${wrong ? ' 오답' : ''}` });
}
function startRandom(mode: StudyMode): void {
  if (calculationShortage.value || !randomPool.value.length) return;
  emit('start', { items: randomPool.value, mode, randomCount: count.value, calculationCount: includeFiveCalculations.value ? 5 : undefined, label: `${scopeLabel.value}${includeFiveCalculations.value ? ' · 계산5개 포함' : ''}` });
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
      <div><h1>냉동공학 중간고사</h1><p>교재 목차별 학습 · {{ totalCount.toLocaleString() }}문제 · 일반 기출과 기록 분리</p></div>
      <button type="button" aria-label="통합 검색으로 문제 찾기" @click="emit('search')"><span class="wide-label">통합 검색으로 문제 찾기</span><span class="compact-label">문제 찾기</span></button>
    </header>
    <nav class="midterm-tabs" aria-label="중간고사 문제 선택 방식">
      <button v-for="[key, label, shortLabel] in [['topics', '교재 목차', '교재 목차'], ['all', '전체·랜덤', '전체·랜덤'], ['wrong', '중간고사 오답', '오답'], ['history', '풀이 기록', '풀이 기록']]" :key="key" :class="{ active: tab === key || (key === 'topics' && tab === 'sections') }" :aria-label="label" :aria-pressed="tab === key || (key === 'topics' && tab === 'sections')" @click="tab = key"><span class="wide-label">{{ label }}</span><span class="compact-label">{{ shortLabel }}</span></button>
    </nav>
    <div v-if="tab !== 'history'" class="midterm-controls">
      <label>문제 출처<select v-model="source"><option value="all">구 기출 + 한솔 전체</option><option value="hvac">2006년3회~2016년 공조 · {{ sourceCount('hvac') }}문제</option><option value="hvac-hansol">한솔 공조 · {{ sourceCount('hvac-hansol') }}문제</option></select></label>
      <label v-if="tab === 'all' || tab === 'wrong'">교재 장<select v-model="topic"><option value="all">냉동냉장설비 전체</option><option v-for="value in [...coolingTopics, '분류 미확인']" :key="value" :value="value">{{ value }} · {{ topicCount(value) }}문제</option></select></label>
      <label v-if="(tab === 'all' || tab === 'wrong') && sections.length">세부 목차<select v-model="section"><option value="all">이 장 전체</option><option v-for="group in sections" :key="group.label" :value="group.label">{{ group.label }} · {{ group.items.length }}문제</option></select></label>
      <button v-if="source !== 'all' || ((tab === 'all' || tab === 'wrong') && topic !== 'all')" class="filter-reset" @click="source = 'all'; topic = 'all'; section = 'all'; if (tab === 'sections') tab = 'topics'">전체 범위 보기</button>
    </div>
    <p v-if="tab !== 'history'" class="topic-warning">교재의 장·세부 목차로 문제 내용에 따라 분류했습니다. 교재 수록 문제와의 페이지별 동일성 대조는 미완료입니다.</p>
    <p v-if="error" role="alert">{{ error }} <button type="button" @click="emit('retry')">다시 불러오기</button></p>
    <p v-else-if="loading" role="status">공조·한솔 문제를 불러오는 중입니다…</p>
    <template v-if="tab === 'topics' || tab === 'sections'">
      <div v-if="tab === 'sections'" class="chapter-heading">
        <button @click="tab = 'topics'">← 전체 목차</button><h2>{{ topic }}</h2>
        <button @click="section = 'all'; tab = 'all'">이 장 전체·랜덤 풀기</button>
      </div>
      <div class="round-grid midterm-rounds">
        <article v-for="group in displayedGroups.filter(group => group.items.length)" :key="group.label" :data-topic="group.label" :data-section="tab === 'sections' ? group.label : undefined" class="round-card">
          <header><b>{{ sourceLabel }}</b></header>
          <div v-if="latestResult(group)" class="round-record-badge"><span>최근 중간고사 CBT</span><strong>{{ latestResult(group)!.score }}점</strong><small>{{ new Date(latestResult(group)!.finishedAt).toLocaleDateString('ko-KR') }}</small></div>
          <h2>{{ group.label }}</h2>
          <p>{{ group.items.length.toLocaleString() }}문제 · 중복 문항 제외</p>
          <p v-if="tab === 'topics' && chapterInfo(group.label)" class="chapter-summary">{{ chapterInfo(group.label)!.summary }}</p>
          <button v-if="tab === 'topics' && chapterInfo(group.label)" class="chapter-open" :aria-label="`세부 목차 보기 · ${group.label}`" @click="openChapter(group)">세부 목차 {{ chapterInfo(group.label)!.sections.length }}개 보기 →</button>
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
        <label class="check"><input v-model="includeFiveCalculations" type="checkbox">계산 5개 포함</label>
        <span class="muted">{{ excludeSeen ? '새로 풀 수 있는' : '반복 포함' }} {{ randomPool.length.toLocaleString() }}문제</span>
      </div>
      <p v-if="includeFiveCalculations" class="muted calculation-quota">계산5개 + 이론{{ count - 5 }}개 · 선택 범위에 남은 계산{{ calculationAvailable }}개 / 이론{{ theoryAvailable }}개. 숫자·공식 암기는 계산으로 세지 않습니다.</p>
      <p v-if="calculationShortage" role="status" class="topic-warning">계산5개 또는 이론{{ count - 5 }}개가 부족합니다. 범위를 넓히거나 ‘이미 나온 문제 제외’ 또는 ‘계산 5개 포함’을 꺼 주세요.</p>
      <div class="midterm-actions">
        <button :disabled="loading || !randomPool.length || calculationShortage" @click="startRandom('learn')">랜덤 {{ Math.min(count, randomPool.length) }}문제 학습</button>
        <button :disabled="loading || !randomPool.length || calculationShortage" @click="startRandom('exam')">랜덤 {{ Math.min(count, randomPool.length) }}문제 CBT</button>
      </div>
      <button class="cycle-reset" @click="emit('resetDraws')">랜덤 출제 순환 다시 시작</button>
      <p v-if="!loading && !randomPool.length && excludeSeen" class="muted">선택 범위가 모두 출제됐습니다. 풀이 기록에서 이어 풀거나 출제 순환을 다시 시작하세요. 오답 기록은 지워지지 않습니다.</p>
    </section>
    <section v-else-if="tab === 'wrong'" class="selection-panel">
      <h2>중간고사 전용 오답 {{ wrongPool.length }}문제</h2><p class="muted">기존 공조·한솔 오답과 섞이지 않습니다.</p>
      <div class="midterm-actions"><button :disabled="!wrongPool.length" @click="emit('start', { items: wrongPool, mode: 'learn', randomCount: 0, label: '오답 복습' })">오답 {{ wrongPool.length }}문제 복습</button></div>
      <div class="record-grid"><article v-for="group in wrongGroups" :key="group.label">
        <h3>{{ group.label }}</h3><p>오답 {{ wrongCount(group) }}문제</p><button @click="emit('start', { items: wrongItems(group.aliases), mode: 'learn', randomCount: 0, label: `${group.label} · ${sourceLabel} 오답` })">이 범위 오답 풀기</button>
      </article></div>
    </section>
    <section v-else class="selection-panel">
      <h2>진행 중인 문제 묶음 {{ sessions.length }}개</h2><p class="muted">이전 문제·답안·위치를 보관합니다. 새 풀이는2006년3회~2016년 기존 공조, 2017년부터 한솔 자료를 사용합니다.</p>
      <div class="record-grid"><article v-for="saved in sessions" :key="saved.id" :data-session-id="saved.id"><h3>{{ saved.title }}</h3><p>{{ Object.keys(saved.answers).length }}/{{ saved.itemIds.length }}문제 · {{ new Date(saved.savedAt).toLocaleString('ko-KR') }}</p><button @click="emit('resume', saved.id!)">이 묶음 이어풀기</button></article></div>
      <h2>완료한 중간고사 {{ history.length }}개</h2>
      <div class="record-grid"><article v-for="record in history" :key="record.id"><h3>{{ record.title }}</h3><p>{{ record.mode === 'exam' ? 'CBT' : '학습' }} · {{ record.score }}점 · {{ new Date(record.finishedAt).toLocaleString('ko-KR') }}</p><button @click="emit('replay', record.id)">같은 문제 다시 풀기</button></article></div>
    </section>
    <details class="classification-help safety-separate">
      <summary>안전관리·법규 별도 {{ safetyPool.length }}문제</summary>
      <p>일반 전체·랜덤·목차 풀이에서는 제외했습니다. 필요한 경우에만 이 묶음을 따로 풉니다.</p>
      <p>법규·운전안전 {{ safetyCounts[0] }}개 · 보호장치 {{ safetyCounts[1] }}개 · 냉매 누설검사 {{ safetyCounts[2] }}개</p>
      <div class="midterm-actions">
        <button :disabled="loading || !safetyPool.length" @click="emit('start', { items: safetyPool, mode: 'learn', randomCount: 0, label: '안전관리·법규 별도' })">안전관리 별도 학습</button>
        <button :disabled="loading || !safetyPool.length" @click="emit('start', { items: safetyPool, mode: 'exam', randomCount: 0, label: '안전관리·법규 별도' })">안전관리 별도 CBT</button>
      </div>
    </details>
    <details class="classification-help"><summary>시험 범위·목차 분류 안내</summary>
      <p><a href="docs/cooling-midterm-classification-review-2026-10-08.html" target="_blank" rel="noopener">목차 분류 검토표 열기 ↗</a></p>
      <p>2006년3회~2016년은 기존 공조, 2017~2023년3회는 한솔 공조를 사용합니다. 교재 목차와 직접 관련된 냉각탑·냉매 배관·냉방설비 방식도 보강하고 안전관리·법규는 별도 분리했습니다. 교재 핵심예상문제 본문과의 페이지별 대조는 아직 하지 않았습니다.</p>
      <p>보내주신 교재의6개 장과 세부 목차를 반영했습니다. 본문에서 묻는 원리·운전·부품을 우선하고 모호한 문항은 보기·원문 그림을 추가 확인했습니다. 목차 배치가 교재에 실제 수록됐다는 뜻은 아닙니다. ‘분류 미확인’ {{ topicCount('분류 미확인') }}문제는 판정이 어려울 때 별도 유지됩니다.</p>
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
.chapter-heading { display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin:0 0 18px; }
.chapter-heading h2 { flex:1; margin:0; font-size:1.15rem; }
.chapter-summary { line-height:1.7; overflow-wrap:anywhere; }
.chapter-open { width:100%; margin-top:12px; font-size:.85rem; color:var(--primary); }
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
  .chapter-heading { display:grid; grid-template-columns:1fr 1.4fr; gap:10px; }
  .chapter-heading h2 { grid-column:1/-1; grid-row:1; }
  .chapter-heading button { padding:9px 6px; font-size:.8rem; }
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
