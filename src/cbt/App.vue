<script setup lang="ts">
import { animate, stagger } from 'motion';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import {
  latestSubjects,
  loadCatalogs,
  loadReferenceRounds,
  questionId,
  questionItems,
  roundsInRange,
  shuffle,
  sortedRounds,
  subjectFor,
  subjectsForScope,
  yearsFor,
} from './catalog';
import QuestionCard from './QuestionCard.vue';
import { applyTheme, currentTheme, hydrateIndexedDb, recordAttempt, recordExam, studyStore } from './storage';
import type { Catalog, CurriculumScope, QuestionItem, Round, SessionState, StudyMode } from './types';

type ViewName = 'home' | 'rounds' | 'wrong' | 'search' | 'stats' | 'updates';
type ExamResult = {
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  subjectRows: Array<{ subject: string; correct: number; total: number; score: number; passed: boolean }>;
};

const isJewelry = window.CBT_APP_SPACE === 'jewelry';
const spaceName = isJewelry ? '보석·귀금속 학습관' : '산업기사 통합 CBT';
const spaceScope = isJewelry ? 'jewelry' : 'industrial';
const catalogs = loadCatalogs();
const referenceRounds = loadReferenceRounds();
const qualificationMeta: Record<string, { icon: string; className: string; description: string }> = {
  hvac: { icon: '❄', className: 'blue', description: '공조·냉동·설치운영' },
  safety: { icon: '⛑', className: 'orange', description: '안전관리·위험방지' },
  energy: { icon: '♨', className: 'green', description: '열·연소·설비관리' },
  maintenance: { icon: '⚙', className: 'violet', description: '자동화·진단·기계정비' },
  'gem-appraiser': { icon: '◇', className: 'jewel-red', description: '보석학·감별·다이아몬드' },
  'precious-industrial': { icon: '◆', className: 'jewel-gold', description: '장신구·귀금속 가공' },
  'precious-craftsman': { icon: '◈', className: 'jewel-teal', description: '재료·가공·작업안전' },
  'precious-master': { icon: '✦', className: 'jewel-purple', description: '귀금속가공 종합' },
};

const qualificationStorageKey = `modern-cbt-qualification-${spaceScope}`;
const savedQualification = localStorage.getItem(qualificationStorageKey);
const selectedKey = ref(catalogs.some((item) => item.key === savedQualification) ? savedQualification! : catalogs[0]?.key || '');
const view = ref<ViewName>('home');
const curriculum = ref<CurriculumScope>('all-mapped');
const yearFrom = ref(0);
const yearTo = ref(0);
const session = ref<SessionState | null>(null);
const examResult = ref<ExamResult | null>(null);
const mobileMenuOpen = ref(false);
const sessionMenuOpen = ref(false);
const examSheetOpen = ref(true);
const toastMessage = ref('');
const theme = ref(currentTheme());
const quickPreset = ref<5 | 10 | 0>(10);
const settingsOpen = ref(false);
const updateAvailable = ref(Boolean(window.CBT_UPDATE_AVAILABLE));
const updateChecking = ref(false);
const searchQuery = ref('');
const searchResultIds = ref<string[]>([]);
const searchReady = ref(false);
const fontScale = ref(Math.min(1.2, Math.max(.9, Number(studyStore.fontScale) || 1)));
let timerHandle = 0;
let toastHandle = 0;
let searchHandle = 0;
let searchWorker: Worker | null = null;

const selectedCatalog = computed<Catalog>(() => catalogs.find((item) => item.key === selectedKey.value) || catalogs[0]);
const availableYears = computed(() => {
  const years = yearsFor(selectedCatalog.value);
  if (selectedKey.value !== 'energy') return years;
  return [...new Set([...years, ...referenceRounds.map((round) => Number(round.year))])]
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
});
const rangeRounds = computed(() => {
  const rounds = roundsInRange(selectedCatalog.value, yearFrom.value, yearTo.value);
  if (selectedKey.value === 'energy') {
    return [...referenceRounds.filter((round) => round.year >= yearFrom.value && round.year <= yearTo.value), ...rounds];
  }
  return rounds;
});
const visibleRounds = computed(() => {
  const rounds = sortedRounds(selectedCatalog.value);
  if (selectedKey.value !== 'energy') return rounds;
  return [...referenceRounds, ...rounds].sort((a, b) =>
    b.year - a.year || String(b.date || b.session || '').localeCompare(String(a.date || a.session || ''), 'ko', { numeric: true }));
});
const selectedSubjects = computed(() => subjectsForScope(selectedCatalog.value, curriculum.value));
const selectedItems = computed(() => questionItems(selectedCatalog.value, yearFrom.value, yearTo.value, curriculum.value));
const allItems = catalogs.flatMap((catalog) => sortedRounds(catalog).flatMap((round) => round.questions.map((question) => ({
  round,
  question,
  subject: subjectFor(round, question),
  id: questionId(round, question),
}))));
const itemMap = new Map(allItems.map((item) => [item.id, item]));
const wrongItems = computed(() => allItems.filter((item) => item.round.qualificationKey === selectedKey.value && studyStore.wrong[item.id]));
const searchResults = computed(() => searchResultIds.value.map((id) => itemMap.get(id)).filter((item): item is QuestionItem => Boolean(item)));
const patchEntries = computed(() => (window.CBT_CHANGELOG?.entries || []).filter((entry) => (entry.scope || 'industrial') === spaceScope));
const currentVersion = computed(() => window.CBT_CHANGELOG?.versions?.[spaceScope] || patchEntries.value[0]?.version || '-');
const darkActive = computed(() =>
  theme.value === 'dark'
  || (theme.value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches));
