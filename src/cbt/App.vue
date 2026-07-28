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

type ViewName = 'home' | 'rounds' | 'stats';
type ExamResult = {
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  subjectRows: Array<{ subject: string; correct: number; total: number; score: number; passed: boolean }>;
};

const catalogs = loadCatalogs();
const referenceRounds = loadReferenceRounds();
const qualificationMeta: Record<string, { icon: string; className: string; description: string }> = {
  hvac: { icon: '❄', className: 'blue', description: '공조·냉동·설치운영' },
  safety: { icon: '⛑', className: 'orange', description: '안전관리·위험방지' },
  energy: { icon: '♨', className: 'green', description: '열·연소·설비관리' },
  maintenance: { icon: '⚙', className: 'violet', description: '자동화·진단·기계정비' },
};

const savedQualification = localStorage.getItem('modern-cbt-qualification');
const selectedKey = ref(catalogs.some((item) => item.key === savedQualification) ? savedQualification! : 'hvac');
const view = ref<ViewName>('home');
const curriculum = ref<CurriculumScope>('all-mapped');
const yearFrom = ref(0);
const yearTo = ref(0);
const session = ref<SessionState | null>(null);
const examResult = ref<ExamResult | null>(null);
const mobileMenuOpen = ref(false);
const examSheetOpen = ref(true);
const toastMessage = ref('');
const theme = ref(currentTheme());
const quickPreset = ref<5 | 10 | 0>(10);
let timerHandle = 0;
let toastHandle = 0;

const selectedCatalog = computed<Catalog>(() => catalogs.find((item) => item.key === selectedKey.value) || catalogs[0]);
const availableYears = computed(() => {
  const years = yearsFor(selectedCatalog.value);
  if (selectedKey.value !== 'energy') return years;
  return [...new Set([...years, ...referenceRounds.map((round) => Number(round.year))])]
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
});
const visibleRounds = computed(() => {
  const rounds = roundsInRange(selectedCatalog.value, yearFrom.value, yearTo.value);
  if (selectedKey.value === 'energy') {
    return [...referenceRounds.filter((round) => round.year >= yearFrom.value && round.year <= yearTo.value), ...rounds];
  }
  return rounds;
});
const selectedSubjects = computed(() => subjectsForScope(selectedCatalog.value, curriculum.value));
const selectedItems = computed(() => questionItems(selectedCatalog.value, yearFrom.value, yearTo.value, curriculum.value));
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
  localStorage.setItem('modern-cbt-qualification', key);
  curriculum.value = 'all-mapped';
  setDefaultYears(quickPreset.value);
  void nextTick(() => {
    animate('.qualification-card', { opacity: [0.65, 1], y: [5, 0] }, { duration: 0.25, delay: stagger(0.035) });
  });
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

