(function () {
  'use strict';

  const DATASETS = [
    window.CBT_DATA_HVAC,
    window.CBT_DATA_SAFETY,
    window.CBT_DATA_ENERGY,
    window.CBT_DATA_ENERGY_ENGINEER,
    window.CBT_DATA_MAINTENANCE,
    ...(Array.isArray(window.CBT_DATA_JEWELRY) ? window.CBT_DATA_JEWELRY : [])
  ].filter(Boolean);
  const PRIMARY_KEYS = ['hvac', 'safety', 'energy', 'maintenance'];
  const JEWELRY_KEYS = ['gem-appraiser', 'gem-processing', 'precious-industrial', 'precious-craftsman', 'precious-master'];
  const JEWELRY_TARGET_SUBJECTS = ['보석 특성', '보석 감별', '다이아몬드 감정', '보석 가공'];
  const CATALOG = DATASETS.filter((item) => PRIMARY_KEYS.includes(item.key) || JEWELRY_KEYS.includes(item.key));
  const ROUNDS = CATALOG.flatMap((item) => item.rounds || []).sort((a, b) => String(b.sortKey || b.date || '').localeCompare(String(a.sortKey || a.date || '')));
  const STORAGE_KEY = 'unified-industrial-cbt-v1';
  const THEME_KEY = 'unified-cbt-theme';
  const DAY_MS = 24 * 60 * 60 * 1000;
  const REVIEW_DAYS = [1, 3, 7];
  const RECURRING_STOP_PHRASES = ['다음', '보기', '설명으로', '설명 중', '대한', '관한', '가장', '옳은', '틀린', '아닌', '해당하는', '해당하지 않는', '해당되지 않는', '것은', '어느 것', '무엇인가'];
  const CIRCLES = ['①', '②', '③', '④'];
  const CHANGELOG = window.CBT_CHANGELOG || { currentVersion: '', entries: [] };
  const app = document.getElementById('app');
  const toastNode = document.getElementById('toast');

  const defaultStore = () => ({
    theme: 'system', fontScale: 1, bookmarks: [], wrong: {}, attempts: {}, progress: {}, history: [], notes: {},
    questionTimes: {}, studyPlan: null, studyPlans: {}
  });
  let store = loadStore();
  let state = {
    space: 'industrial', view: 'home', qualification: 'all', year: 'all', roundSearch: '', searchQuery: '',
    session: null, result: null, modal: null, examSheetOpen: false, focusSidebarOpen: false, wrongFilter: 'all', updateReady: false
  };
  let timerHandle = null;
  let toastHandle = null;
  let swRegistration = null;
  const recurringCache = new Map();

  function loadStore() {
    try { return Object.assign(defaultStore(), JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {}); }
    catch (error) { return defaultStore(); }
  }
  function saveStore() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
    catch (error) { toast('저장 공간이 부족합니다. 오래된 기록을 정리해 주세요.'); }
  }
  function esc(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function getRound(id) { return ROUNDS.find((round) => round.id === id); }
  function getCatalog(key) { return CATALOG.find((item) => item.key === key); }
  function activeKeys() { return state.space === 'jewelry' ? JEWELRY_KEYS : PRIMARY_KEYS; }
  function spaceVersion(scope = state.space) {
    return CHANGELOG.versions?.[scope] || CHANGELOG.entries?.find((entry) => (entry.scope || 'industrial') === scope)?.version || CHANGELOG.currentVersion || '-';
  }
  function activeCatalogs() { const keys = activeKeys(); return CATALOG.filter((item) => keys.includes(item.key) && item.rounds?.length); }
  function activeRounds() { const keys = activeKeys(); return ROUNDS.filter((round) => keys.includes(round.qualificationKey)); }
  function isActiveRound(round) { return !!round && activeKeys().includes(round.qualificationKey); }
  function currentStudyPlan() {
    return store.studyPlans?.[state.space] || (state.space === 'industrial' ? store.studyPlan : null);
  }
  function questionId(round, question) { return `${question._originRoundId || round.id}:${question._originalNumber || question.number}`; }
  function findQuestion(id) {
    const split = id.lastIndexOf(':');
    if (split < 0) return null;
    const round = getRound(id.slice(0, split));
    const number = Number(id.slice(split + 1));
    const question = round?.questions.find((item) => item.number === number);
    return question ? { round, question } : null;
  }
  function subjectFor(round, question) {
    if (question._subject) return question._subject;
    if (question.sourceSubject) return question.sourceSubject;
    const subjects = round.subjects?.length ? round.subjects : ['기타'];
    const size = Math.ceil(round.questions.length / subjects.length);
    return subjects[Math.min(subjects.length - 1, Math.floor((question.number - 1) / size))] || '기타';
  }
  function jewelryTargetSubject(round, question) {
    if (question.targetSubject) return question.targetSubject;
    const source = subjectFor(round, question);
    if (source.includes('다이아몬드')) return '다이아몬드 감정';
    if (source.includes('감별')) return '보석 감별';
    if (source.includes('가공')) return '보석 가공';
    return '보석 특성';
  }
  function isJewelryTargetQuestion(round, question) {
    if (question.targetRelevance) return question.targetRelevance !== 'peripheral';
    return ['gem-appraiser', 'gem-processing'].includes(round.qualificationKey);
  }
  function jewelryTargetItems(subject = 'all') {
    return allQuestionItems().filter(({ round, question }) => isJewelryTargetQuestion(round, question) && (subject === 'all' || jewelryTargetSubject(round, question) === subject));
  }
  function isImagePrimary(round, question) {
    const sourceRound = question._originRoundId ? getRound(question._originRoundId) : round;
    return !!(question.sourceImage && sourceRound?.qualificationKey === 'hvac' && Number(sourceRound.year) >= 2021);
  }
  function formatDate(date) {
    if (!date || date.length < 8) return '';
    return `${date.slice(0, 4)}.${date.slice(4, 6)}.${date.slice(6, 8)}`;
  }
  function formatTime(seconds) {
    const safe = Math.max(0, Math.floor(seconds));
    const h = Math.floor(safe / 3600), m = Math.floor((safe % 3600) / 60), s = safe % 60;
    return h ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  function toast(message) {
    clearTimeout(toastHandle); toastNode.textContent = message; toastNode.classList.add('show');
    toastHandle = setTimeout(() => toastNode.classList.remove('show'), 2300);
  }
  function setTheme(mode) {
    store.theme = mode;
    const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, mode); saveStore();
  }
  function overallStats() {
    const rounds = activeRounds();
    const ids = new Set(rounds.flatMap((round) => round.questions.map((question) => questionId(round, question))));
    const total = rounds.reduce((sum, round) => sum + round.questions.length, 0);
    const answeredIds = [...ids].filter((id) => store.attempts[id]);
    const answered = answeredIds.length;
    const correct = answeredIds.filter((id) => store.attempts[id]?.lastCorrect).length;
    return { total, answered, correct, wrong: [...ids].filter((id) => store.wrong[id]).length, bookmarks: store.bookmarks.filter((id) => ids.has(id)).length,
      notes: [...ids].filter((id) => store.notes[id]?.text?.trim()).length,
      formulas: [...ids].filter((id) => store.notes[id]?.formula && store.notes[id]?.text?.trim()).length,
      accuracy: answered ? Math.round(correct / answered * 100) : 0, coverage: total ? Math.round(answered / total * 100) : 0 };
  }
  function isToday(timestamp) {
    if (!timestamp) return false;
    const date = new Date(timestamp), now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  }
  function dailyStats() {
    const activeIds = new Set(activeRounds().flatMap((round) => round.questions.map((question) => questionId(round, question))));
    const attempts = Object.entries(store.attempts).filter(([id]) => activeIds.has(id)).map(([, attempt]) => attempt);
    const today = attempts.filter((item) => isToday(item.at)).length;
    const days = new Set(attempts.map((item) => {
      const date = new Date(item.at); return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    }));
    let streak = 0, cursor = new Date();
    while (true) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}-${cursor.getDate()}`;
      if (!days.has(key)) break;
      streak++; cursor.setDate(cursor.getDate() - 1);
    }
    return { today, goal: 20, streak, percent: Math.min(100, Math.round(today / 20 * 100)) };
  }
  function allQuestionItems() {
    return activeRounds().flatMap((round) => round.questions.map((question) => ({ round, question })));
  }
  function normalizeRecurringText(question) {
    const source = String(question.text || question.html || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').toLowerCase();
    if (question.sourceImage && source.includes('원문 인식 확인 필요')) return '';
    let text = source.replace(/[0-9]+(?:[.,][0-9]+)*/g, '#');
    RECURRING_STOP_PHRASES.forEach((phrase) => { text = text.replaceAll(phrase, ' '); });
    return text.replace(/[^가-힣a-z#]+/g, '');
  }
  function recurringGrams(text) {
    const grams = new Set();
    for (let index = 0; index < text.length - 2; index++) grams.add(text.slice(index, index + 3));
    return grams;
  }
  function recurringSimilarity(left, right) {
    if (left.text === right.text) return 1;
    const smaller = left.grams.size < right.grams.size ? left.grams : right.grams;
    const larger = smaller === left.grams ? right.grams : left.grams;
    let intersection = 0;
    smaller.forEach((gram) => { if (larger.has(gram)) intersection++; });
    return (2 * intersection) / (left.grams.size + right.grams.size);
  }
  function buildRecurringClusters(qualificationKey) {
    if (recurringCache.has(qualificationKey)) return recurringCache.get(qualificationKey);
    const catalog = getCatalog(qualificationKey);
    if (!catalog) return [];
    const records = catalog.rounds.flatMap((round) => round.questions.map((question) => {
      const text = normalizeRecurringText(question);
      return text.length >= 8 ? { round, question, text, grams: recurringGrams(text) } : null;
    })).filter(Boolean);
    const documentFrequency = new Map();
    records.forEach((record) => record.grams.forEach((gram) => documentFrequency.set(gram, (documentFrequency.get(gram) || 0) + 1)));
    const clusters = [];
    const inverted = new Map();
    records.forEach((record) => {
      const rareGrams = [...record.grams].sort((a, b) => (documentFrequency.get(a) || 0) - (documentFrequency.get(b) || 0)).slice(0, 24);
      const candidates = new Map();
      rareGrams.forEach((gram) => (inverted.get(gram) || []).forEach((index) => candidates.set(index, (candidates.get(index) || 0) + 1)));
      let bestIndex = -1;
      let bestScore = 0;
      [...candidates.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([index, shared]) => {
        if (shared < 2) return;
        const score = recurringSimilarity(record, clusters[index].representative);
        if (score > bestScore) { bestIndex = index; bestScore = score; }
      });
      const threshold = record.text.length < 15 ? 0.78 : 0.66;
      if (bestIndex >= 0 && bestScore >= threshold) {
        clusters[bestIndex].items.push({ round: record.round, question: record.question });
      } else {
        const index = clusters.length;
        clusters.push({ representative: record, items: [{ round: record.round, question: record.question }] });
        rareGrams.forEach((gram) => {
          if (!inverted.has(gram)) inverted.set(gram, []);
          inverted.get(gram).push(index);
        });
      }
    });
    const recurring = clusters.filter((cluster) => cluster.items.length >= 2)
      .sort((a, b) => b.items.length - a.items.length)
      .map((cluster, index) => ({
        id: index,
        count: cluster.items.length,
        label: cluster.representative.question.text,
        subject: subjectFor(cluster.representative.round, cluster.representative.question),
        items: cluster.items
      }));
    recurringCache.set(qualificationKey, recurring);
    return recurring;
  }
  function numericAnswerRate(question) {
    const raw = String(question.answerRate ?? '').replace('%', '').trim();
    const rate = raw ? Number(raw) : NaN;
    return Number.isFinite(rate) && rate > 0 && rate <= 100 ? rate : null;
  }
  function recordAttempt(round, question, correct, selected) {
    const id = questionId(round, question);
    const previous = store.attempts[id] || {};
    const now = Date.now();
    const reviewStage = correct && previous.lastCorrect ? Math.min((previous.reviewStage || 0) + 1, REVIEW_DAYS.length - 1) : 0;
    store.attempts[id] = {
      count: (previous.count || 0) + 1,
      correctCount: (previous.correctCount || 0) + (correct ? 1 : 0),
      wrongCount: (previous.wrongCount || 0) + (correct ? 0 : 1),
      lastCorrect: correct,
      at: now,
      reviewStage,
      nextReviewAt: now + REVIEW_DAYS[reviewStage] * DAY_MS
    };
    if (correct) delete store.wrong[id];
    else store.wrong[id] = { at: now, selected, count: store.attempts[id].wrongCount };
  }
  function dueReviewItems() {
    const now = Date.now();
    return Object.entries(store.attempts).map(([id, attempt]) => ({ id, item: findQuestion(id), attempt }))
      .filter(({ id, item, attempt }) => item && isActiveRound(item.round) && ((attempt.nextReviewAt > 0 && attempt.nextReviewAt <= now) || (store.wrong[id] && !attempt.nextReviewAt)))
      .sort((a, b) => (a.attempt.nextReviewAt || 0) - (b.attempt.nextReviewAt || 0))
      .map(({ item }) => item);
  }
  function frequentWrongItems(limit = 20) {
    return Object.entries(store.attempts).map(([id, attempt]) => ({ item: findQuestion(id), wrongCount: attempt.wrongCount || (store.wrong[id] ? 1 : 0) }))
      .filter(({ item, wrongCount }) => item && isActiveRound(item.round) && wrongCount > 0)
      .sort((a, b) => b.wrongCount - a.wrongCount)
      .slice(0, limit)
      .map(({ item }) => item);
  }
  function recordQuestionTime(round, question, elapsedMs) {
    const id = questionId(round, question);
    const previous = store.questionTimes[id] || {};
    const safe = clamp(Math.round(elapsedMs), 1000, 30 * 60 * 1000);
    store.questionTimes[id] = { totalMs: (previous.totalMs || 0) + safe, count: (previous.count || 0) + 1, lastMs: safe, at: Date.now() };
  }
  function slowQuestionItems(limit = 20) {
    return Object.entries(store.questionTimes || {}).map(([id, timing]) => {
      const item = findQuestion(id);
      const averageMs = timing.count ? timing.totalMs / timing.count : 0;
      return item ? { ...item, averageMs, count: timing.count } : null;
    }).filter((item) => item && isActiveRound(item.round) && item.averageMs > 0).sort((a, b) => b.averageMs - a.averageMs).slice(0, limit);
  }
  function formatDuration(ms) {
    const seconds = Math.max(0, Math.round(ms / 1000));
    return seconds >= 60 ? `${Math.floor(seconds / 60)}분 ${seconds % 60}초` : `${seconds}초`;
  }
  function localDateValue(date = new Date()) {
    const year = date.getFullYear(), month = String(date.getMonth() + 1).padStart(2, '0'), day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  function studyPlanStats(plan = currentStudyPlan()) {
    if (!plan?.qualification || !plan?.examDate) return null;
    const catalog = getCatalog(plan.qualification);
    const exam = new Date(`${plan.examDate}T00:00:00`);
    if (!catalog || Number.isNaN(exam.getTime())) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dDay = Math.ceil((exam - today) / DAY_MS);
    const days = Math.max(1, dDay);
    const items = catalog.rounds.flatMap((round) => round.questions.map((question) => ({ round, question })));
    const remainingItems = items.filter(({ round, question }) => !store.attempts[questionId(round, question)]);
    return { ...plan, catalog, dDay, days, total: items.length, remaining: remainingItems.length, dailyTarget: remainingItems.length ? Math.ceil(remainingItems.length / days) : 0, remainingItems };
  }
  function wrongHistoryItems() {
    const ids = new Set([
      ...Object.keys(store.wrong),
      ...Object.entries(store.attempts).filter(([, attempt]) => Number(attempt.wrongCount) > 0).map(([id]) => id)
    ]);
    return [...ids].map((id) => {
      const item = findQuestion(id);
      return item ? { ...item, id, wrongCount: store.attempts[id]?.wrongCount || store.wrong[id]?.count || 1, active: !!store.wrong[id] } : null;
    }).filter((item) => item && isActiveRound(item.round)).sort((a, b) => b.wrongCount - a.wrongCount || (store.attempts[b.id]?.at || 0) - (store.attempts[a.id]?.at || 0));
  }
  function subjectPerformance() {
    const groups = new Map();
    activeCatalogs().forEach((catalog) => {
      catalog.rounds.forEach((round) => round.questions.forEach((question) => {
        const subject = subjectFor(round, question);
        const key = `${catalog.key}::${subject}`;
        const row = groups.get(key) || { key: catalog.key, qualification: catalog.name, subject, total: 0, answered: 0, correct: 0, wrongCount: 0 };
        const attempt = store.attempts[questionId(round, question)];
        row.total++;
        if (attempt) {
          row.answered++;
          if (attempt.lastCorrect) row.correct++;
          row.wrongCount += attempt.wrongCount || 0;
        }
        groups.set(key, row);
      }));
    });
    return [...groups.values()].map((row) => ({ ...row, accuracy: row.answered ? Math.round(row.correct / row.answered * 100) : null }))
      .sort((a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101) || b.answered - a.answered);
  }
  function reviewScheduleStats() {
    const counts = [0, 0, 0];
    Object.entries(store.attempts).forEach(([id, attempt]) => {
      const item = findQuestion(id);
      if (!item || !isActiveRound(item.round)) return;
      if (attempt.nextReviewAt) counts[clamp(Number(attempt.reviewStage) || 0, 0, 2)]++;
    });
    return counts;
  }
  function shuffled(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  }
  function latestProgressRound() {
    return Object.entries(store.progress).sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0)).map(([id]) => getRound(id)).find(isActiveRound) || null;
  }

  function navButton(view, icon, label) {
    const active = state.view === view || (view === 'rounds' && ['session', 'result'].includes(state.view));
    return `<button class="nav-button" data-action="nav" data-view="${view}" ${active ? 'aria-current="page"' : ''}><span>${icon}</span><span>${label}</span></button>`;
  }
  function shell(content, title, subtitle) {
    const stats = overallStats();
    const focused = !!state.session;
    const jewelry = state.space === 'jewelry';
    app.innerHTML = `<div class="app-shell ${jewelry ? 'space-jewelry' : 'space-industrial'} ${focused ? `session-shell ${state.focusSidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}` : ''}">
      <aside class="sidebar">
        <button class="brand" data-action="nav" data-view="home"><span class="brand-mark">${jewelry ? 'GEM' : 'CBT'}</span><span><strong>${jewelry ? '보석·귀금속 학습관' : '산업기사 통합 CBT'}</strong><small>${jewelry ? 'JEWELRY STUDY' : 'OFFLINE STUDY'}</small></span></button>
        <nav class="side-nav">
          ${navButton('home', '⌂', '첫 화면')}${navButton('rounds', '▤', '기출 회차')}${navButton('wrong', '!', '오답·북마크')}${navButton('search', '⌕', '문제 검색')}${navButton('stats', '▥', '학습 통계')}${navButton('updates', '◷', '패치노트')}
        </nav>
        <button class="space-switch" data-action="switch-space" data-space="${jewelry ? 'industrial' : 'jewelry'}"><span>${jewelry ? 'CBT' : '◇'}</span><strong>${jewelry ? '산업기사 CBT로' : '보석·귀금속 학습관'}</strong><small>${jewelry ? '기존 4종목으로 돌아가기' : '별도 문제 공간 열기'}</small></button>
        <div class="side-foot"><span>전체 학습 범위</span><strong>${stats.coverage}% 완료</strong></div>
      </aside>
      <main class="main">
        <header class="topbar">${focused ? `<button class="session-back-button" data-action="leave-session" aria-label="회차 목록으로 돌아가기">←</button><button class="session-menu-toggle" data-action="toggle-session-sidebar" aria-label="메뉴 열기 또는 닫기">${state.focusSidebarOpen ? '×' : '☰'}</button>` : ''}<div class="topbar-copy"><strong>${esc(title)}</strong><span>${esc(subtitle || '원하는 종목과 회차를 선택하세요.')}</span></div><div class="top-actions"><button class="icon-button space-icon-button" data-action="switch-space" data-space="${jewelry ? 'industrial' : 'jewelry'}" title="${jewelry ? '산업기사 CBT로 돌아가기' : '보석·귀금속 학습관'}">${jewelry ? 'CBT' : '◇'}</button><button class="icon-button" data-action="open-search" title="검색">⌕</button><button class="icon-button" data-action="open-settings" title="설정">⚙</button></div></header>
        <section class="content">${content}</section>
      </main>
      <nav class="mobile-nav">${navButton('home', '⌂', '홈')}${navButton('rounds', '▤', '회차')}${navButton('wrong', '!', '오답')}${navButton('search', '⌕', '검색')}${navButton('stats', '▥', '통계')}${navButton('updates', '◷', '패치')}</nav>
      ${focused && state.focusSidebarOpen ? '<button class="session-sidebar-backdrop" data-action="toggle-session-sidebar" aria-label="메뉴 닫기"></button>' : ''}
    </div>${renderModal()}`;
    bindFocusable();
  }

  function renderHome() {
    state.view = 'home';
    if (state.space === 'jewelry') return renderJewelryHome();
    const stats = overallStats();
    const daily = dailyStats();
    const recentRound = latestProgressRound();
    const cards = CATALOG.filter((item) => PRIMARY_KEYS.includes(item.key)).map((item) => {
      const questions = item.rounds.reduce((sum, round) => sum + round.questions.length, 0);
      const colors = { hvac: 'blue', safety: 'orange', energy: 'green', maintenance: 'purple' };
      return `<button class="qualification-card ${colors[item.key]}" data-action="select-qualification" data-key="${item.key}">
        <span class="qualification-icon">${item.key === 'hvac' ? '❄' : item.key === 'safety' ? '⛑' : item.key === 'maintenance' ? '⚙' : '♨'}</span>
        <span class="qualification-copy"><strong>${esc(item.name)}</strong><small>${item.rounds.length}회차 · ${questions.toLocaleString()}문제</small></span><span class="card-arrow">›</span>
      </button>`;
    }).join('');
    const recent = store.history.slice(0, 5).map((item) => `<li><span>${esc(item.title)}</span><strong>${item.score}점</strong><small>${new Date(item.at).toLocaleDateString('ko-KR')}</small></li>`).join('') || '<li class="empty-row">아직 완료한 시험이 없습니다.</li>';
    shell(`<div class="hero"><span class="hero-orb orb-one"></span><span class="hero-orb orb-two"></span><span class="hero-mesh"></span><div class="hero-copy"><span class="eyebrow">SMART RESPONSIVE CBT</span><h1>한곳에서 풀고,<br><em>약점만 다시 공부하세요.</em></h1><p>화면 크기에 맞춰 자동으로 재배치되고, 학습 기록은 이 기기에 안전하게 저장됩니다.</p><div class="hero-actions"><button class="primary-button glow-button" data-action="nav" data-view="rounds">회차 골라서 시작</button><button class="secondary-button" data-action="open-random">랜덤 문제</button></div></div><div class="hero-score"><span>현재 정답률</span><strong>${stats.accuracy}<small>%</small></strong><div><span>푼 문제 ${stats.answered.toLocaleString()}</span><span>오답 ${stats.wrong.toLocaleString()}</span></div></div></div>
      <section class="home-update-bar ${state.updateReady ? 'ready' : ''}"><div><span>${state.updateReady ? '새 업데이트 준비됨' : `현재 버전 v${esc(spaceVersion('industrial'))}`}</span><strong>${state.updateReady ? '풀이 기록을 유지한 채 최신 버전을 적용할 수 있습니다.' : '오래 켜둔 화면도 다시 돌아오면 업데이트를 자동 확인합니다.'}</strong></div><button data-action="force-refresh">${state.updateReady ? '업데이트 적용' : '최신 상태 확인'}</button></section>
      <section class="smart-strip"><article class="daily-card"><div class="daily-ring" style="--daily:${daily.percent * 3.6}deg"><div><strong>${daily.today}</strong><span>/ ${daily.goal}</span></div></div><div><span class="smart-kicker">TODAY</span><h3>오늘의 학습 목표</h3><p>${daily.today >= daily.goal ? '오늘 목표를 달성했습니다. 대단해요!' : `${daily.goal - daily.today}문제만 더 풀면 오늘 목표 달성!`}</p></div></article><button class="smart-action violet" data-action="start-daily"><span>✦</span><div><strong>오늘의 20문제</strong><small>아직 안 푼 문제 중심 출제</small></div><b>›</b></button><button class="smart-action coral" data-action="start-weak"><span>◎</span><div><strong>약점 집중 훈련</strong><small>오답 우선 맞춤 복습</small></div><b>›</b></button>${recentRound ? `<button class="smart-action mint" data-action="continue-round" data-round="${recentRound.id}"><span>↗</span><div><strong>이어서 학습</strong><small>${esc(recentRound.shortQualification)} · ${recentRound.year}년</small></div><b>›</b></button>` : `<button class="smart-action mint" data-action="nav" data-view="rounds"><span>↗</span><div><strong>첫 학습 시작</strong><small>원하는 회차를 골라보세요</small></div><b>›</b></button>`}</section>
      <section class="section-block"><div class="section-heading"><div><span>QUALIFICATIONS</span><h2>종목 선택</h2></div></div><div class="qualification-grid">${cards}</div></section>
      <section class="dashboard-grid"><article class="panel"><div class="panel-heading"><h3>학습 현황</h3><button data-action="nav" data-view="stats">자세히</button></div><div class="metric-grid"><div><span>전체 문제</span><strong>${stats.total.toLocaleString()}</strong></div><div><span>학습 문제</span><strong>${stats.answered.toLocaleString()}</strong></div><div><span>북마크</span><strong>${stats.bookmarks.toLocaleString()}</strong></div><div><span>학습 범위</span><strong>${stats.coverage}%</strong></div></div></article><article class="panel"><div class="panel-heading"><h3>최근 시험</h3></div><ul class="history-list">${recent}</ul></article></section>
      <aside class="streak-banner"><span>🔥</span><div><strong>${daily.streak}일 연속 학습 중</strong><small>매일 한 문제라도 풀면 연속 기록이 이어집니다.</small></div><div class="streak-dots">${Array.from({length:7},(_,i)=>`<i class="${i < Math.min(7,daily.streak) ? 'on' : ''}"></i>`).join('')}</div></aside>`, '산업기사 통합 CBT', '공조냉동 · 산업안전 · 에너지관리 · 설비보전');
    const dueCount = dueReviewItems().length;
    const frequentCount = frequentWrongItems(20).length;
    const slowCount = slowQuestionItems(20).length;
    const plan = studyPlanStats();
    document.querySelector('.smart-strip')?.insertAdjacentHTML('afterend', `<section class="training-panel">
      <div class="training-panel-head"><div><span>ADAPTIVE STUDY</span><h2>맞춤 훈련</h2></div><button data-action="nav" data-view="stats">학습 분석 보기</button></div>
      <div class="training-grid">
        <button class="training-featured" data-action="open-recurring"><strong>전회차 빈출·유사문제</strong><small>${activeRounds().length}회차 · ${stats.total.toLocaleString()}문항을 개념별로 묶어 다시 풀기</small><b>분류해서 풀기 ›</b></button>
        <button data-action="open-difficulty"><strong>고난도 문제</strong><small>COMCBT 정답률 기준 선택</small><b>설정 ›</b></button>
        <button data-action="start-due"><strong>오늘의 자동 복습</strong><small>1일·3일·7일 간격</small><b>${dueCount}문제</b></button>
        <button data-action="start-frequent"><strong>자주 틀린 20문제</strong><small>누적 오답 횟수 우선</small><b>${frequentCount}문제</b></button>
        <button data-action="nav" data-view="wrong"><strong>오답 단계별 분류</strong><small>1회·2회·3회 이상</small><b>${stats.wrong}문제</b></button>
        <button data-action="nav" data-view="stats"><strong>과목별 취약도</strong><small>정답률과 누적 오답 분석</small><b>분석 ›</b></button>
        <button data-action="nav" data-view="wrong"><strong>개인 메모</strong><small>문제마다 자동 저장</small><b>${stats.notes}개</b></button>
        <button data-action="start-slow"><strong>느린 문제 TOP 20</strong><small>학습모드 풀이시간 기준</small><b>${slowCount}문제</b></button>
        <button data-action="${plan ? 'start-plan-daily' : 'open-study-plan'}"><strong>시험일 학습계획</strong><small>${plan ? `${esc(plan.catalog.shortName)} · 하루 ${plan.dailyTarget}문제` : '시험일로 하루 학습량 계산'}</small><b>${plan ? (plan.dDay > 0 ? `D-${plan.dDay}` : plan.dDay === 0 ? 'D-DAY' : '재설정 ›') : '설정 ›'}</b></button>
        <button data-action="nav" data-view="wrong"><strong>공식 노트</strong><small>개인 메모에서 공식만 모아보기</small><b>${stats.formulas}개</b></button>
      </div>
    </section>`);
  }

  function renderJewelryHome() {
    state.view = 'home';
    const stats = overallStats();
    const daily = dailyStats();
    const catalogs = activeCatalogs();
    const recentRound = latestProgressRound();
    const dueCount = dueReviewItems().length;
    const frequentCount = frequentWrongItems(20).length;
    const availableKeys = new Set(catalogs.map((item) => item.key));
    const targetItems = jewelryTargetItems();
    const targetCounts = Object.fromEntries(JEWELRY_TARGET_SUBJECTS.map((subject) => [subject, jewelryTargetItems(subject).length]));
    const sourceRows = [
      { key: 'target-overlap', label: '보석감정산업기사', description: '취득 목표 · 4과목 겹치는 문제', status: '목표', count: `${targetItems.length.toLocaleString()}문제` },
      { key: 'gem-appraiser', label: '보석감정기능사', description: '핵심 서브 · 감정·감별 중심', status: '핵심' },
      { key: 'gem-processing', label: '보석가공기능사', description: '보석 특성·감별·가공 보강', status: '보강' },
      { key: 'precious-industrial', label: '귀금속가공산업기사', description: '전체 수록 · 겹치는 문항 선별', status: '연관' },
      { key: 'precious-craftsman', label: '귀금속가공기능사', description: '전체 수록 · 겹치는 문항 선별', status: '연관' },
      { key: 'precious-master', label: '귀금속가공기능장', description: '기능장 전체에서 겹치는 문항만 수록', status: '연관' }
    ];
    const catalogCards = catalogs.map((item) => {
      const questions = item.rounds.reduce((sum, round) => sum + round.questions.length, 0);
      const role = item.key === 'gem-appraiser' ? '핵심 서브' : item.key === 'gem-processing' ? '보강' : '연관 원문';
      const scope = item.key === 'precious-master' ? '겹치는 문제만' : '전체';
      return `<button class="jewelry-catalog-card" data-action="select-qualification" data-key="${item.key}"><span class="jewel-swatch ${item.key}"></span><span><i>${role}</i><strong>${esc(item.name)}</strong><small>${item.rounds.length}회차 · ${questions.toLocaleString()}문제 ${scope}</small></span><b>›</b></button>`;
    }).join('');
    const sourceStatus = sourceRows.map((row) => {
      const catalog = getCatalog(row.key);
      const available = row.key === 'target-overlap' || availableKeys.has(row.key);
      const count = row.count || (catalog ? `${catalog.rounds.length}회차` : '검증 자료 없음');
      return `<li class="${available ? 'available' : 'reference'}"><span>${esc(row.status)}</span><div><strong>${esc(row.label)}</strong><small>${esc(row.description)}</small></div><b>${esc(count)}</b></li>`;
    }).join('');
    const targetCards = JEWELRY_TARGET_SUBJECTS.map((subject, index) => `<button data-action="start-jewelry-subject" data-subject="${esc(subject)}"><span>${index + 1}과목</span><strong>${esc(subject)}</strong><small>${targetCounts[subject].toLocaleString()}문제 선별</small><b>20문제 풀기 ›</b></button>`).join('');
    const recent = store.history.filter((item) => item.roundId && isActiveRound(getRound(item.roundId))).slice(0, 5)
      .map((item) => `<li><span>${esc(item.title)}</span><strong>${item.score}점</strong><small>${new Date(item.at).toLocaleDateString('ko-KR')}</small></li>`).join('') || '<li class="empty-row">아직 완료한 시험이 없습니다.</li>';
    shell(`<section class="jewelry-hero">
        <div><span>TARGET · 보석감정산업기사</span><h1>보석감정산업기사<br>합격 학습관</h1><p>보석감정기능사를 핵심 서브로 두고, 확보한 연관 기출 전체와 목표 4과목에 겹치는 문항을 분리했습니다.</p><div><button class="jewelry-primary" data-action="start-jewelry-mix">겹치는 문제 20개</button><button class="jewelry-secondary" data-action="start-jewelry-exam">4과목 모의시험</button></div></div>
        <dl><div><dt>전체 문제</dt><dd>${stats.total.toLocaleString()}</dd></div><div><dt>겹치는 문제</dt><dd>${targetItems.length.toLocaleString()}</dd></div><div><dt>현재 정답률</dt><dd>${stats.accuracy}%</dd></div></dl>
      </section>
      <section class="jewelry-notice"><strong>학습 기준</strong><p>목표는 보석감정산업기사, 핵심 서브는 보석감정기능사입니다. 확보한 원문 회차는 모두 보관하고 목표 과목과 겹치는 문항은 별도 카테고리로 제공합니다.</p></section>
      <section class="jewelry-target-section"><div class="section-heading"><div><span>TARGET OVERLAP</span><h2>보석감정산업기사 겹치는 문제</h2></div><button data-action="start-jewelry-exam">과목당 20문제 시험</button></div><div class="jewelry-target-grid">${targetCards}</div></section>
      <section class="jewelry-actions"><button data-action="start-daily"><span>오늘</span><strong>새 문제 20개</strong><small>${daily.today}/${daily.goal}문제 학습</small></button><button data-action="start-due"><span>복습</span><strong>1·3·7일 자동 복습</strong><small>${dueCount}문제 대기</small></button><button data-action="start-frequent"><span>약점</span><strong>자주 틀린 문제</strong><small>${frequentCount}문제 분석</small></button>${recentRound ? `<button data-action="continue-round" data-round="${recentRound.id}"><span>계속</span><strong>${esc(recentRound.shortQualification)}</strong><small>${recentRound.year}년 회차 이어 풀기</small></button>` : '<button data-action="nav" data-view="rounds"><span>시작</span><strong>첫 회차 고르기</strong><small>학습모드·시험모드 지원</small></button>'}</section>
      <section class="jewelry-section"><div class="section-heading"><div><span>FULL ARCHIVE</span><h2>자격증별 전체 문제</h2></div><button data-action="nav" data-view="rounds">전체 회차 보기</button></div><div class="jewelry-catalog-grid">${catalogCards}</div></section>
      <section class="jewelry-dashboard"><article><div class="panel-heading"><h2>연관 자격 구성</h2></div><ul class="jewelry-source-list">${sourceStatus}</ul></article><article><div class="panel-heading"><h2>학습 현황</h2><button data-action="nav" data-view="stats">자세히</button></div><div class="jewelry-metrics"><span>학습 문제<strong>${stats.answered.toLocaleString()}</strong></span><span>오답<strong>${stats.wrong.toLocaleString()}</strong></span><span>북마크<strong>${stats.bookmarks.toLocaleString()}</strong></span><span>진도<strong>${stats.coverage}%</strong></span></div><div class="panel-heading jewelry-history-heading"><h2>최근 시험</h2></div><ul class="history-list">${recent}</ul></article></section>`,
      '보석·귀금속 학습관', '보석감정산업기사 대비 연관 CBT');
  }

  function renderRounds() {
    state.view = 'rounds';
    const rounds = activeRounds();
    const catalogs = activeCatalogs();
    const years = [...new Set(rounds.filter((round) => state.qualification === 'all' || round.qualificationKey === state.qualification).map((round) => round.year))].sort((a, b) => b - a);
    const query = state.roundSearch.trim().toLowerCase();
    const filtered = rounds.filter((round) => (state.qualification === 'all' || round.qualificationKey === state.qualification) && (state.year === 'all' || String(round.year) === String(state.year)) && (!query || `${round.title} ${round.qualification}`.toLowerCase().includes(query)));
    const qualificationOptions = `<option value="all">전체 종목</option>` + catalogs.map((item) => `<option value="${item.key}" ${state.qualification === item.key ? 'selected' : ''}>${esc(item.name)}</option>`).join('');
    shell(`<div class="filter-bar"><label>종목<select data-change="qualification">${qualificationOptions}</select></label><label>연도<select data-change="year"><option value="all">전체 연도</option>${years.map((year) => `<option ${String(state.year) === String(year) ? 'selected' : ''}>${year}</option>`).join('')}</select></label><label class="filter-search">회차 검색<input data-input="round-search" value="${esc(state.roundSearch)}" placeholder="예: 2020년 3회"></label></div>
      <div class="section-heading"><div><span>PAST EXAMS</span><h2>${filtered.length}개 회차</h2></div><button class="secondary-button compact" data-action="open-random">랜덤 출제</button></div>
      <div class="round-grid">${filtered.map(renderRoundCard).join('') || '<div class="empty-state">조건에 맞는 회차가 없습니다.</div>'}</div>`, state.space === 'jewelry' ? '보석·귀금속 기출 회차' : '기출 회차', '학습모드 또는 실제 CBT형 시험모드로 시작할 수 있습니다.');
  }
  function renderRoundCard(round) {
    const progress = store.progress[round.id];
    const count = Object.keys(progress?.answers || {}).length;
    const rate = Math.round(count / round.questions.length * 100);
    const restored = round.qualificationKey === 'hvac' && Number(round.year) >= 2021;
    const validatedRestoration = round.verification === 'validated-restoration';
    const verificationBadge = validatedRestoration
      ? '<span class="restoration-chip">복원 표기 · 문항/보기/정답 검증 완료</span>'
      : round.verification === 'partial-validated'
        ? '<span class="restoration-chip">부분 복원 · 확인된 문제만 수록</span>'
        : round.verification === 'target-filtered'
          ? '<span class="restoration-chip">보석감정산업기사 겹치는 문제만 수록</span>'
          : '';
    return `<article class="round-card"><div class="round-card-top"><span class="qualification-chip ${round.qualificationKey}">${esc(round.shortQualification || round.qualification)}</span><span>${round.year}년</span></div>${restored ? '<span class="restoration-chip">CBT 복원문제 · 원문 이미지</span>' : verificationBadge}<h3>${esc(round.title.replace(/\s*\(정답, 해설\)$/, ''))}</h3><p>${round.questions.length}문제 · ${round.subjects.length}과목 · 시험 ${round.examMinutes || Math.round(round.questions.length * 1.5)}분</p><div class="subject-tags">${round.subjects.map((subject) => `<span>${esc(subject)}</span>`).join('')}</div>${count ? `<div class="card-progress"><span style="width:${rate}%"></span></div><small>${count}/${round.questions.length} 학습 중</small>` : ''}<button class="card-start" data-action="open-mode" data-round="${round.id}">${count ? '이어 풀기' : '시작하기'} <span>›</span></button></article>`;
  }

  function renderWrong() {
    state.view = 'wrong';
    const historyItems = wrongHistoryItems();
    const wrongItems = historyItems.filter((item) => state.wrongFilter === 'all' || (state.wrongFilter === '3' ? item.wrongCount >= 3 : item.wrongCount === Number(state.wrongFilter)));
    const bookmarks = store.bookmarks.map(findQuestion).filter((item) => item && isActiveRound(item.round));
    const noteItems = Object.entries(store.notes || {}).map(([id, note]) => {
      const item = findQuestion(id);
      return item && isActiveRound(item.round) && note?.text?.trim() ? { ...item, id, note: note.text, formula: !!note.formula } : null;
    }).filter(Boolean).sort((a, b) => (store.notes[b.id]?.updatedAt || 0) - (store.notes[a.id]?.updatedAt || 0));
    const formulaItems = noteItems.filter((item) => item.formula);
    const list = (items, type) => items.slice(0, 100).map((item) => {
      const { round, question } = item;
      const id = questionId(round, question);
      const countBadge = type === 'wrong' ? `<b class="wrong-count-badge">${item.wrongCount}회 오답</b>${item.active ? '<i class="review-needed">복습 필요</i>' : '<i class="review-cleared">최근 정답</i>'}` : '';
      const noteText = ['note', 'formula'].includes(type) ? `<p class="mini-note">${esc(item.note)}</p>` : (store.notes[id]?.text?.trim() ? '<i class="memo-badge">메모 있음</i>' : '');
      return `<article class="mini-question"><span>${esc(round.shortQualification)} · ${round.year}년 · ${question.number}번 ${countBadge}</span><strong>${esc(question.text)}</strong>${noteText}<div><button data-action="start-single" data-id="${id}">풀어보기</button>${type === 'bookmark' ? `<button data-action="toggle-bookmark" data-id="${id}">북마크 해제</button>` : ''}${type === 'note' ? `<button data-action="clear-note" data-id="${id}">메모 삭제</button>` : ''}${type === 'formula' ? `<button data-action="remove-formula" data-id="${id}">공식 노트 해제</button>` : ''}</div></article>`;
    }).join('') || '<div class="empty-state">저장된 문제가 없습니다.</div>';
    const filterButton = (value, label) => `<button class="${state.wrongFilter === value ? 'active' : ''}" data-action="set-wrong-filter" data-filter="${value}">${label}</button>`;
    shell(`<div class="wrong-filter-bar"><span>틀린 횟수</span>${filterButton('all', `전체 ${historyItems.length}`)}${filterButton('1', '1회')}${filterButton('2', '2회')}${filterButton('3', '3회 이상')}</div><div class="review-grid"><section class="panel"><div class="panel-heading"><h2>누적 오답 ${wrongItems.length}문제</h2>${wrongItems.length ? '<button data-action="start-filtered-wrong">현재 목록 풀기</button>' : ''}</div><div class="mini-list">${list(wrongItems, 'wrong')}</div></section><section class="panel"><div class="panel-heading"><h2>북마크 ${bookmarks.length}문제</h2>${bookmarks.length ? '<button data-action="start-bookmarks">전체 풀기</button>' : ''}</div><div class="mini-list">${list(bookmarks, 'bookmark')}</div></section><section class="panel note-panel"><div class="panel-heading"><h2>개인 메모 ${noteItems.length}개</h2></div><div class="mini-list">${list(noteItems, 'note')}</div></section><section class="panel"><div class="panel-heading"><h2>공식 노트 ${formulaItems.length}개</h2>${formulaItems.length ? '<button data-action="start-formula-notes">공식 문제 풀기</button>' : ''}</div><div class="mini-list">${list(formulaItems, 'formula')}</div></section></div>`, '오답·북마크·메모', '오답, 북마크, 개인 메모와 공식 노트를 한곳에서 관리합니다.');
  }

  function renderSearch() {
    state.view = 'search';
    const query = state.searchQuery.trim().toLowerCase();
    const results = [];
    if (query.length >= 2) {
      outer: for (const round of activeRounds()) for (const question of round.questions) {
        const text = `${question.text} ${question.choices.map((choice) => choice.text).join(' ')}`.toLowerCase();
        if (text.includes(query)) results.push({ round, question });
        if (results.length >= 150) break outer;
      }
    }
    shell(`<div class="search-hero"><input autofocus data-input="question-search" value="${esc(state.searchQuery)}" placeholder="두 글자 이상 입력하세요"><span>⌕</span></div><p class="search-count">${query.length >= 2 ? `${results.length}${results.length === 150 ? '+' : ''}개 결과` : '문제와 보기의 텍스트를 검색합니다.'}</p><div class="search-results">${results.map(({ round, question }) => `<article><span>${esc(round.shortQualification)} · ${round.year}년 · ${question.number}번</span><strong>${highlight(question.text, query)}</strong><button data-action="start-single" data-id="${questionId(round, question)}">문제 풀기</button></article>`).join('') || (query.length >= 2 ? '<div class="empty-state">검색 결과가 없습니다.</div>' : '')}</div>`, '문제 검색', `${overallStats().total.toLocaleString()}문제에서 필요한 내용을 찾습니다.`);
  }
  function highlight(text, query) {
    const safe = esc(text); if (!query) return safe;
    return safe.replace(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (value) => `<mark>${value}</mark>`);
  }

  function renderStats() {
    state.view = 'stats';
    const stats = overallStats();
    const dueCount = dueReviewItems().length;
    const reviewCounts = reviewScheduleStats();
    const subjectRows = subjectPerformance();
    const weakest = subjectRows.find((row) => row.answered >= 3);
    const timingValues = Object.entries(store.questionTimes || {}).filter(([id]) => {
      const item = findQuestion(id); return item && isActiveRound(item.round);
    }).map(([, timing]) => timing);
    const totalTimingCount = timingValues.reduce((sum, timing) => sum + (timing.count || 0), 0);
    const averageTiming = totalTimingCount ? timingValues.reduce((sum, timing) => sum + (timing.totalMs || 0), 0) / totalTimingCount : 0;
    const slowCount = slowQuestionItems(20).length;
    const plan = studyPlanStats();
    const rows = activeCatalogs().map((item) => {
      const ids = item.rounds.flatMap((round) => round.questions.map((question) => questionId(round, question)));
      const answered = ids.filter((id) => store.attempts[id]).length;
      const correct = ids.filter((id) => store.attempts[id]?.lastCorrect).length;
      return `<tr><th>${esc(item.name)}</th><td>${ids.length.toLocaleString()}</td><td>${answered.toLocaleString()}</td><td>${answered ? Math.round(correct / answered * 100) : 0}%</td></tr>`;
    }).join('');
    const subjectTable = subjectRows.map((row) => `<tr class="${row.answered >= 3 && row.accuracy < 60 ? 'weak-row' : ''}"><th><span>${esc(row.qualification)}</span><strong>${esc(row.subject)}</strong></th><td>${row.answered}/${row.total}</td><td>${row.accuracy == null ? '-' : `${row.accuracy}%`}</td><td>${row.wrongCount}회</td><td><button data-action="start-subject-weak" data-key="${row.key}" data-subject="${esc(row.subject)}" ${row.answered ? '' : 'disabled'}>집중 학습</button></td></tr>`).join('');
    shell(`<div class="stat-cards"><article><span>학습한 문제</span><strong>${stats.answered.toLocaleString()}</strong><small>/ ${stats.total.toLocaleString()}</small></article><article><span>정답률</span><strong>${stats.accuracy}%</strong><small>${stats.correct.toLocaleString()}문제 정답</small></article><article><span>오늘 복습</span><strong>${dueCount.toLocaleString()}</strong><small>최대 20문제 출제</small></article><article><span>개인 메모</span><strong>${stats.notes.toLocaleString()}</strong><small>브라우저 자동 저장</small></article></div>
      <div class="stats-layout"><article class="panel"><div class="panel-heading"><h2>종목별 학습 현황</h2></div><div class="table-wrap"><table><thead><tr><th>종목</th><th>전체</th><th>학습</th><th>정답률</th></tr></thead><tbody>${rows}</tbody></table></div></article>
      <article class="panel review-schedule"><div class="panel-heading"><h2>1·3·7일 복습 일정</h2><button data-action="start-due">오늘 복습 시작</button></div><div><span><b>1일</b><strong>${reviewCounts[0]}</strong><small>기초 복습</small></span><span><b>3일</b><strong>${reviewCounts[1]}</strong><small>정착 복습</small></span><span><b>7일</b><strong>${reviewCounts[2]}</strong><small>장기 복습</small></span></div><p>문제를 풀 때마다 다음 복습일이 자동으로 잡힙니다.</p></article></div>
      <article class="panel subject-analysis"><div class="panel-heading"><div><h2>과목별 정답률·취약도</h2><p>${weakest ? `현재 취약 과목은 ${esc(weakest.qualification)} · ${esc(weakest.subject)} (${weakest.accuracy}%)입니다.` : '과목별로 3문제 이상 풀면 취약 과목을 분석합니다.'}</p></div><button data-action="start-frequent">자주 틀린 20문제</button></div><div class="table-wrap"><table><thead><tr><th>과목</th><th>학습</th><th>정답률</th><th>누적 오답</th><th></th></tr></thead><tbody>${subjectTable}</tbody></table></div></article>
      <div class="stats-layout insight-panels"><article class="panel"><div class="panel-heading"><h2>문제별 풀이시간</h2><button data-action="start-slow">느린 문제 풀기</button></div><div class="insight-metrics"><span>측정 문제<strong>${timingValues.length}</strong></span><span>평균 풀이시간<strong>${averageTiming ? formatDuration(averageTiming) : '-'}</strong></span><span>느린 문제 시험<strong>${slowCount}문제</strong></span></div><p class="panel-note">학습모드에서 문제를 처음 선택할 때까지의 시간을 기준으로 기록합니다.</p></article><article class="panel"><div class="panel-heading"><h2>시험일 학습계획</h2><button data-action="open-study-plan">${plan ? '계획 수정' : '계획 설정'}</button></div>${plan ? `<div class="plan-summary"><strong>${esc(plan.catalog.name)}</strong><span>${esc(plan.examDate)} · ${plan.dDay > 0 ? `D-${plan.dDay}` : plan.dDay === 0 ? 'D-DAY' : '시험일 지남'}</span><b>남은 ${plan.remaining.toLocaleString()}문제 · 하루 ${plan.dailyTarget.toLocaleString()}문제</b><button data-action="start-plan-daily">오늘 계획 풀기</button></div>` : '<div class="empty-state compact-empty">시험일을 설정하면 남은 문제를 날짜별로 자동 배분합니다.</div>'}</article></div>`, '학습 통계', '이 브라우저에 저장된 학습 기록입니다.');
  }

  function renderUpdates() {
    state.view = 'updates';
    const scope = state.space === 'jewelry' ? 'jewelry' : 'industrial';
    const entries = (CHANGELOG.entries || []).filter((entry) => (entry.scope || 'industrial') === scope);
    const latest = entries[0];
    const currentVersion = CHANGELOG.versions?.[scope] || latest?.version || CHANGELOG.currentVersion || '-';
    const jewelry = scope === 'jewelry';
    const cards = entries.map((entry, index) => `<article class="patch-card ${index === 0 ? 'latest' : ''}">
      <div class="patch-card-head"><div><span class="patch-version">v${esc(entry.version)}</span>${index === 0 ? '<span class="patch-latest">최신 버전</span>' : ''}</div><time datetime="${esc(entry.date.replaceAll('.', '-'))}">${esc(entry.date)}</time></div>
      <h2>${esc(entry.title)}</h2>
      <p>${esc(entry.summary)}</p>
      <div class="patch-tags">${(entry.tags || []).map((tag) => `<span>${esc(tag)}</span>`).join('')}</div>
      <ul>${(entry.changes || []).map((change) => `<li>${esc(change)}</li>`).join('')}</ul>
    </article>`).join('') || '<div class="empty-state">등록된 패치노트가 없습니다.</div>';
    shell(`<section class="patch-hero"><div><span>${jewelry ? 'JEWELRY UPDATE HISTORY' : 'UPDATE HISTORY'}</span><h1>${jewelry ? '보석 학습관의<br>업데이트 기록' : '더 편한 학습을 위한<br>업데이트 기록'}</h1><p>${jewelry ? '보석감정산업기사 대비 자료와 학습 기능의 변경 내역만 모았습니다.' : '문제·정답·화면 기능이 어떻게 바뀌었는지 버전별로 확인할 수 있습니다.'}</p></div><div class="patch-current"><span>현재 버전</span><strong>v${esc(currentVersion)}</strong><small>${latest ? `${esc(latest.date)} 업데이트` : '업데이트 준비 중'}</small></div></section><div class="patch-list">${cards}</div>`, jewelry ? '보석관 패치노트' : '패치노트', jewelry ? '보석관 전용 추가 기능과 수정 내역입니다.' : '산업기사 CBT의 버전별 추가 기능과 수정 내역입니다.');
  }

  function renderModal() {
    if (!state.modal) return '';
    if (state.modal.type === 'mode') {
      const round = getRound(state.modal.roundId);
      if (!round) return '';
      return `<div class="modal-backdrop" data-action="close-modal"><div class="modal" role="dialog"><button class="modal-close" data-action="close-modal">×</button><span class="modal-kicker">${esc(round.shortQualification)}</span><h2>${esc(round.title.replace(/\s*\(정답, 해설\)$/, ''))}</h2><p>${round.questions.length}문제 · ${round.subjects.length}과목</p><div class="mode-grid"><button data-action="start-mode" data-mode="learn" data-round="${round.id}"><span>학습모드</span><strong>여러 문제씩 풀이</strong><small>정답과 해설을 바로 확인하고, 풀이 화면에서 표시 개수를 바꿀 수 있습니다.</small></button><button data-action="start-mode" data-mode="exam" data-round="${round.id}"><span>시험모드</span><strong>실제 CBT 형식</strong><small>2열 문제지와 OMR 답안지, 타이머를 사용해 실전처럼 풉니다.</small></button></div></div></div>`;
    }
    if (state.modal.type === 'recurring') {
      const key = state.modal.qualification;
      const minimum = Number(state.modal.minimum || 2);
      const clusters = buildRecurringClusters(key);
      const filtered = clusters.filter((cluster) => cluster.count >= minimum);
      const covered = new Set(filtered.flatMap((cluster) => cluster.items.map(({ round, question }) => questionId(round, question)))).size;
      const groupButtons = filtered.slice(0, 15).map((cluster) => `<button class="recurring-group" data-action="start-recurring-group" data-key="${key}" data-cluster="${cluster.id}"><span><b>${cluster.count}회</b>${esc(cluster.subject)}</span><strong>${esc(cluster.label)}</strong><small>이 유형의 유사문제 ${cluster.count}문제 모두 풀기</small></button>`).join('') || '<div class="empty-state">선택한 출제 횟수에 해당하는 유형이 없습니다.</div>';
      return `<div class="modal-backdrop" data-action="close-modal"><div class="modal recurring-modal" role="dialog"><button class="modal-close" data-action="close-modal">×</button><span class="modal-kicker">전회차 유사도 분석</span><h2>빈출·유사문제 분류</h2><p>숫자와 표현이 달라도 핵심 문장이 비슷한 문제를 같은 유형으로 묶었습니다.</p><div class="recurring-controls"><label class="setting-row">종목<select data-change="recurring-qualification">${activeCatalogs().map((item) => `<option value="${item.key}" ${key === item.key ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label><label class="setting-row">최소 출제 횟수<select data-change="recurring-minimum"><option value="2" ${minimum === 2 ? 'selected' : ''}>2회 이상</option><option value="3" ${minimum === 3 ? 'selected' : ''}>3회 이상</option><option value="5" ${minimum === 5 ? 'selected' : ''}>5회 이상</option></select></label><label class="setting-row">종합시험 문제 수<select id="recurringCount"><option>10</option><option selected>20</option><option>40</option></select></label></div><div class="recurring-summary"><span>분류된 유형<strong>${filtered.length.toLocaleString()}개</strong></span><span>포함 문제<strong>${covered.toLocaleString()}문제</strong></span><button class="primary-button" data-action="start-recurring-mix" data-key="${key}" data-minimum="${minimum}">빈출 종합시험 시작</button></div><div class="recurring-list">${groupButtons}</div></div></div>`;
    }
    if (state.modal.type === 'difficulty') {
      const options = activeCatalogs().map((item) => {
        const count = item.rounds.reduce((sum, round) => sum + round.questions.filter((question) => numericAnswerRate(question) != null).length, 0);
        return `<option value="${item.key}" ${count ? '' : 'disabled'}>${esc(item.name)}${count ? '' : ' · 정답률 자료 없음'}</option>`;
      }).join('');
      return `<div class="modal-backdrop" data-action="close-modal"><div class="modal small-modal"><button class="modal-close" data-action="close-modal">×</button><span class="modal-kicker">COMCBT 정답률 기준</span><h2>고난도 문제만 풀기</h2><label class="setting-row">종목<select id="difficultyQualification"><option value="all">전체 종목</option>${options}</select></label><label class="setting-row">최대 정답률<select id="difficultyRate"><option value="30">30% 이하</option><option value="40" selected>40% 이하</option><option value="50">50% 이하</option></select></label><label class="setting-row">문제 수<select id="difficultyCount"><option value="10">10문제</option><option value="20" selected>20문제</option><option value="40">40문제</option></select></label><p class="setting-note">원문에 COMCBT 정답률이 있는 문제만 출제합니다.</p><button class="primary-button wide" data-action="start-hard">고난도 학습 시작</button></div></div>`;
    }
    if (state.modal.type === 'study-plan') {
      const plan = currentStudyPlan() || {};
      const suggested = new Date(); suggested.setDate(suggested.getDate() + 30);
      const selectedKey = plan.qualification || (activeKeys().includes(state.qualification) ? state.qualification : activeCatalogs()[0]?.key);
      return `<div class="modal-backdrop" data-action="close-modal"><div class="modal small-modal"><button class="modal-close" data-action="close-modal">×</button><span class="modal-kicker">DAILY STUDY PLAN</span><h2>시험일 학습계획</h2><p>시험일까지 남은 미학습 문제를 날짜별로 자동 배분합니다.</p><label class="setting-row">종목<select id="studyPlanQualification">${activeCatalogs().map((item) => `<option value="${item.key}" ${selectedKey === item.key ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label><label class="setting-row">시험일<input id="studyPlanDate" type="date" min="${localDateValue()}" value="${esc(plan.examDate || localDateValue(suggested))}"></label><button class="primary-button wide" data-action="save-study-plan">학습계획 저장</button>${currentStudyPlan() ? '<button class="secondary-button wide modal-secondary" data-action="clear-study-plan">계획 삭제</button>' : ''}</div></div>`;
    }
    if (state.modal.type === 'settings') {
      return `<div class="modal-backdrop" data-action="close-modal"><div class="modal small-modal"><button class="modal-close" data-action="close-modal">×</button><h2>화면·데이터 설정</h2><label class="setting-row">화면 테마<select data-change="theme"><option value="system">기기 설정</option><option value="light">밝게</option><option value="dark">어둡게</option></select></label><label class="setting-row">글자 크기<input type="range" min="0.9" max="1.25" step="0.05" value="${store.fontScale}" data-change="font-scale"></label><div class="backup-actions"><button data-action="export-backup">학습 기록 백업</button><button data-action="choose-backup">백업 파일 복원</button><input id="backupFile" type="file" accept="application/json,.json" data-change="import-backup" hidden></div><p class="setting-note">오답, 메모, 풀이시간, 시험계획과 통계를 JSON 파일로 백업합니다. 학습 기록은 서버로 전송되지 않습니다.</p><button class="danger-button" data-action="reset-progress">학습 기록 초기화</button></div></div>`;
    }
    if (state.modal.type === 'random') {
      return `<div class="modal-backdrop" data-action="close-modal"><div class="modal small-modal"><button class="modal-close" data-action="close-modal">×</button><h2>랜덤 문제</h2><label class="setting-row">종목<select id="randomQualification">${activeCatalogs().map((item, index) => `<option value="${item.key}" ${state.qualification === item.key || (state.qualification === 'all' && index === 0) ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label><label class="setting-row">문제 수<select id="randomCount"><option>10</option><option>20</option><option>40</option><option>60</option><option>80</option><option>100</option></select></label><button class="primary-button wide" data-action="start-random">학습 시작</button></div></div>`;
    }
    return '';
  }

  function startRound(roundId, mode) {
    const round = getRound(roundId); if (!round) return;
    clearInterval(timerHandle);
    const saved = mode === 'learn' ? store.progress[round.id] : null;
    const duration = (round.examMinutes || Math.round(round.questions.length * 1.5)) * 60;
    const savedPageSize = Number(saved?.pageSize);
    const subject = mode === 'learn' && round.subjects.includes(saved?.subject) ? saved.subject : 'all';
    const questions = subject === 'all' ? round.questions : round.questions.filter((question) => subjectFor(round, question) === subject);
    const savedAnswers = saved?.answers || {};
    state.session = { round, allQuestions: round.questions, questions, subject, mode, answers: savedAnswers, revealed: saved?.revealed || {}, review: {}, page: saved?.page || 0, pageSize: [2, 4, 6, 10, 20, 40, questions.length].includes(savedPageSize) ? savedPageSize : 4, duration, remaining: duration, startedAt: Date.now(), questionStartedAt: {}, timedQuestions: Object.fromEntries(Object.keys(savedAnswers).map((number) => [number, true])) };
    state.modal = null; state.result = null; state.examSheetOpen = false; state.focusSidebarOpen = false; state.view = 'session';
    if (mode === 'exam') startTimer();
    renderSession();
  }
  function startCollection(items, title, mode = 'learn', useTargetSubjects = false) {
    if (!items.length) return toast('풀 문제가 없습니다.');
    const questions = items.map(({ round, question }, index) => Object.assign({}, question, {
      number: index + 1,
      _originalNumber: question.number,
      _originRoundId: round.id,
      _subject: useTargetSubjects ? jewelryTargetSubject(round, question) : `${round.shortQualification} · ${subjectFor(round, question)}`
    }));
    const round = { id: `collection-${Date.now()}`, title, qualification: '맞춤 학습', shortQualification: '맞춤', qualificationKey: 'collection', year: '', subjects: [...new Set(questions.map((question) => question._subject))], questions, examMinutes: Math.max(10, Math.round(questions.length * 1.5)) };
    const duration = round.examMinutes * 60;
    state.session = { round, questions, mode, answers: {}, revealed: {}, review: {}, page: 0, pageSize: 4, duration, remaining: duration, startedAt: Date.now(), questionStartedAt: {}, timedQuestions: {}, transient: true };
    state.modal = null; state.focusSidebarOpen = false; state.view = 'session';
    if (mode === 'exam') startTimer();
    renderSession();
  }
  function startTimer() {
    clearInterval(timerHandle);
    timerHandle = setInterval(() => {
      if (!state.session || state.session.mode !== 'exam') return clearInterval(timerHandle);
      state.session.remaining = Math.max(0, state.session.remaining - 1);
      document.querySelectorAll('[data-timer]').forEach((node) => node.textContent = formatTime(state.session.remaining));
      document.querySelectorAll('[data-elapsed]').forEach((node) => node.textContent = formatTime(state.session.duration - state.session.remaining));
      if (state.session.remaining === 0) finishSession(true);
    }, 1000);
  }

  function renderSession() {
    if (!state.session) return renderRounds();
    state.session.mode === 'exam' ? renderExamSession() : renderLearningSession();
  }
  function renderLearningSession() {
    const s = state.session;
    const pages = Math.max(1, Math.ceil(s.questions.length / s.pageSize));
    s.page = clamp(s.page, 0, pages - 1);
    const start = s.page * s.pageSize;
    const visible = s.questions.slice(start, start + s.pageSize);
    const visibleAt = Date.now();
    visible.forEach((question) => {
      if (!s.timedQuestions[question.number] && !s.questionStartedAt[question.number]) s.questionStartedAt[question.number] = visibleAt;
    });
    const answered = s.questions.filter((question) => s.answers[question.number] != null).length;
    shell(`<div class="session-head"><div><span>학습모드</span><h2>${esc(s.round.title)}</h2></div><div class="session-status"><strong><b data-learning-done>${answered}</b>/${s.questions.length}</strong><span>답변 완료</span></div></div>
      <div class="learning-toolbar"><label>한 화면 문제 수<select data-change="session-page-size">${[2, 4, 6, 10, 20, 40].map((size) => `<option value="${size}" ${s.pageSize === size ? 'selected' : ''}>${size}문제</option>`).join('')}<option value="${s.questions.length}" ${s.pageSize === s.questions.length ? 'selected' : ''}>전체</option></select></label><span>넓은 화면에서는 한 줄에 2문제씩 표시됩니다.</span><div class="learning-toolbar-actions"><button data-action="open-jump">문제 번호로 이동</button><button class="learning-reset-button" data-action="reset-learning-session">현재 풀이 초기화</button></div></div>
      <div class="learning-list">${visible.map((question) => renderLearningItem(question)).join('')}</div>
      <div class="pagination"><button data-action="session-prev" ${s.page === 0 ? 'disabled' : ''}>‹ 이전</button><span>${s.page + 1} / ${pages}</span><button data-action="session-next" ${s.page >= pages - 1 ? 'disabled' : ''}>다음 ›</button></div>
      <div class="learning-finish"><button class="primary-button" data-action="finish-session">학습 결과 보기</button></div>`, '문제 풀이', `${s.round.shortQualification || ''} · 학습모드`);
    if (!s.transient && s.round.subjects.length > 1) {
      const options = [`<option value="all" ${s.subject === 'all' ? 'selected' : ''}>전체 과목 (${s.allQuestions.length}문제)</option>`]
        .concat(s.round.subjects.map((subject, index) => {
          const count = s.allQuestions.filter((question) => subjectFor(s.round, question) === subject).length;
          return `<option value="${esc(subject)}" ${s.subject === subject ? 'selected' : ''}>${index + 1}과목 · ${esc(subject)} (${count}문제)</option>`;
        })).join('');
      document.querySelector('.learning-toolbar')?.insertAdjacentHTML('afterbegin', `<label class="learning-subject-select">학습 과목<select data-change="learning-subject">${options}</select></label>`);
    }
    saveLearningProgress();
  }
  function renderSubjectDivider(round, question, className) {
    const subject = subjectFor(round, question);
    const subjectIndex = Math.max(0, round.subjects.indexOf(subject));
    return `<div class="${className}"><span>${subjectIndex + 1}과목</span><strong>${esc(subject)}</strong><small>${question.number}번부터</small></div>`;
  }
  function renderLearningItem(question) {
    const s = state.session;
    const index = s.questions.indexOf(question);
    const previous = index > 0 ? s.questions[index - 1] : null;
    const showSubject = !s.transient && (!previous || subjectFor(s.round, previous) !== subjectFor(s.round, question));
    return `${showSubject ? renderSubjectDivider(s.round, question, 'subject-divider') : ''}${renderLearningQuestion(question)}`;
  }
  function renderLearningQuestion(question) {
    const s = state.session, id = questionId(s.round, question), selected = s.answers[question.number], revealed = !!s.revealed[question.number], bookmarked = store.bookmarks.includes(id);
    const note = store.notes?.[id]?.text || '';
    const formula = !!store.notes?.[id]?.formula;
    const imagePrimary = isImagePrimary(s.round, question);
    const prompt = imagePrimary
      ? `<div class="image-question-label"><strong>${question.number}번</strong><span>CBT 복원문제 · 원문 이미지</span></div><img class="source-question-main" src="${esc(question.sourceImage)}" alt="${question.number}번 복원문제 원문" loading="lazy">`
      : `<h3><span>${question.number}.</span> ${question.html || esc(question.text)}</h3>${renderImages(question.images, '문제 이미지')}`;
    return `<article class="question-card ${imagePrimary ? 'image-primary' : ''}" id="question-${question.number}"><div class="question-meta"><span>${esc(subjectFor(s.round, question))}</span><button class="bookmark-button ${bookmarked ? 'active' : ''}" data-action="toggle-bookmark" data-id="${id}" title="북마크">★</button></div>${prompt}
      <div class="choice-list ${imagePrimary ? 'image-answer-list' : ''}">${question.choices.map((choice, index) => { const n = index + 1, cls = revealed ? (n === selected ? (n === question.answer ? 'correct' : 'wrong') : '') : n === selected ? 'selected' : ''; return `<button class="choice ${cls}" data-action="answer" data-number="${question.number}" data-choice="${n}"><span>${CIRCLES[index]}</span><span>${imagePrimary ? `${n}번 선택` : (choice.html || esc(choice.text))}</span>${imagePrimary ? '' : renderImages(choice.images, '보기 이미지')}</button>`; }).join('')}</div>
      <div class="question-feedback">${revealed ? renderExplanation(question, selected) : '<p class="answer-guide">보기를 선택하면 정답과 해설이 표시됩니다.</p>'}</div>
      ${question.sourceImage && !imagePrimary ? `<details class="source-details"><summary>원문 이미지 확인</summary><img src="${esc(question.sourceImage)}" alt="${question.number}번 원문" loading="lazy"></details>` : ''}
      <details class="question-note" ${note || formula ? 'open' : ''}><summary>개인 메모${note ? ' · 저장됨' : ''}</summary><textarea data-input="question-note" data-id="${id}" placeholder="공식, 풀이 요령, 헷갈린 내용을 적어두세요.">${esc(note)}</textarea><label class="formula-toggle"><input type="checkbox" data-change="formula-note" data-id="${id}" ${formula ? 'checked' : ''}> 공식 노트에 추가</label><small>입력 내용은 이 브라우저에 자동 저장됩니다.</small></details></article>`;
  }
  function renderExplanation(question, selected) {
    const rate = numericAnswerRate(question);
    const rateBadge = rate == null ? '' : `<div class="answer-rate-badge"><span>COMCBT 정답률</span><strong>${rate}%</strong><small>${rate < 40 ? '고난도' : rate < 65 ? '보통' : '기본'}</small></div>`;
    const correct = selected === question.answer;
    if (!correct) return '<div class="explanation wrong retry-explanation"><strong>오답입니다 · 다시 골라보세요</strong><p>정답을 직접 찾으면 해설이 열립니다.</p></div>' + rateBadge;
    const explanationBadge = question.explanationType === 'ai-reference' ? '<span class="ai-explanation-badge">AI 참고 해설 · 쉽게 풀어보기</span>' : '';
    const explanation = question.explanationHtml || (question.explanation ? esc(question.explanation).replaceAll('\n', '<br>') : '등록된 해설이 없습니다. 정답과 보기를 비교해 복습하세요.');
    return `<div class="explanation correct"><strong>정답입니다</strong>${explanationBadge}<p>${explanation}</p>${question.hint ? `<small>힌트: ${esc(question.hint)}</small>` : ''}</div>${rateBadge}`;
  }
  function renderImages(images, alt) {
    return (images || []).length ? `<div class="question-images">${images.map((src) => `<img src="${esc(src)}" alt="${alt}" loading="lazy">`).join('')}</div>` : '';
  }

  function renderExamSession() {
    const s = state.session;
    const answered = Object.keys(s.answers).length, remaining = s.questions.length - answered;
    app.innerHTML = `<div class="exam-app">
      <header class="exam-top"><div class="exam-wide exam-top-inner"><button class="exam-exit" data-action="leave-session" aria-label="회차 목록으로 돌아가기" title="뒤로가기">←</button><div class="exam-title"><strong>${esc(s.round.title.replace(/\s*\(정답, 해설\)$/, ''))}</strong><span>${esc(s.round.shortQualification)} · CBT 시험모드</span></div><div class="exam-time"><strong data-timer>${formatTime(s.remaining)}</strong><span>경과 <b data-elapsed>${formatTime(s.duration - s.remaining)}</b> · 미응답 <b data-exam-left>${remaining}</b></span></div></div></header>
      <nav class="exam-subject-bar"><div class="exam-wide exam-subjects-in">${s.round.subjects.map((subject, index) => { const first = s.questions.find((question) => subjectFor(s.round, question) === subject); return `<button data-action="jump-subject" data-number="${first?.number || 1}"><b>${index + 1}</b>${esc(subject)}</button>`; }).join('')}<button class="exam-sheet-top" data-action="toggle-exam-sheet">OMR 답안지</button></div></nav>
      <div class="exam-wide exam-body"><main class="exam-question-grid">${s.questions.map((question) => renderExamQuestion(question)).join('')}</main>${renderAnswerSheet()}</div>
      <footer class="exam-footer"><div class="exam-wide exam-grade-inner"><span>응답 <b data-exam-done>${answered}</b> / ${s.questions.length} · 미응답 <b data-exam-left>${remaining}</b></span><button class="sheet-mobile-button" data-action="toggle-exam-sheet">OMR</button><button class="grade-button" data-action="finish-session">채점하기</button></div></footer>
      <button class="sheet-backdrop ${state.examSheetOpen ? 'open' : ''}" data-action="toggle-exam-sheet" aria-label="답안지 닫기"></button>
    </div>`;
  }
  function renderExamQuestion(question) {
    const s = state.session, selected = s.answers[question.number], held = !!s.review[question.number];
    const imagePrimary = isImagePrimary(s.round, question);
    const previous = s.questions[question.number - 2];
    const showSubject = !previous || subjectFor(s.round, previous) !== subjectFor(s.round, question);
    const prompt = imagePrimary
      ? `<div class="exam-image-label"><strong>${question.number}번</strong><span>CBT 복원 원문</span></div><img class="exam-source-question" src="${esc(question.sourceImage)}" alt="${question.number}번 복원문제 원문" loading="lazy">`
      : `<div class="exam-question-head"><h2><span>${question.number}.</span> ${question.html || esc(question.text)}</h2><button data-action="toggle-review" data-number="${question.number}" title="보류 표시">${held ? '★ 보류' : '☆ 보류'}</button></div>${renderImages(question.images, '문제 이미지')}`;
    return `${showSubject ? renderSubjectDivider(s.round, question, 'exam-section-title') : ''}<article class="exam-question ${held ? 'held' : ''} ${imagePrimary ? 'image-primary' : ''}" id="exam-question-${question.number}">${prompt}${imagePrimary ? `<button class="exam-image-hold" data-action="toggle-review" data-number="${question.number}" title="보류 표시">${held ? '★ 보류' : '☆ 보류'}</button>` : ''}<div class="exam-choices ${imagePrimary ? 'exam-image-answers' : ''}">${question.choices.map((choice, index) => `<button class="exam-choice ${selected === index + 1 ? 'selected' : ''}" data-action="answer" data-number="${question.number}" data-choice="${index + 1}"><span>${CIRCLES[index]}</span><span>${imagePrimary ? `${index + 1}번 선택` : (choice.html || esc(choice.text))}</span>${imagePrimary ? '' : renderImages(choice.images, '보기 이미지')}</button>`).join('')}</div></article>`;
  }
  function renderAnswerSheet() {
    const s = state.session;
    return `<aside class="answer-sheet ${state.examSheetOpen ? 'open' : ''}"><div class="answer-sheet-head"><h2>답안지 OMR</h2><button data-action="toggle-exam-sheet">×</button></div><div class="answer-sheet-scroll">${s.questions.map((question, index) => `<div class="omr-row ${s.review[question.number] ? 'review' : ''} ${(index + 1) % 5 === 0 ? 'group-end' : ''}" data-number="${question.number}"><button class="omr-number" data-action="jump-question" data-number="${question.number}">${String(question.number).padStart(2, '0')}</button>${CIRCLES.map((circle, i) => `<button class="omr-choice ${s.answers[question.number] === i + 1 ? 'selected' : ''}" data-action="answer" data-number="${question.number}" data-choice="${i + 1}">${circle}</button>`).join('')}</div>`).join('')}</div></aside>`;
  }

  function answerQuestion(number, choice) {
    const s = state.session, question = s.questions.find((item) => item.number === number); if (!question) return;
    s.answers[number] = choice;
    if (s.mode === 'exam') {
      document.querySelectorAll?.(`.exam-choice[data-number="${number}"]`).forEach((node) => node.classList.toggle('selected', Number(node.dataset.choice) === choice));
      document.querySelectorAll?.(`.omr-choice[data-number="${number}"]`).forEach((node) => node.classList.toggle('selected', Number(node.dataset.choice) === choice));
      const answered = Object.keys(s.answers).length;
      document.querySelectorAll?.('[data-exam-done]').forEach((node) => node.textContent = answered);
      document.querySelectorAll?.('[data-exam-left]').forEach((node) => node.textContent = s.questions.length - answered);
      return;
    }
    if (s.mode === 'learn') {
      s.revealed[number] = true;
      const correct = choice === question.answer;
      if (!s.timedQuestions[number]) {
        recordQuestionTime(s.round, question, Date.now() - (s.questionStartedAt[number] || s.startedAt));
        s.timedQuestions[number] = true;
      }
      recordAttempt(s.round, question, correct, choice);
      saveStore(); saveLearningProgress();
      const card = document.getElementById(`question-${number}`);
      if (card) {
        card.querySelectorAll('.choice[data-choice]').forEach((node) => {
          const option = Number(node.dataset.choice);
          node.classList.remove('selected');
          node.classList.toggle('correct', correct && option === question.answer);
          node.classList.toggle('wrong', option === choice && choice !== question.answer);
        });
        const feedback = card.querySelector('.question-feedback');
        if (feedback) feedback.innerHTML = renderExplanation(question, choice);
        const answered = s.questions.filter((item) => s.answers[item.number] != null).length;
        document.querySelectorAll('[data-learning-done]').forEach((node) => node.textContent = answered);
        return;
      }
    }
    renderSession();
  }
  function saveLearningProgress() {
    const s = state.session; if (!s || s.mode !== 'learn' || s.transient) return;
    store.progress[s.round.id] = { answers: s.answers, revealed: s.revealed, subject: s.subject, page: s.page, pageSize: s.pageSize, updatedAt: Date.now() }; saveStore();
  }
  function finishSession(auto) {
    const s = state.session; if (!s) return;
    const unanswered = s.questions.filter((question) => s.answers[question.number] == null).length;
    if (!auto && s.mode === 'exam' && unanswered && !confirm(`${unanswered}문제가 미응답입니다. 지금 채점할까요?`)) return;
    clearInterval(timerHandle);
    let correct = 0;
    const subjectMap = {};
    s.questions.forEach((question) => {
      const selected = s.answers[question.number], isCorrect = selected === question.answer, subject = subjectFor(s.round, question);
      if (isCorrect) correct++;
      subjectMap[subject] ||= { correct: 0, total: 0 }; subjectMap[subject].total++; if (isCorrect) subjectMap[subject].correct++;
      if (selected) {
        if (s.mode === 'exam') recordAttempt(s.round, question, isCorrect, selected);
      }
    });
    const score = Math.round(correct / s.questions.length * 100);
    state.result = { score, correct, total: s.questions.length, unanswered, subjects: subjectMap, title: s.round.title, answers: Object.assign({}, s.answers), questions: s.questions, round: s.round, mode: s.mode };
    store.history.unshift({ roundId: s.round.id, title: s.round.title, score, correct, total: s.questions.length, at: Date.now() }); store.history = store.history.slice(0, 50); saveStore();
    state.session = null; state.view = 'result'; renderResult();
  }
  function renderResult() {
    const r = state.result; if (!r) return renderHome();
    const hasSubjectFailure = Object.values(r.subjects).some((value) => (value.correct / value.total * 100) < 40);
    const passed = r.score >= 60 && !hasSubjectFailure;
    const celebration = passed ? `<div class="celebration" aria-hidden="true">${Array.from({ length: 22 }, (_, index) => `<i style="--i:${index};--x:${(index * 47) % 100}%;--dx:${(index - 11) * 3}px;--d:${(index % 7) * .12}s"></i>`).join('')}</div>` : '';
    const subjectRows = Object.entries(r.subjects).map(([name, value]) => `<li><span>${esc(name)}</span><strong>${value.correct}/${value.total}</strong><b>${Math.round(value.correct / value.total * 100)}%</b></li>`).join('');
    const wrongCards = r.questions.filter((q) => r.answers[q.number] !== q.answer).slice(0, 30).map((q) => `<article><span>${q.number}번 · 정답 ${CIRCLES[q.answer - 1]}</span><strong>${esc(q.text)}</strong></article>`).join('') || '<div class="empty-state">모든 문제를 맞혔습니다.</div>';
    shell(`${celebration}<div class="result-hero ${passed ? 'pass' : ''}"><span>${r.mode === 'exam' ? '시험 결과' : '학습 결과'}</span><strong>${r.score}<small>점</small></strong><h2>${passed ? '합격 기준을 넘었습니다' : hasSubjectFailure ? '과목별 40점 미만 과락이 있습니다' : '오답을 복습해 보세요'}</h2><p>${r.correct}문제 정답 · ${r.total - r.correct - r.unanswered}문제 오답 · ${r.unanswered}문제 미응답</p><div><button class="primary-button" data-action="retry-result">다시 풀기</button><button class="secondary-button" data-action="nav" data-view="rounds">회차 목록</button></div></div><div class="result-grid"><article class="panel"><div class="panel-heading"><h3>과목별 결과</h3></div><ul class="subject-result">${subjectRows}</ul></article><article class="panel"><div class="panel-heading"><h3>틀린 문제</h3><button data-action="nav" data-view="wrong">오답노트</button></div><div class="result-wrongs">${wrongCards}</div></article></div>`, '채점 결과', r.title);
  }

  function jumpQuestion(number) {
    const s = state.session; if (!s) return;
    if (s.mode === 'exam') {
      state.examSheetOpen = false;
      document.querySelector?.('.answer-sheet')?.classList.remove('open');
      document.querySelector?.('.sheet-backdrop')?.classList.remove('open');
      requestAnimationFrame(() => document.getElementById(`exam-question-${number}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
      return;
    }
    const index = s.questions.findIndex((question) => question.number === number);
    if (index < 0) return;
    s.page = Math.floor(index / s.pageSize); renderSession();
    requestAnimationFrame(() => document.getElementById(`question-${number}`)?.scrollIntoView({ block: 'start' }));
  }
  function renderJumpModal() {
    const s = state.session; if (!s) return;
    const input = prompt(`이동할 문제 번호를 입력하세요. (1~${s.questions.length})`);
    if (input && Number(input) >= 1 && Number(input) <= s.questions.length) jumpQuestion(Number(input));
  }
  function bindFocusable() { document.documentElement.style.setProperty('--font-scale', store.fontScale || 1); }
  async function forceRefresh() {
    if (!navigator.onLine) {
      toast('인터넷 연결 후 최신 버전을 적용할 수 있습니다.');
      return;
    }
    toast('최신 파일을 다시 받는 중입니다.');
    try {
      const registrations = await navigator.serviceWorker?.getRegistrations?.() || [];
      await Promise.all(registrations.map((registration) => registration.unregister()));
      const keys = 'caches' in window ? await caches.keys() : [];
      await Promise.all(keys.filter((key) => key.startsWith('unified-industrial-cbt-')).map((key) => caches.delete(key)));
    } catch (error) {}
    const url = new URL(location.href);
    url.searchParams.set('refresh', Date.now());
    location.replace(url.toString());
  }
  function markUpdateReady() {
    if (state.updateReady) return;
    state.updateReady = true;
    if (state.session) {
      toast('새 버전이 준비됐습니다. 풀이를 마친 뒤 메인에서 적용할 수 있습니다.');
      return;
    }
    if (state.view === 'home') renderHome();
    else toast('새 버전이 준비됐습니다. 메인 화면에서 적용할 수 있습니다.');
  }
  function checkForUpdates() {
    if (!swRegistration || !navigator.onLine) return;
    swRegistration.update().then(() => {
      if (swRegistration.waiting) markUpdateReady();
    }).catch(() => {});
  }
  function exportBackup() {
    const payload = { app: 'industrial-cbt', version: CHANGELOG.currentVersion, exportedAt: new Date().toISOString(), store };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `industrial-cbt-backup-${localDateValue()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('학습 기록 백업 파일을 저장했습니다.');
  }
  async function importBackup(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = parsed?.store || parsed;
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw new Error('invalid');
      if (!confirm('현재 브라우저의 학습 기록을 백업 파일 내용으로 교체할까요?')) return;
      const restored = Object.assign(defaultStore(), incoming);
      restored.bookmarks = Array.isArray(restored.bookmarks) ? restored.bookmarks : [];
      restored.history = Array.isArray(restored.history) ? restored.history : [];
      ['wrong', 'attempts', 'progress', 'notes', 'questionTimes'].forEach((key) => {
        if (!restored[key] || typeof restored[key] !== 'object' || Array.isArray(restored[key])) restored[key] = {};
      });
      store = restored;
      state.session = null; state.modal = null; state.view = 'home';
      setTheme(store.theme || 'system');
      saveStore();
      renderHome();
      toast('학습 기록을 복원했습니다.');
    } catch (error) {
      toast('올바른 CBT 백업 파일이 아닙니다.');
    }
  }

  function actionHandler(event) {
    const button = event.target.closest('[data-action]'); if (!button) return;
    // A backdrop is an ancestor of the dialog as well. Only treat a click on
    // the backdrop itself as a request to close; inner controls must keep working.
    if (button.dataset.action === 'close-modal' && button.classList?.contains('modal-backdrop') && event.target !== button) return;
    const action = button.dataset.action;
    if (action === 'nav') { state.modal = null; state.view = button.dataset.view; route(); }
    else if (action === 'switch-space') {
      if (state.session?.mode === 'exam' && !confirm('현재 시험을 종료하고 다른 학습관으로 이동할까요?')) return;
      clearInterval(timerHandle);
      state.space = button.dataset.space === 'jewelry' ? 'jewelry' : 'industrial';
      state.view = 'home'; state.qualification = 'all'; state.year = 'all'; state.roundSearch = ''; state.searchQuery = '';
      state.session = null; state.result = null; state.modal = null; state.wrongFilter = 'all';
      renderHome(); scrollTo(0, 0);
    }
    else if (action === 'toggle-session-sidebar') { state.focusSidebarOpen = !state.focusSidebarOpen; renderSession(); }
    else if (action === 'select-qualification') { state.qualification = button.dataset.key; state.year = 'all'; renderRounds(); }
    else if (action === 'open-mode') { state.modal = { type: 'mode', roundId: button.dataset.round }; route(); }
    else if (action === 'start-mode') startRound(button.dataset.round, button.dataset.mode);
    else if (action === 'close-modal') { state.modal = null; route(); }
    else if (action === 'open-settings') { state.modal = { type: 'settings' }; route(); }
    else if (action === 'export-backup') exportBackup();
    else if (action === 'choose-backup') document.getElementById('backupFile')?.click();
    else if (action === 'open-search') { state.view = 'search'; state.modal = null; renderSearch(); }
    else if (action === 'open-random') { state.modal = { type: 'random' }; route(); }
    else if (action === 'open-study-plan') { state.modal = { type: 'study-plan' }; route(); }
    else if (action === 'save-study-plan') {
      const qualification = document.getElementById('studyPlanQualification').value;
      const examDate = document.getElementById('studyPlanDate').value;
      if (!examDate) toast('시험일을 선택하세요.');
      else {
        store.studyPlans ||= {};
        store.studyPlans[state.space] = { qualification, examDate, updatedAt: Date.now() };
        if (state.space === 'industrial') store.studyPlan = store.studyPlans[state.space];
        saveStore(); state.modal = null; renderHome(); toast('시험일 학습계획을 저장했습니다.');
      }
    }
    else if (action === 'clear-study-plan' && confirm('저장된 시험일 학습계획을 삭제할까요?')) {
      store.studyPlans ||= {}; delete store.studyPlans[state.space];
      if (state.space === 'industrial') store.studyPlan = null;
      saveStore(); state.modal = null; renderHome();
    }
    else if (action === 'start-plan-daily') {
      const plan = studyPlanStats();
      if (!plan || !plan.remainingItems.length) toast('계획한 종목의 미학습 문제를 모두 풀었습니다.');
      else startCollection(shuffled(plan.remainingItems).slice(0, Math.min(100, Math.max(1, plan.dailyTarget))), `${plan.catalog.shortName} 오늘의 시험일 계획`);
    }
    else if (action === 'start-slow') {
      const slow = slowQuestionItems(20);
      if (!slow.length) toast('학습모드에서 문제를 풀면 풀이시간 분석이 시작됩니다.');
      else startCollection(slow, '풀이시간이 오래 걸린 문제 TOP 20');
    }
    else if (action === 'open-recurring') {
      state.modal = { type: 'recurring', qualification: activeKeys().includes(state.qualification) ? state.qualification : activeCatalogs()[0]?.key, minimum: 2 };
      route();
    }
    else if (action === 'open-difficulty') { state.modal = { type: 'difficulty' }; route(); }
    else if (action === 'start-recurring-group') {
      const cluster = buildRecurringClusters(button.dataset.key).find((item) => item.id === Number(button.dataset.cluster));
      if (cluster) startCollection(shuffled(cluster.items), `${getCatalog(button.dataset.key).shortName} 빈출 유형 · ${cluster.count}회 출제`);
    }
    else if (action === 'start-recurring-mix') {
      const key = button.dataset.key;
      const minimum = Number(button.dataset.minimum);
      const count = Number(document.getElementById('recurringCount').value);
      const queues = buildRecurringClusters(key).filter((cluster) => cluster.count >= minimum).map((cluster) => shuffled(cluster.items));
      const selected = [];
      const used = new Set();
      while (selected.length < count && queues.some((queue) => queue.length)) {
        queues.forEach((queue) => {
          while (queue.length && selected.length < count) {
            const item = queue.shift();
            const id = questionId(item.round, item.question);
            if (used.has(id)) continue;
            used.add(id);
            selected.push(item);
            break;
          }
        });
      }
      startCollection(selected, `${getCatalog(key).shortName} 전회차 빈출 종합 ${selected.length}문제`);
    }
    else if (action === 'start-hard') {
      const key = document.getElementById('difficultyQualification').value;
      const maxRate = Number(document.getElementById('difficultyRate').value);
      const count = Number(document.getElementById('difficultyCount').value);
      const pool = allQuestionItems().filter(({ round, question }) => (key === 'all' || round.qualificationKey === key) && numericAnswerRate(question) != null && numericAnswerRate(question) <= maxRate);
      startCollection(shuffled(pool).slice(0, count), `정답률 ${maxRate}% 이하 고난도 ${Math.min(count, pool.length)}문제`);
    }
    else if (action === 'start-due') {
      const due = dueReviewItems().slice(0, 20);
      if (!due.length) toast('오늘 복습할 문제가 없습니다. 다음 일정이 되면 자동으로 표시됩니다.');
      else startCollection(due, '1·3·7일 자동 복습');
    }
    else if (action === 'start-frequent') {
      const frequent = frequentWrongItems(20);
      if (!frequent.length) toast('오답 기록이 쌓이면 자주 틀린 문제 시험이 열립니다.');
      else startCollection(frequent, '자주 틀린 문제 TOP 20');
    }
    else if (action === 'start-subject-weak') {
      const pool = allQuestionItems().filter(({ round, question }) => round.qualificationKey === button.dataset.key && subjectFor(round, question) === button.dataset.subject)
        .sort((a, b) => {
          const aAttempt = store.attempts[questionId(a.round, a.question)] || {};
          const bAttempt = store.attempts[questionId(b.round, b.question)] || {};
          return (bAttempt.wrongCount || 0) - (aAttempt.wrongCount || 0) || Number(aAttempt.lastCorrect) - Number(bAttempt.lastCorrect);
        });
      startCollection(pool.slice(0, 20), `${button.dataset.subject} 취약 집중 20문제`);
    }
    else if (action === 'start-daily') {
      const pool = state.space === 'jewelry' ? jewelryTargetItems() : allQuestionItems();
      const unseen = pool.filter(({ round, question }) => !store.attempts[questionId(round, question)]);
      const selected = shuffled(unseen).slice(0, 20);
      if (selected.length < 20) selected.push(...shuffled(pool.filter((item) => !selected.includes(item))).slice(0, 20 - selected.length));
      startCollection(selected, state.space === 'jewelry' ? '보석감정산업기사 오늘의 20문제' : '오늘의 20문제', 'learn', state.space === 'jewelry');
    }
    else if (action === 'start-jewelry-mix') {
      const pool = jewelryTargetItems();
      const unseen = pool.filter(({ round, question }) => !store.attempts[questionId(round, question)]);
      const selected = shuffled(unseen).slice(0, 20);
      if (selected.length < 20) {
        const used = new Set(selected.map(({ round, question }) => questionId(round, question)));
        selected.push(...shuffled(pool.filter(({ round, question }) => !used.has(questionId(round, question)))).slice(0, 20 - selected.length));
      }
      startCollection(selected, '보석감정산업기사 겹치는 20문제', 'learn', true);
    }
    else if (action === 'start-jewelry-subject') {
      const subject = button.dataset.subject;
      const pool = jewelryTargetItems(subject);
      const unseen = pool.filter(({ round, question }) => !store.attempts[questionId(round, question)]);
      const selected = shuffled(unseen).slice(0, 20);
      if (selected.length < 20) {
        const used = new Set(selected.map(({ round, question }) => questionId(round, question)));
        selected.push(...shuffled(pool.filter(({ round, question }) => !used.has(questionId(round, question)))).slice(0, 20 - selected.length));
      }
      startCollection(selected, `보석감정산업기사 · ${subject} 20문제`, 'learn', true);
    }
    else if (action === 'start-jewelry-exam') {
      const selected = JEWELRY_TARGET_SUBJECTS.flatMap((subject) => shuffled(jewelryTargetItems(subject)).slice(0, 20));
      startCollection(selected, `보석감정산업기사 4과목 모의시험 ${selected.length}문제`, 'exam', true);
    }
    else if (action === 'start-weak') {
      const wrong = Object.keys(store.wrong).map(findQuestion).filter((item) => item && isActiveRound(item.round));
      const selected = shuffled(wrong).slice(0, 20);
      if (selected.length < 20) {
        const used = new Set(selected.map(({ round, question }) => questionId(round, question)));
        const fill = shuffled(allQuestionItems().filter(({ round, question }) => !used.has(questionId(round, question)) && !store.attempts[questionId(round, question)]));
        selected.push(...fill.slice(0, 20 - selected.length));
      }
      if (selected.length < 20) {
        const used = new Set(selected.map(({ round, question }) => questionId(round, question)));
        selected.push(...shuffled(allQuestionItems().filter(({ round, question }) => !used.has(questionId(round, question)))).slice(0, 20 - selected.length));
      }
      startCollection(selected, wrong.length ? '약점 집중 훈련' : '기초 진단 20문제');
    }
    else if (action === 'continue-round') startRound(button.dataset.round, 'learn');
    else if (action === 'start-random') {
      const key = document.getElementById('randomQualification').value, count = Number(document.getElementById('randomCount').value);
      const pool = getCatalog(key).rounds.flatMap((round) => round.questions.map((question) => ({ round, question })));
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      startCollection(pool.slice(0, count), `${getCatalog(key).shortName} 랜덤 ${count}문제`);
    }
    else if (action === 'answer') answerQuestion(Number(button.dataset.number), Number(button.dataset.choice));
    else if (action === 'toggle-bookmark') {
      const id = button.dataset.id; store.bookmarks = store.bookmarks.includes(id) ? store.bookmarks.filter((item) => item !== id) : [...store.bookmarks, id]; saveStore(); route();
    }
    else if (action === 'start-wrong') startCollection(Object.keys(store.wrong).map(findQuestion).filter((item) => item && isActiveRound(item.round)), '오답 다시 풀기');
    else if (action === 'start-filtered-wrong') startCollection(wrongHistoryItems().filter((item) => state.wrongFilter === 'all' || (state.wrongFilter === '3' ? item.wrongCount >= 3 : item.wrongCount === Number(state.wrongFilter))), '누적 오답 다시 풀기');
    else if (action === 'set-wrong-filter') { state.wrongFilter = button.dataset.filter; renderWrong(); }
    else if (action === 'start-bookmarks') startCollection(store.bookmarks.map(findQuestion).filter((item) => item && isActiveRound(item.round)), '북마크 다시 풀기');
    else if (action === 'start-formula-notes') startCollection(Object.entries(store.notes || {}).filter(([, note]) => note?.formula && note?.text?.trim()).map(([id]) => findQuestion(id)).filter((item) => item && isActiveRound(item.round)), '공식 노트 문제 복습');
    else if (action === 'start-single') { const item = findQuestion(button.dataset.id); if (item) startCollection([item], '선택 문제 풀이'); }
    else if (action === 'clear-note' && confirm('이 문제의 개인 메모를 삭제할까요?')) { delete store.notes[button.dataset.id]; saveStore(); renderWrong(); }
    else if (action === 'remove-formula') { if (store.notes[button.dataset.id]) store.notes[button.dataset.id].formula = false; saveStore(); renderWrong(); }
    else if (action === 'session-prev') { state.session.page--; renderSession(); scrollTo(0, 0); }
    else if (action === 'session-next') { state.session.page++; renderSession(); scrollTo(0, 0); }
    else if (action === 'reset-learning-session' && state.session?.mode === 'learn' && confirm('현재 회차에서 선택한 답과 진행 위치를 모두 초기화할까요? 오답노트와 북마크는 유지됩니다.')) {
      const s = state.session;
      s.answers = {};
      s.revealed = {};
      s.review = {};
      s.page = 0;
      if (!s.transient) delete store.progress[s.round.id];
      saveStore();
      renderSession();
      scrollTo(0, 0);
      toast('현재 풀이를 처음 상태로 초기화했습니다.');
    }
    else if (action === 'open-jump') renderJumpModal();
    else if (action === 'jump-question') jumpQuestion(Number(button.dataset.number));
    else if (action === 'toggle-review') {
      const n = Number(button.dataset.number), active = !state.session.review[n]; state.session.review[n] = active;
      document.getElementById(`exam-question-${n}`)?.classList.toggle('held', active);
      document.querySelector?.(`.omr-row[data-number="${n}"]`)?.classList.toggle('review', active);
      button.textContent = active ? '★ 보류' : '☆ 보류';
    }
    else if (action === 'jump-subject') jumpQuestion(Number(button.dataset.number));
    else if (action === 'toggle-exam-sheet') {
      state.examSheetOpen = !state.examSheetOpen;
      document.querySelector?.('.answer-sheet')?.classList.toggle('open', state.examSheetOpen);
      document.querySelector?.('.sheet-backdrop')?.classList.toggle('open', state.examSheetOpen);
    }
    else if (action === 'finish-session') finishSession(false);
    else if (action === 'leave-session') { if (state.session?.mode !== 'exam' || confirm('시험을 종료하고 나갈까요? 현재 답안은 저장되지 않습니다.')) { clearInterval(timerHandle); state.session = null; renderRounds(); } }
    else if (action === 'retry-result') { const round = rRound(); if (round) startRound(round.id, state.result.mode); }
    else if (action === 'force-refresh') forceRefresh();
    else if (action === 'reset-progress' && confirm('모든 학습 기록, 오답, 북마크, 메모, 풀이시간과 시험계획을 초기화할까요?')) { store = defaultStore(); saveStore(); state.modal = null; renderHome(); }
  }
  function rRound() { return state.result?.round?.id ? getRound(state.result.round.id) : null; }
  function changeHandler(event) {
    const key = event.target.dataset.change; if (!key) return;
    if (key === 'qualification') { state.qualification = event.target.value; state.year = 'all'; renderRounds(); }
    else if (key === 'year') { state.year = event.target.value; renderRounds(); }
    else if (key === 'theme') { setTheme(event.target.value); route(); }
    else if (key === 'font-scale') { store.fontScale = Number(event.target.value); bindFocusable(); saveStore(); }
    else if (key === 'import-backup') importBackup(event.target.files?.[0]);
    else if (key === 'formula-note') {
      const id = event.target.dataset.id;
      const text = event.target.closest('.question-note')?.querySelector('[data-input="question-note"]')?.value || store.notes[id]?.text || '';
      if (event.target.checked && !text.trim()) {
        event.target.checked = false;
        toast('개인 메모를 먼저 입력한 뒤 공식 노트에 추가하세요.');
      } else {
        store.notes[id] = { ...(store.notes[id] || {}), text, formula: event.target.checked, updatedAt: Date.now() };
        saveStore();
        toast(event.target.checked ? '공식 노트에 추가했습니다.' : '공식 노트에서 해제했습니다.');
      }
    }
    else if (key === 'recurring-qualification') { state.modal.qualification = event.target.value; route(); }
    else if (key === 'recurring-minimum') { state.modal.minimum = Number(event.target.value); route(); }
    else if (key === 'session-page-size') {
      const s = state.session, first = s.page * s.pageSize; s.pageSize = Number(event.target.value); s.page = Math.floor(first / s.pageSize); saveLearningProgress(); renderSession();
    }
    else if (key === 'learning-subject') {
      const s = state.session;
      s.subject = event.target.value;
      s.questions = s.subject === 'all' ? s.allQuestions : s.allQuestions.filter((question) => subjectFor(s.round, question) === s.subject);
      s.page = 0;
      if (s.pageSize > s.questions.length) s.pageSize = s.questions.length;
      saveLearningProgress();
      renderSession();
      scrollTo(0, 0);
    }
    else if (key === 'exam-subject') {
      const s = state.session, index = Number(event.target.value), size = Math.ceil(s.questions.length / s.round.subjects.length); jumpQuestion(index * size + 1);
    }
  }
  function inputHandler(event) {
    const key = event.target.dataset.input; if (!key) return;
    if (key === 'round-search') { state.roundSearch = event.target.value; clearTimeout(event.target._timer); event.target._timer = setTimeout(renderRounds, 160); }
    else if (key === 'question-search') { state.searchQuery = event.target.value; clearTimeout(event.target._timer); event.target._timer = setTimeout(renderSearch, 220); }
    else if (key === 'question-note') {
      const target = event.target, id = target.dataset.id;
      clearTimeout(target._timer);
      target._timer = setTimeout(() => {
        const text = target.value;
        if (text.trim()) store.notes[id] = { ...(store.notes[id] || {}), text, updatedAt: Date.now() };
        else delete store.notes[id];
        saveStore();
      }, 300);
    }
  }
  function route() {
    if (state.session) return renderSession();
    if (state.view === 'home') renderHome(); else if (state.view === 'rounds') renderRounds(); else if (state.view === 'wrong') renderWrong(); else if (state.view === 'search') renderSearch(); else if (state.view === 'stats') renderStats(); else if (state.view === 'updates') renderUpdates(); else if (state.view === 'result') renderResult(); else renderHome();
  }

  app.addEventListener('click', actionHandler);
  app.addEventListener('change', changeHandler);
  app.addEventListener('input', inputHandler);
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (store.theme === 'system') setTheme('system'); });
  setTheme(store.theme || 'system'); bindFocusable(); route();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    let hasControlledPage = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hasControlledPage) {
        hasControlledPage = true;
        return;
      }
      markUpdateReady();
    });
    navigator.serviceWorker.register('sw.js?v=181', { updateViaCache: 'none' })
      .then((registration) => {
        swRegistration = registration;
        if (registration.waiting) markUpdateReady();
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) markUpdateReady();
          });
        });
        checkForUpdates();
        setInterval(checkForUpdates, 10 * 60 * 1000);
      })
      .catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdates();
    });
    window.addEventListener('focus', checkForUpdates);
    window.addEventListener('online', checkForUpdates);
  }
})();