const viewTitle = computed(() => ({
  home: '학습 홈',
  rounds: '회차별 문제',
  wrong: '오답노트',
  search: '문제 검색',
  stats: '학습 분석',
  updates: '패치노트',
})[view.value]);
const stats = computed(() => {
  const all = selectedCatalog.value.rounds.flatMap((round) => round.questions.map((question) => questionId(round, question)));
  const answered = all.filter((id) => studyStore.attempts[id]);
  const correct = answered.filter((id) => studyStore.attempts[id]?.lastCorrect);
  const wrong = all.filter((id) => studyStore.wrong[id]);
  const bookmarks = all.filter((id) => studyStore.bookmarks.includes(id));
  return {
    total: all.length,
    answered: answered.length,
    correct: correct.length,
    wrong: wrong.length,
    bookmarks: bookmarks.length,
    accuracy: answered.length ? Math.round((correct.length / answered.length) * 100) : 0,
    coverage: all.length ? Math.round((answered.length / all.length) * 100) : 0,
  };
});
const currentItems = computed(() => {
  if (!session.value) return [];
  const start = session.value.page * session.value.pageSize;
  return session.value.items.slice(start, start + session.value.pageSize);
});
const pageCount = computed(() => session.value ? Math.ceil(session.value.items.length / session.value.pageSize) : 0);
const answeredCount = computed(() => session.value ? Object.keys(session.value.answers).length : 0);
const formattedTime = computed(() => {
  const total = Math.max(0, session.value?.remainingSeconds || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
});
const sessionTitle = computed(() => session.value?.title || '산업기사 통합 CBT');
const subjectStats = computed(() => {
  const subjects = selectedSubjects.value;
  return subjects.map((subject) => {
    const items = selectedItems.value.filter((item) => item.subject === subject);
    const attempts = items.filter((item) => studyStore.attempts[item.id]);
    const correct = attempts.filter((item) => studyStore.attempts[item.id]?.lastCorrect).length;
    const accuracy = attempts.length ? Math.round((correct / attempts.length) * 100) : 0;
    return { subject, total: items.length, answered: attempts.length, correct, accuracy };
  });
});

function setDefaultYears(yearsBack = 10): void {
  const years = availableYears.value;
  if (!years.length) {
    yearFrom.value = 0;
    yearTo.value = new Date().getFullYear();
    return;
  }
  const latest = Math.max(...years);
  yearTo.value = latest;
  yearFrom.value = yearsBack === 0 ? Math.min(...years) : Math.max(Math.min(...years), latest - yearsBack + 1);
}

function selectQualification(key: string): void {
  selectedKey.value = key;
  localStorage.setItem(qualificationStorageKey, key);
  curriculum.value = 'all-mapped';
  setDefaultYears(quickPreset.value);
  if (searchQuery.value.length >= 2) requestSearch();
  openView('rounds');
}

function applyPreset(value: 5 | 10 | 0): void {
  quickPreset.value = value;
  setDefaultYears(value);
}

function showToast(message: string): void {
  window.clearTimeout(toastHandle);
  toastMessage.value = message;
  toastHandle = window.setTimeout(() => { toastMessage.value = ''; }, 2400);
}

function openView(next: ViewName): void {
  view.value = next;
  mobileMenuOpen.value = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  window.CBTAnalytics?.trackNavigation?.(`next-${next}`);
  if (next === 'updates') void checkForUpdate(false);
  void nextTick(() => {
    animate('.page-content > *', {
      opacity: [0, 1],
      y: [12, 0],
      filter: ['blur(4px)', 'blur(0px)'],
    }, { duration: .34, delay: stagger(.035) });
  });
}

function setupSearchWorker(): void {
  searchWorker = new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' });
  searchWorker.addEventListener('message', (event: MessageEvent) => {
    const message = event.data as { type: 'ready' | 'results'; ids?: string[] };
    if (message.type === 'ready') searchReady.value = true;
    if (message.type === 'results') searchResultIds.value = message.ids || [];
  });
  searchWorker.postMessage({
    type: 'index',
    entries: allItems.map((item) => ({
      id: item.id,
      qualificationKey: item.round.qualificationKey,
      haystack: [
        item.question.text,
        item.question.html,
        item.subject,
        item.round.title,
        ...item.question.choices.map((choice) => choice.text || choice.html || ''),
      ].join(' ').replace(/<[^>]+>/g, ' ').toLocaleLowerCase('ko'),
    })),
  });
}

function requestSearch(): void {
  window.clearTimeout(searchHandle);
  searchHandle = window.setTimeout(() => {
    searchWorker?.postMessage({
      type: 'search',
      query: searchQuery.value,
      qualificationKey: selectedKey.value,
    });
  }, 120);
}

function roundToItems(round: Round): QuestionItem[] {
  return round.questions.map((question) => ({
    round,
    question,
    subject: subjectFor(round, question),
    id: questionId(round, question),
  }));
}

function beginSession(mode: StudyMode, title: string, items: QuestionItem[]): void {
  if (!items.length) {
    showToast('선택한 범위에 출제 가능한 문제가 없습니다.');
    return;
  }
  examResult.value = null;
  sessionMenuOpen.value = false;
  session.value = {
    id: `${mode}-${Date.now()}`,
    mode,
    title,
    items,
    answers: {},
    page: 0,
    pageSize: 4,
    startedAt: Date.now(),
    remainingSeconds: mode === 'exam' ? Math.max(90 * 60, Math.ceil(items.length * 90)) : 0,
    finished: false,
  };
  examSheetOpen.value = mode === 'exam';
  document.body.classList.add('session-active');
  restartTimer();
  window.scrollTo({ top: 0 });
  window.CBTAnalytics?.trackNavigation?.(`next-${mode}`);
  void nextTick(() => {
    animate('.session-topbar', { opacity: [0, 1], y: [-10, 0] }, { duration: .28 });
    animate('.question-card', { opacity: [0, 1], scale: [.985, 1], y: [10, 0] }, { duration: .35, delay: stagger(.055) });
  });
}

function startRound(round: Round, mode: StudyMode): void {
  beginSession(mode, `${round.year}년 ${round.session || ''} ${mode === 'exam' ? '실전시험' : '학습'}`, roundToItems(round));
}

function startBalancedExam(): void {
  const items = selectedItems.value;
  const subjects = selectedSubjects.value;
  if (!items.length || !subjects.length) {
    showToast('선택한 연도와 출제 체계를 다시 확인해 주세요.');
    return;
  }
  const selected = subjects.flatMap((subject) => {
    const pool = items.filter((item) => item.subject === subject);
    return shuffle(pool).slice(0, Math.min(20, pool.length));
  });
  if (selected.length < subjects.length * 20) {
    showToast('일부 과목은 문제가 부족해 가능한 문항만 출제했습니다.');
  }
  beginSession(
    'exam',
    `${selectedCatalog.value.shortName || selectedCatalog.value.name} · ${yearFrom.value}~${yearTo.value} 랜덤시험`,
    selected,
  );
}

function startRangeLearning(): void {
  beginSession(
    'learn',
    `${selectedCatalog.value.shortName || selectedCatalog.value.name} · ${yearFrom.value}~${yearTo.value} 학습`,
    selectedItems.value,
  );
}

function chooseAnswer(item: QuestionItem, choice: number): void {
  if (!session.value || session.value.finished) return;
  session.value.answers[item.id] = choice;
  if (session.value.mode === 'learn') {
    const attempt = recordAttempt(item.id, choice, item.question.answer);
    window.CBTAnalytics?.trackAttempt?.({
      qualificationKey: item.round.qualificationKey,
      qualification: item.round.qualification,
      roundId: item.round.id,
      questionNumber: item.question.number,
      selectedAnswer: choice,
      correctAnswer: item.question.answer,
      correct: attempt.lastCorrect,
      mode: 'learn',
    });
  }
}

function toggleBookmark(item: QuestionItem): void {
  const index = studyStore.bookmarks.indexOf(item.id);
  if (index >= 0) {
    studyStore.bookmarks.splice(index, 1);
    showToast('북마크에서 제거했습니다.');
  } else {
    studyStore.bookmarks.push(item.id);
    showToast('북마크에 저장했습니다.');
  }
}

function isSubjectStart(item: QuestionItem): boolean {
  const index = session.value?.items.findIndex((entry) => entry.id === item.id) ?? -1;
  if (index <= 0) return index === 0;
  return session.value?.items[index - 1]?.subject !== item.subject;
}

function sessionSubjectNumber(item: QuestionItem): number {
  if (!session.value) return 1;
  return [...new Set(session.value.items.map((entry) => entry.subject))].indexOf(item.subject) + 1;
}

function goToPage(page: number): void {
  if (!session.value) return;
  session.value.page = Math.max(0, Math.min(pageCount.value - 1, page));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToQuestion(index: number): void {
  if (!session.value) return;
  goToPage(Math.floor(index / session.value.pageSize));
  if (window.innerWidth < 1100) examSheetOpen.value = false;
}

function resetLearning(): void {
  if (!session.value || session.value.mode !== 'learn') return;
  if (!confirm('현재 화면에서 선택한 답을 모두 초기화할까요? 저장된 누적 학습 통계는 유지됩니다.')) return;
  session.value.answers = {};
  session.value.page = 0;
  showToast('현재 학습 선택을 초기화했습니다.');
}

function submitExam(force = false): void {
  if (!session.value || session.value.mode !== 'exam' || session.value.finished) return;
  if (!force && answeredCount.value < session.value.items.length) {
    const remaining = session.value.items.length - answeredCount.value;
    if (!confirm(`아직 ${remaining}문제가 남았습니다. 그래도 채점할까요?`)) return;
  }
  session.value.finished = true;
  stopTimer();

  const grouped = new Map<string, { correct: number; total: number }>();
  let correct = 0;
  session.value.items.forEach((item) => {
    const isCorrect = session.value?.answers[item.id] === item.question.answer;
    if (isCorrect) correct += 1;
    const row = grouped.get(item.subject) || { correct: 0, total: 0 };
    row.total += 1;
    if (isCorrect) row.correct += 1;
    grouped.set(item.subject, row);
    if (session.value?.answers[item.id]) recordAttempt(item.id, session.value.answers[item.id], item.question.answer);
  });
  const score = Math.round((correct / session.value.items.length) * 100);
  const subjectRows = [...grouped.entries()].map(([subject, row]) => ({
    subject,
    ...row,
    score: Math.round((row.correct / row.total) * 100),
    passed: (row.correct / row.total) * 100 >= 40,
  }));
  const passed = score >= 60 && subjectRows.every((row) => row.passed);
  examResult.value = { score, correct, total: session.value.items.length, passed, subjectRows };
  void recordExam({
    id: session.value.id,
    qualificationKey: selectedKey.value,
    title: session.value.title,
    score,
    passed,
    answered: answeredCount.value,
    total: session.value.items.length,
    finishedAt: Date.now(),
  });
  window.CBTAnalytics?.trackResult?.({
    qualificationKey: selectedKey.value,
    qualification: selectedCatalog.value.name,
    mode: 'exam',
    score,
    correct,
    total: session.value.items.length,
    unanswered: session.value.items.length - answeredCount.value,
  });
}

function leaveSession(nextView?: ViewName): void {
  if (session.value && !session.value.finished && answeredCount.value > 0) {
    if (!confirm('현재 풀이를 종료하고 이동할까요?')) return;
  }
  stopTimer();
  session.value = null;
  examResult.value = null;
  sessionMenuOpen.value = false;
  if (nextView) view.value = nextView;
  document.body.classList.remove('session-active');
  window.scrollTo({ top: 0 });
}

function restartTimer(): void {
  stopTimer();
  if (session.value?.mode !== 'exam') return;
  timerHandle = window.setInterval(() => {
    if (!session.value || session.value.finished) return;
    session.value.remainingSeconds -= 1;
    if (session.value.remainingSeconds <= 0) submitExam(true);
  }, 1000);
}

function stopTimer(): void {
  window.clearInterval(timerHandle);
  timerHandle = 0;
}

function openCalculator(): void {
  const calculator = window.open(
    new URL('calculator.html', location.href).href,
    'cbtScientificCalculator',
    'popup=yes,width=470,height=820,resizable=yes,scrollbars=yes',
  );
  if (calculator) calculator.focus();
  else showToast('브라우저에서 이 사이트의 팝업을 허용해 주세요.');
}

function changeTheme(): void {
  theme.value = theme.value === 'system' ? 'light' : theme.value === 'light' ? 'dark' : 'system';
  applyTheme(theme.value);
  showToast(theme.value === 'system' ? '기기 설정 테마' : theme.value === 'dark' ? '다크 모드' : '라이트 모드');
}

function toggleLightDark(): void {
  theme.value = darkActive.value ? 'light' : 'dark';
  applyTheme(theme.value);
  showToast(darkActive.value ? '다크 모드로 전환했습니다.' : '라이트 모드로 전환했습니다.');
}

function setFontScale(value: number): void {
  const normalized = Math.min(1.2, Math.max(.9, Math.round(value * 10) / 10));
  fontScale.value = normalized;
  studyStore.fontScale = normalized;
  document.documentElement.style.fontSize = `${normalized * 16}px`;
}

function adjustFontScale(amount: number): void {
  setFontScale(fontScale.value + amount);
  showToast(`문자 크기 ${Math.round(fontScale.value * 100)}%`);
}

function handleUpdateAvailable(): void {
  updateAvailable.value = true;
}

async function checkForUpdate(notify = true): Promise<void> {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
    if (notify) showToast('온라인 홈페이지에서 업데이트를 확인할 수 있습니다.');
    return;
  }
  updateChecking.value = true;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      if (notify) showToast('업데이트 기능을 준비하는 중입니다. 잠시 후 다시 확인해 주세요.');
      return;
    }
    await registration.update();
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    if (notify) showToast(updateAvailable.value ? '새 버전을 찾았습니다.' : '현재 최신 버전입니다.');
  } catch {
    if (notify) showToast('업데이트 확인에 실패했습니다. 인터넷 연결을 확인해 주세요.');
  } finally {
    updateChecking.value = false;
  }
}