function leaveSession(): void {
  if (session.value && !session.value.finished && answeredCount.value > 0) {
    if (!confirm('현재 풀이를 종료하고 홈으로 돌아갈까요?')) return;
  }
  stopTimer();
  session.value = null;
  examResult.value = null;
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

function subjectQuestionCount(subject: string): number {
  return selectedItems.value.filter((item) => item.subject === subject).length;
}

function roundProgress(round: Round): number {
  const ids = round.questions.map((question) => questionId(round, question));
  const answered = ids.filter((id) => studyStore.attempts[id]).length;
  return ids.length ? Math.round((answered / ids.length) * 100) : 0;
}

watch([yearFrom, yearTo], () => {
  if (yearFrom.value > yearTo.value) [yearFrom.value, yearTo.value] = [yearTo.value, yearFrom.value];
});

onMounted(async () => {
  applyTheme(theme.value);
  setDefaultYears(10);
  await hydrateIndexedDb();
  await nextTick();
  animate('.qualification-card', { opacity: [0, 1], y: [12, 0] }, { duration: 0.38, delay: stagger(0.055) });
});

onBeforeUnmount(() => {
  stopTimer();
  window.clearTimeout(toastHandle);
});
</script>

<template>
  <div v-if="!session" class="app-frame">
    <aside class="sidebar" :class="{ open: mobileMenuOpen }">
      <button class="brand" type="button" @click="openView('home')">
        <span>CBT</span>
        <div><strong>산업기사 CBT</strong><small>SMART STUDY</small></div>
      </button>
      <nav>
        <button :class="{ active: view === 'home' }" @click="openView('home')"><span>⌂</span>홈</button>
        <button :class="{ active: view === 'rounds' }" @click="openView('rounds')"><span>▤</span>회차별 문제</button>
        <button :class="{ active: view === 'stats' }" @click="openView('stats')"><span>▥</span>학습 통계</button>
        <a href="index.html"><span>◫</span>기존 CBT</a>
      </nav>
      <div class="sidebar-foot">
        <button type="button" @click="openCalculator"><span>▦</span>공학용 계산기</button>
        <button type="button" @click="changeTheme"><span>◐</span>화면 테마</button>
        <a href="admin.html"><span>⚙</span>관리자</a>
      </div>
    </aside>
    <button v-if="mobileMenuOpen" class="mobile-backdrop" aria-label="메뉴 닫기" @click="mobileMenuOpen = false" />

    <main class="main-area">
      <header class="topbar">
        <button class="menu-button" type="button" @click="mobileMenuOpen = true">☰ <span>메뉴</span></button>
        <div>
          <strong>{{ view === 'home' ? '학습 홈' : view === 'rounds' ? '회차별 문제' : '학습 통계' }}</strong>
          <span>{{ selectedCatalog.name }}</span>
        </div>
        <div class="top-actions">
          <button type="button" @click="openCalculator">▦ <span>계산기</span></button>
          <button type="button" @click="changeTheme">◐ <span>{{ theme === 'system' ? '자동' : theme === 'dark' ? '어둡게' : '밝게' }}</span></button>
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
              <div><span>선택 범위</span><strong>{{ yearFrom }}~{{ yearTo }}년</strong><small>{{ visibleRounds.length }}회차 사용</small></div>
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
            <div><span>PAST EXAMS</span><h1>{{ selectedCatalog.name }} 기출문제</h1><p>{{ yearFrom }}~{{ yearTo }}년 · {{ visibleRounds.length }}회차</p></div>
            <button type="button" @click="openView('home')">← 학습 설정으로</button>
          </section>
          <div class="round-grid">
            <article v-for="round in visibleRounds" :key="round.id" class="round-card">
              <header><span>{{ round.year }}년</span><b>{{ round.session || '기출' }}</b></header>
              <h2>{{ round.title }}</h2>
              <div class="round-subjects"><span v-for="subject in round.subjects" :key="subject">{{ subject }}</span></div>
              <div class="round-progress">
                <span><i :style="{ width: `${roundProgress(round)}%` }" /></span><b>{{ roundProgress(round) }}%</b>
              </div>
              <footer>
                <button type="button" @click="startRound(round, 'learn')">학습모드</button>
                <button type="button" @click="startRound(round, 'exam')">시험모드</button>
              </footer>
            </article>
          </div>
        </template>

        <template v-else>
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
        </template>
      </div>
    </main>
  </div>

  <div v-else class="session-shell" :class="{ 'exam-mode': session.mode === 'exam', 'sheet-closed': !examSheetOpen }">
    <header class="session-topbar">
      <button class="back-button" type="button" @click="leaveSession">← <span>뒤로가기</span></button>
      <div><span>{{ session.mode === 'exam' ? 'CBT EXAM' : 'LEARNING MODE' }}</span><strong>{{ sessionTitle }}</strong></div>
      <div class="session-tools">
        <button type="button" @click="openCalculator">▦ 계산기</button>
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
            @choose="chooseAnswer(item, $event)"
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
          <button type="button" @click="leaveSession">홈으로</button>
        </div>
      </section>
    </div>
  </div>

  <Transition name="toast">
    <div v-if="toastMessage" class="toast-message">{{ toastMessage }}</div>
  </Transition>
</template>