function applyUpdate(): void {
  if (session.value && answeredCount.value > 0 && !confirm('새 버전을 적용하면 현재 풀이 화면이 새로고침됩니다. 지금 적용할까요?')) return;
  location.reload();
}

function exportLearningData(): void {
  const blob = new Blob([JSON.stringify({
    exportedAt: new Date().toISOString(),
    space: spaceScope,
    data: studyStore,
  }, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${spaceScope}-cbt-learning-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('학습 기록 파일을 저장했습니다.');
}

function clearLearningData(): void {
  if (!confirm('오답, 진도, 시험 기록을 모두 초기화할까요? 이 작업은 되돌릴 수 없습니다.')) return;
  Object.keys(studyStore.attempts).forEach((key) => delete studyStore.attempts[key]);
  Object.keys(studyStore.wrong).forEach((key) => delete studyStore.wrong[key]);
  studyStore.bookmarks.splice(0);
  studyStore.history.splice(0);
  Object.keys(studyStore.notes).forEach((key) => delete studyStore.notes[key]);
  settingsOpen.value = false;
  showToast('학습 기록을 초기화했습니다.');
}

function subjectQuestionCount(subject: string): number {
  return selectedItems.value.filter((item) => item.subject === subject).length;
}

function roundProgress(round: Round): number {
  const ids = round.questions.map((question) => questionId(round, question));
  const answered = ids.filter((id) => studyStore.attempts[id]).length;
  return ids.length ? Math.round((answered / ids.length) * 100) : 0;
}

function roundAnswered(round: Round): number {
  return round.questions.filter((question) => studyStore.attempts[questionId(round, question)]).length;
}

function roundExamMinutes(round: Round): number {
  return Math.round(round.questions.length * 1.5);
}

function isRestoredRound(round: Round): boolean {
  return round.qualificationKey === 'hvac' && round.year >= 2021;
}

watch([yearFrom, yearTo], () => {
  if (yearFrom.value > yearTo.value) [yearFrom.value, yearTo.value] = [yearTo.value, yearFrom.value];
});

onMounted(async () => {
  window.addEventListener('cbt:update-available', handleUpdateAvailable);
  applyTheme(theme.value);
  setFontScale(fontScale.value);
  setDefaultYears(10);
  await hydrateIndexedDb();
  setupSearchWorker();
  await nextTick();
  animate('.qualification-card', { opacity: [0, 1], y: [12, 0] }, { duration: 0.38, delay: stagger(0.055) });
});

onBeforeUnmount(() => {
  window.removeEventListener('cbt:update-available', handleUpdateAvailable);
  stopTimer();
  window.clearTimeout(toastHandle);
  window.clearTimeout(searchHandle);
  searchWorker?.terminate();
});
</script>

<template>
  <div v-if="!session" class="app-frame">
    <aside class="sidebar" :class="{ open: mobileMenuOpen }">
      <button class="brand" type="button" @click="openView('home')">
        <span>{{ isJewelry ? 'GEM' : 'CBT' }}</span>
        <div><strong>{{ spaceName }}</strong><small>{{ isJewelry ? 'JEWELRY STUDY' : 'SMART STUDY' }}</small></div>
      </button>
      <nav>
        <button :class="{ active: view === 'home' }" @click="openView('home')"><span>⌂</span>홈</button>
        <button :class="{ active: view === 'rounds' }" @click="openView('rounds')"><span>▤</span>회차별 문제</button>
        <button :class="{ active: view === 'wrong' }" @click="openView('wrong')"><span>!</span>오답노트 <b v-if="stats.wrong">{{ stats.wrong }}</b></button>
        <button :class="{ active: view === 'search' }" @click="openView('search')"><span>⌕</span>문제 검색</button>
        <button :class="{ active: view === 'stats' }" @click="openView('stats')"><span>▥</span>학습 분석</button>
        <button :class="{ active: view === 'updates' }" @click="openView('updates')"><span>◷</span>패치노트</button>
      </nav>
      <a class="space-portal" :href="isJewelry ? 'index.html' : 'jewelry.html'">
        <span>{{ isJewelry ? 'CBT' : '◇' }}</span>
        <div><strong>{{ isJewelry ? '산업기사 CBT' : '보석관' }}</strong><small>독립 학습 페이지로 이동</small></div>
        <b>›</b>
      </a>
      <div class="sidebar-foot">
        <button type="button" @click="openCalculator"><span>▦</span>공학용 계산기</button>
        <button type="button" @click="settingsOpen = true"><span>⚙</span>화면·데이터 설정</button>
        <a href="legacy.html"><span>◫</span>이전 버전</a>
      </div>
    </aside>
    <button v-if="mobileMenuOpen" class="mobile-backdrop" aria-label="메뉴 닫기" @click="mobileMenuOpen = false" />

    <main class="main-area">
      <header class="topbar">
        <button class="menu-button" type="button" @click="mobileMenuOpen = true">☰ <span>메뉴</span></button>
        <div>
          <strong>{{ viewTitle }}</strong>
          <span>{{ selectedCatalog.name }}</span>
        </div>
        <div class="top-actions">
          <button type="button" @click="openView('search')">⌕ <span>검색</span></button>
          <button type="button" @click="openCalculator">▦ <span>계산기</span></button>
          <button type="button" class="theme-quick-button" @click="toggleLightDark">{{ darkActive ? '☀' : '☾' }} <span>{{ darkActive ? '라이트 모드' : '다크 모드' }}</span></button>
          <button type="button" @click="settingsOpen = true">⚙ <span>설정</span></button>
        </div>
      </header>

      <div class="page-content">
        <template v-if="view === 'home'">
          <section class="qualification-section">
            <div class="section-title">
              <div>
                <span>QUALIFICATIONS</span>
                <h1>준비할 종목을 선택하세요</h1>
                <p>선택 즉시 아래 과목, 연도 범위와 출제 문항이 바뀝니다.</p>
              </div>
              <div class="compact-stats">
                <span>학습<strong>{{ stats.answered.toLocaleString() }}</strong></span>
                <span>정답률<strong>{{ stats.accuracy }}%</strong></span>
                <span>오답<strong>{{ stats.wrong.toLocaleString() }}</strong></span>
              </div>
            </div>
            <div class="qualification-grid">
              <button
                v-for="catalog in catalogs"
                :key="catalog.key"
                type="button"
                class="qualification-card"
                :class="[qualificationMeta[catalog.key]?.className, { selected: selectedKey === catalog.key }]"
                @click="selectQualification(catalog.key)"
              >
                <span class="qualification-icon">{{ qualificationMeta[catalog.key]?.icon }}</span>
                <span class="qualification-copy">
                  <strong>{{ catalog.name }}</strong>
                  <small>{{ catalog.rounds.length }}회차 · {{ catalog.rounds.reduce((sum, round) => sum + round.questions.length, 0).toLocaleString() }}문제</small>
                  <em>{{ qualificationMeta[catalog.key]?.description }}</em>
                </span>
                <b>›</b>
              </button>
            </div>
          </section>

          <section class="study-builder">
            <div class="builder-heading">
              <div><span>STUDY SETUP</span><h2>연도와 출제 체계를 정하세요</h2></div>
              <div class="preset-buttons">
                <button :class="{ active: quickPreset === 5 }" @click="applyPreset(5)">최근 5년</button>
                <button :class="{ active: quickPreset === 10 }" @click="applyPreset(10)">최근 10년</button>
                <button :class="{ active: quickPreset === 0 }" @click="applyPreset(0)">전체</button>
              </div>
            </div>

            <div class="builder-controls">
              <label>
                <span>시작 연도</span>
                <select v-model.number="yearFrom">
                  <option v-for="year in [...availableYears].reverse()" :key="year" :value="year">{{ year }}년</option>
                </select>
              </label>
              <span class="range-arrow">→</span>
              <label>
                <span>끝 연도</span>
                <select v-model.number="yearTo">
                  <option v-for="year in availableYears" :key="year" :value="year">{{ year }}년</option>
                </select>
              </label>
              <label class="curriculum-control">
                <span>출제 체계</span>
                <select v-model="curriculum">
                  <option value="all-mapped">{{ selectedKey === 'hvac' ? '통합 3과목 · 구문제 포함' : '전체 기출문제 포함' }}</option>
                  <option value="current">현재 과목 체계만</option>
                  <option v-if="selectedKey === 'hvac'" value="legacy-original">구 4과목 원형</option>
                </select>
              </label>
            </div>

            <div class="scope-summary">
              <div><span>선택 범위</span><strong>{{ yearFrom }}~{{ yearTo }}년</strong><small>{{ rangeRounds.length }}회차 사용</small></div>
              <div><span>출제 가능</span><strong>{{ selectedItems.length.toLocaleString() }}문제</strong><small>과목별 균형 출제</small></div>
              <div><span>실전 구성</span><strong>{{ selectedSubjects.length }}과목 × 20문제</strong><small>평균 60점 · 과락 40점</small></div>
            </div>

            <div class="subject-strip">
              <article v-for="(subject, index) in selectedSubjects" :key="subject">
                <span>{{ index + 1 }}과목</span>
                <strong>{{ subject }}</strong>
                <small>{{ subjectQuestionCount(subject).toLocaleString() }}문제</small>
              </article>
            </div>

            <div class="start-actions">
              <button class="learning-start" type="button" @click="startRangeLearning">
                <span>차근차근 익히기</span><strong>선택 범위 학습모드</strong><small>한 화면 4문제 · 즉시 채점 · 쉬운 해설</small>
              </button>
              <button class="exam-start" type="button" @click="startBalancedExam">
                <span>실제 시험처럼</span><strong>과목 균형 랜덤시험</strong><small>과목별 20문제 · OMR · 타이머</small>
              </button>
              <button class="round-start" type="button" @click="openView('rounds')">
                <span>연도 순서대로</span><strong>회차별 기출문제</strong><small>{{ yearFrom }}~{{ yearTo }}년 목록 보기</small>
              </button>
            </div>
          </section>

          <section class="progress-panel">
            <div>
              <span>현재 종목 학습률</span>
              <strong>{{ stats.coverage }}%</strong>
              <div class="progress-track"><i :style="{ width: `${stats.coverage}%` }" /></div>
            </div>
            <dl>
              <div><dt>전체 문제</dt><dd>{{ stats.total.toLocaleString() }}</dd></div>
              <div><dt>푼 문제</dt><dd>{{ stats.answered.toLocaleString() }}</dd></div>
              <div><dt>맞힌 문제</dt><dd>{{ stats.correct.toLocaleString() }}</dd></div>
              <div><dt>북마크</dt><dd>{{ stats.bookmarks.toLocaleString() }}</dd></div>
            </dl>
          </section>
        </template>

        <template v-else-if="view === 'rounds'">
          <section class="rounds-heading">
            <div><span>PAST EXAMS</span><h1>{{ selectedCatalog.name }} 기출문제</h1><p>수록된 전체 {{ visibleRounds.length }}회차</p></div>
            <button type="button" @click="openView('home')">← 종목 선택으로</button>
          </section>
          <div class="round-grid">
            <article v-for="round in visibleRounds" :key="round.id" class="round-card">
              <header><span>{{ round.shortQualification || round.qualification }}</span><b>{{ round.year }}년</b></header>
              <em v-if="isRestoredRound(round)" class="round-restored">CBT 복원문제 · 원문 이미지</em>
              <h2>{{ round.title }}</h2>
              <p>{{ round.questions.length }}문제 · {{ round.subjects.length }}과목 · 시험 {{ roundExamMinutes(round) }}분</p>
              <div class="round-subjects"><span v-for="subject in round.subjects" :key="subject">{{ subject }}</span></div>
              <div v-if="roundAnswered(round)" class="round-progress"><span><i :style="{ width: `${roundProgress(round)}%` }" /></span></div>
              <small v-if="roundAnswered(round)" class="round-progress-copy">{{ roundAnswered(round) }}/{{ round.questions.length }} 학습 중</small>
              <footer>
                <button type="button" @click="startRound(round, 'learn')">{{ roundAnswered(round) ? '이어 학습' : '학습모드' }}</button>
                <button type="button" @click="startRound(round, 'exam')">CBT 시험모드</button>
              </footer>
            </article>
          </div>
        </template>

        <template v-else-if="view === 'wrong'">
          <section class="tool-hero wrong-hero">
            <div><span>WRONG ANSWERS</span><h1>틀린 문제만 빠르게 복습하세요</h1><p>{{ selectedCatalog.name }}에서 현재 {{ wrongItems.length }}문제가 복습을 기다리고 있습니다.</p></div>
            <button v-if="wrongItems.length" type="button" @click="beginSession('learn', `${selectedCatalog.shortName || selectedCatalog.name} 오답 복습`, wrongItems)">전체 오답 다시 풀기</button>
          </section>
          <div v-if="wrongItems.length" class="question-library">
            <article v-for="item in wrongItems" :key="item.id">
              <header><span>{{ item.round.year }}년 · {{ item.subject }}</span><b>{{ item.question.number }}번</b></header>
              <p>{{ item.question.text || '원문 이미지 문제' }}</p>
              <footer>
                <span>{{ studyStore.attempts[item.id]?.wrongCount || 1 }}회 오답</span>
                <button type="button" @click="beginSession('learn', `${item.round.year}년 ${item.question.number}번 복습`, [item])">다시 풀기 →</button>
              </footer>
            </article>
          </div>
          <section v-else class="empty-state"><span>✓</span><h2>현재 오답이 없습니다</h2><p>학습모드에서 틀린 문제가 생기면 이곳에 자동으로 모입니다.</p><button @click="openView('home')">학습 시작하기</button></section>
        </template>

        <template v-else-if="view === 'search'">
          <section class="search-command">
            <span>QUESTION FINDER</span>
            <h1>문제·보기·과목을 한 번에 검색</h1>
            <div>
              <b>⌕</b>
              <input v-model="searchQuery" type="search" placeholder="예: 냉동사이클, 레이놀즈수, 안전밸브" autofocus @input="requestSearch">
              <small>{{ searchReady ? `${selectedCatalog.name} 검색 준비 완료` : '문제 색인을 준비하는 중' }}</small>
            </div>
          </section>
          <div class="search-summary">
            <span v-if="searchQuery.length < 2">두 글자 이상 입력하면 바로 검색됩니다.</span>
            <span v-else><strong>{{ searchResults.length }}</strong>개의 검색 결과</span>
          </div>
          <div v-if="searchResults.length" class="question-library search-library">
            <article v-for="item in searchResults" :key="item.id">
              <header><span>{{ item.round.year }}년 · {{ item.subject }}</span><b>{{ item.question.number }}번</b></header>
              <p>{{ item.question.text || '원문 이미지 문제' }}</p>
              <footer>
                <span>{{ item.round.session || item.round.title }}</span>
                <button type="button" @click="beginSession('learn', `${item.round.year}년 ${item.question.number}번`, [item])">문제 열기 →</button>
              </footer>
            </article>
          </div>
          <section v-else-if="searchQuery.length >= 2" class="empty-state"><span>⌕</span><h2>일치하는 문제를 찾지 못했습니다</h2><p>검색어를 짧게 줄이거나 다른 용어로 입력해 보세요.</p></section>
        </template>

        <template v-else-if="view === 'stats'">
          <section class="stats-hero">
            <div><span>LEARNING REPORT</span><h1>{{ selectedCatalog.name }} 학습 통계</h1><p>기존 CBT에서 푼 기록과 새 화면의 기록을 함께 표시합니다.</p></div>
            <strong>{{ stats.accuracy }}<small>%</small></strong>
          </section>
          <section class="stats-grid">
            <article><span>전체 문제</span><strong>{{ stats.total.toLocaleString() }}</strong><small>수록 문항</small></article>
            <article><span>학습 문제</span><strong>{{ stats.answered.toLocaleString() }}</strong><small>학습률 {{ stats.coverage }}%</small></article>
            <article><span>맞힌 문제</span><strong>{{ stats.correct.toLocaleString() }}</strong><small>최근 선택 기준</small></article>
            <article><span>복습 필요</span><strong>{{ stats.wrong.toLocaleString() }}</strong><small>현재 오답</small></article>
          </section>
          <section class="subject-report">
            <header><div><span>SUBJECT ANALYSIS</span><h2>과목별 학습 현황</h2></div><small>최근 선택한 답 기준</small></header>
            <div v-for="row in subjectStats" :key="row.subject" class="subject-row">
              <div><strong>{{ row.subject }}</strong><span>{{ row.answered.toLocaleString() }}/{{ row.total.toLocaleString() }}문제 학습</span></div>
              <div class="subject-bar"><i :style="{ width: `${row.accuracy}%` }" /></div>
              <b>{{ row.accuracy }}%</b>
            </div>
          </section>
        </template>

        <template v-else>
          <section class="patch-heading">
            <div><span>RELEASE NOTES</span><h1>{{ spaceName }} 패치노트</h1><p>새 기능과 수정 내용을 버전별로 확인할 수 있습니다.</p></div>
            <div class="patch-version-actions">
              <strong>v{{ currentVersion }}</strong>
              <button type="button" :disabled="updateChecking" @click="checkForUpdate(true)">{{ updateChecking ? '확인 중…' : '최신 버전 확인' }}</button>
            </div>
          </section>
          <div class="patch-timeline">
            <article v-for="(entry, index) in patchEntries" :key="`${entry.version}-${entry.title}`" :class="{ latest: index === 0 }">
              <div class="patch-version"><span>v{{ entry.version }}</span><small>{{ entry.date }}</small></div>
              <div>
                <header><h2>{{ entry.title }}</h2><b v-if="index === 0">최신</b></header>
                <p>{{ entry.summary }}</p>
                <div class="patch-tags"><span v-for="tag in entry.tags || []" :key="tag">{{ tag }}</span></div>
                <ul><li v-for="change in entry.changes || []" :key="change">{{ change }}</li></ul>
              </div>
            </article>
          </div>
        </template>
      </div>
    </main>
    <nav class="mobile-tabbar">
      <button :class="{ active: view === 'home' }" @click="openView('home')"><span>⌂</span>홈</button>
      <button :class="{ active: view === 'rounds' }" @click="openView('rounds')"><span>▤</span>회차</button>
      <button :class="{ active: view === 'wrong' }" @click="openView('wrong')"><span>!</span>오답</button>
      <button :class="{ active: view === 'search' }" @click="openView('search')"><span>⌕</span>검색</button>
      <button :class="{ active: view === 'stats' }" @click="openView('stats')"><span>▥</span>통계</button>
    </nav>
    <div v-if="settingsOpen" class="settings-backdrop" @click.self="settingsOpen = false">
      <section class="settings-panel">
        <header><div><span>PERSONAL SETTINGS</span><h2>화면과 학습 데이터</h2></div><button aria-label="설정 닫기" @click="settingsOpen = false">×</button></header>
        <div class="setting-group">
          <span>화면 테마</span>
          <div class="theme-options">
            <button :class="{ active: theme === 'system' }" @click="theme = 'system'; applyTheme(theme)"><strong>◐ 자동</strong><small>기기 설정</small></button>
            <button :class="{ active: theme === 'light' }" @click="theme = 'light'; applyTheme(theme)"><strong>☀ 라이트</strong><small>밝은 화면</small></button>
            <button :class="{ active: theme === 'dark' }" @click="theme = 'dark'; applyTheme(theme)"><strong>☾ 다크</strong><small>어두운 화면</small></button>
          </div>
        </div>
        <div class="setting-group">
          <span>문자 크기</span>
          <div class="font-options">
            <button :class="{ active: fontScale === .9 }" @click="setFontScale(.9)">작게</button>
            <button :class="{ active: fontScale === 1 }" @click="setFontScale(1)">기본</button>
            <button :class="{ active: fontScale === 1.1 }" @click="setFontScale(1.1)">크게</button>
            <button :class="{ active: fontScale === 1.2 }" @click="setFontScale(1.2)">아주 크게</button>
          </div>
        </div>
        <div class="setting-group data-setting">
          <span>학습 기록</span>
          <p>이 기기에 저장된 오답·진도·시험 기록을 파일로 보관하거나 초기화할 수 있습니다.</p>
          <div><button @click="exportLearningData">기록 내보내기</button><button class="danger" @click="clearLearningData">전체 초기화</button></div>
        </div>
        <footer><span>현재 버전</span><strong>v{{ currentVersion }}</strong></footer>
      </section>
    </div>
  </div>

  <div v-else class="session-shell" :class="{ 'exam-mode': session.mode === 'exam', 'sheet-closed': !examSheetOpen }">
    <header class="session-topbar">
      <div class="session-leading">
        <button class="back-button" type="button" @click="leaveSession()">← <span>뒤로가기</span></button>
        <button class="session-menu-button" type="button" @click="sessionMenuOpen = true">☰ <span>메뉴</span></button>
      </div>
      <div><span>{{ session.mode === 'exam' ? 'CBT EXAM' : 'LEARNING MODE' }}</span><strong>{{ sessionTitle }}</strong></div>
      <div class="session-tools">
        <button type="button" @click="openCalculator">▦ 계산기</button>
        <div class="session-font-control" aria-label="문자 크기 조절">
          <button type="button" aria-label="문자 작게" :disabled="fontScale <= .9" @click="adjustFontScale(-.1)">가−</button>
          <button type="button" title="기본 크기로" @click="setFontScale(1)">{{ Math.round(fontScale * 100) }}%</button>
          <button type="button" aria-label="문자 크게" :disabled="fontScale >= 1.2" @click="adjustFontScale(.1)">가+</button>
        </div>
        <label v-if="session.mode === 'learn'">
          문제 표시
          <select v-model.number="session.pageSize" @change="session.page = 0">
            <option :value="2">2문제</option>
            <option :value="4">4문제</option>
            <option :value="6">6문제</option>
          </select>
        </label>
        <button v-if="session.mode === 'learn'" type="button" class="reset-button" @click="resetLearning">선택 초기화</button>
        <button v-else type="button" class="timer-button">남은 시간 <strong>{{ formattedTime }}</strong></button>
        <button v-if="session.mode === 'exam'" type="button" @click="examSheetOpen = !examSheetOpen">{{ examSheetOpen ? 'OMR 닫기' : 'OMR 열기' }}</button>
      </div>
    </header>

    <button v-if="sessionMenuOpen" class="session-menu-backdrop" type="button" aria-label="풀이 메뉴 닫기" @click="sessionMenuOpen = false" />
    <aside class="session-drawer" :class="{ open: sessionMenuOpen }">
      <header><div><span>CBT</span><strong>풀이 메뉴</strong></div><button type="button" aria-label="닫기" @click="sessionMenuOpen = false">×</button></header>
      <nav>
        <button type="button" @click="leaveSession('home')"><span>⌂</span><div><strong>첫 화면</strong><small>종목 선택과 학습 설정</small></div></button>
        <button type="button" @click="leaveSession('rounds')"><span>▤</span><div><strong>회차별 문제</strong><small>전체 기출 회차 선택</small></div></button>
        <button type="button" @click="leaveSession('wrong')"><span>!</span><div><strong>오답노트</strong><small>틀린 문제 다시 풀기</small></div></button>
        <button type="button" @click="leaveSession('updates')"><span>◷</span><div><strong>패치노트</strong><small>최근 업데이트 확인</small></div></button>
      </nav>
      <footer>
        <button type="button" @click="openCalculator">▦ 공학용 계산기</button>
        <button type="button" @click="toggleLightDark">{{ darkActive ? '☀ 라이트 모드' : '☾ 다크 모드' }}</button>
      </footer>
    </aside>

    <main class="session-main">
      <section class="question-area">
        <div class="question-grid">
          <QuestionCard
            v-for="item in currentItems"
            :key="item.id"
            :item="item"
            :mode="session.mode"
            :selected="session.answers[item.id]"
            :subject-start="isSubjectStart(item)"
            :subject-number="sessionSubjectNumber(item)"
            :bookmarked="studyStore.bookmarks.includes(item.id)"
            @choose="chooseAnswer(item, $event)"
            @toggle-bookmark="toggleBookmark(item)"
          />
        </div>
        <footer class="pager">
          <button type="button" :disabled="session.page === 0" @click="goToPage(session.page - 1)">← 이전</button>
          <span><strong>{{ session.page + 1 }}</strong> / {{ pageCount }}</span>
          <button type="button" :disabled="session.page >= pageCount - 1" @click="goToPage(session.page + 1)">다음 →</button>
        </footer>
      </section>

      <aside v-if="session.mode === 'exam'" class="omr-sheet">
        <header><div><span>ANSWER SHEET</span><strong>답안지</strong></div><b>{{ answeredCount }}/{{ session.items.length }}</b></header>
        <div class="omr-list">
          <button
            v-for="(item, index) in session.items"
            :key="item.id"
            type="button"
            :class="{ current: Math.floor(index / session.pageSize) === session.page }"
            @click="goToQuestion(index)"
          >
            <strong>{{ index + 1 }}.</strong>
            <span
              v-for="choice in 4"
              :key="choice"
              :class="{ marked: session.answers[item.id] === choice }"
              @click.stop="chooseAnswer(item, choice)"
            >{{ choice }}</span>
          </button>
        </div>
        <footer><button type="button" @click="submitExam(false)">채점하기</button></footer>
      </aside>
    </main>

    <div v-if="examResult" class="result-backdrop">
      <section class="result-card">
        <span>{{ examResult.passed ? 'PASS' : 'REVIEW' }}</span>
        <h2>{{ examResult.passed ? '합격 기준을 통과했습니다' : '조금 더 복습이 필요합니다' }}</h2>
        <div class="result-score">{{ examResult.score }}<small>점</small></div>
        <p>{{ examResult.total }}문제 중 {{ examResult.correct }}문제를 맞혔습니다.</p>
        <div class="subject-results">
          <div v-for="row in examResult.subjectRows" :key="row.subject">
            <span>{{ row.subject }}</span><strong>{{ row.score }}점</strong><small :class="{ fail: !row.passed }">{{ row.passed ? '통과' : '과락' }}</small>
          </div>
        </div>
        <div class="result-actions">
          <button type="button" @click="examResult = null; session.finished = false">문제 다시 보기</button>
          <button type="button" @click="leaveSession('home')">홈으로</button>
        </div>
      </section>
    </div>
  </div>

  <Transition name="toast">
    <aside v-if="updateAvailable" class="update-notice">
      <div><span>NEW VERSION</span><strong>새로운 CBT 업데이트가 준비됐습니다</strong><small>버튼을 누르면 최신 화면과 패치노트가 적용됩니다.</small></div>
      <button type="button" @click="applyUpdate">업데이트 적용</button>
    </aside>
  </Transition>

  <Transition name="toast">
    <div v-if="toastMessage" class="toast-message">{{ toastMessage }}</div>
  </Transition>
</template>
