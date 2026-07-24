(function () {
  'use strict';

  const DATASETS = [
    window.CBT_DATA_HVAC,
    window.CBT_DATA_SAFETY,
    window.CBT_DATA_ENERGY,
    window.CBT_DATA_ENERGY_ENGINEER,
    window.CBT_DATA_MAINTENANCE
  ].filter(Boolean);
  const PRIMARY_KEYS = ['hvac', 'safety', 'energy', 'maintenance'];
  const CATALOG = DATASETS.filter((item) => PRIMARY_KEYS.includes(item.key));
  const ROUNDS = CATALOG.flatMap((item) => item.rounds || []).sort((a, b) => String(b.sortKey || b.date || '').localeCompare(String(a.sortKey || a.date || '')));
  const STORAGE_KEY = 'unified-industrial-cbt-v1';
  const THEME_KEY = 'unified-cbt-theme';
  const CIRCLES = ['①', '②', '③', '④'];
  const app = document.getElementById('app');
  const toastNode = document.getElementById('toast');

  const defaultStore = () => ({
    theme: 'system', fontScale: 1, bookmarks: [], wrong: {}, attempts: {}, progress: {}, history: []
  });
  let store = loadStore();
  let state = {
    view: 'home', qualification: 'all', year: 'all', roundSearch: '', searchQuery: '',
    session: null, result: null, modal: null, examSheetOpen: false, focusSidebarOpen: false
  };
  let timerHandle = null;
  let toastHandle = null;

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
    const subjects = round.subjects?.length ? round.subjects : ['기타'];
    const size = Math.ceil(round.questions.length / subjects.length);
    return subjects[Math.min(subjects.length - 1, Math.floor((question.number - 1) / size))] || '기타';
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
    const rounds = ROUNDS.filter((round) => PRIMARY_KEYS.includes(round.qualificationKey));
    const total = rounds.reduce((sum, round) => sum + round.questions.length, 0);
    const answered = Object.keys(store.attempts).length;
    const correct = Object.values(store.attempts).filter((item) => item.lastCorrect).length;
    return { total, answered, correct, wrong: Object.keys(store.wrong).length, bookmarks: store.bookmarks.length,
      accuracy: answered ? Math.round(correct / answered * 100) : 0, coverage: total ? Math.round(answered / total * 100) : 0 };
  }
  function isToday(timestamp) {
    if (!timestamp) return false;
    const date = new Date(timestamp), now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  }
  function dailyStats() {
    const today = Object.values(store.attempts).filter((item) => isToday(item.at)).length;
    const days = new Set(Object.values(store.attempts).map((item) => {
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
    return ROUNDS.flatMap((round) => round.questions.map((question) => ({ round, question })));
  }
  function shuffled(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  }
  function latestProgressRound() {
    return Object.entries(store.progress).sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0)).map(([id]) => getRound(id)).find(Boolean) || null;
  }

  function navButton(view, icon, label) {
    const active = state.view === view || (view === 'rounds' && ['session', 'result'].includes(state.view));
    return `<button class="nav-button" data-action="nav" data-view="${view}" ${active ? 'aria-current="page"' : ''}><span>${icon}</span><span>${label}</span></button>`;
  }
  function shell(content, title, subtitle) {
    const stats = overallStats();
    const focused = !!state.session;
    app.innerHTML = `<div class="app-shell ${focused ? `session-shell ${state.focusSidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}` : ''}">
      <aside class="sidebar">
        <button class="brand" data-action="nav" data-view="home"><span class="brand-mark">CBT</span><span><strong>산업기사 통합 CBT</strong><small>OFFLINE STUDY</small></span></button>
        <nav class="side-nav">
          ${navButton('home', '⌂', '첫 화면')}${navButton('rounds', '▤', '기출 회차')}${navButton('wrong', '!', '오답·북마크')}${navButton('search', '⌕', '문제 검색')}${navButton('stats', '▥', '학습 통계')}
        </nav>
        <div class="side-foot"><span>전체 학습 범위</span><strong>${stats.coverage}% 완료</strong></div>
      </aside>
      <main class="main">
        <header class="topbar">${focused ? `<button class="session-back-button" data-action="leave-session" aria-label="회차 목록으로 돌아가기">←</button><button class="session-menu-toggle" data-action="toggle-session-sidebar" aria-label="메뉴 열기 또는 닫기">${state.focusSidebarOpen ? '×' : '☰'}</button>` : ''}<div class="topbar-copy"><strong>${esc(title)}</strong><span>${esc(subtitle || '원하는 종목과 회차를 선택하세요.')}</span></div><div class="top-actions"><button class="icon-button" data-action="open-search" title="검색">⌕</button><button class="icon-button" data-action="open-settings" title="설정">⚙</button></div></header>
        <section class="content">${content}</section>
      </main>
      <nav class="mobile-nav">${navButton('home', '⌂', '홈')}${navButton('rounds', '▤', '회차')}${navButton('wrong', '!', '오답')}${navButton('search', '⌕', '검색')}${navButton('stats', '▥', '통계')}</nav>
      ${focused && state.focusSidebarOpen ? '<button class="session-sidebar-backdrop" data-action="toggle-session-sidebar" aria-label="메뉴 닫기"></button>' : ''}
    </div>${renderModal()}`;
    bindFocusable();
  }

  function renderHome() {
    state.view = 'home';
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
      <section class="smart-strip"><article class="daily-card"><div class="daily-ring" style="--daily:${daily.percent * 3.6}deg"><div><strong>${daily.today}</strong><span>/ ${daily.goal}</span></div></div><div><span class="smart-kicker">TODAY</span><h3>오늘의 학습 목표</h3><p>${daily.today >= daily.goal ? '오늘 목표를 달성했습니다. 대단해요!' : `${daily.goal - daily.today}문제만 더 풀면 오늘 목표 달성!`}</p></div></article><button class="smart-action violet" data-action="start-daily"><span>✦</span><div><strong>오늘의 20문제</strong><small>아직 안 푼 문제 중심 출제</small></div><b>›</b></button><button class="smart-action coral" data-action="start-weak"><span>◎</span><div><strong>약점 집중 훈련</strong><small>오답 우선 맞춤 복습</small></div><b>›</b></button>${recentRound ? `<button class="smart-action mint" data-action="continue-round" data-round="${recentRound.id}"><span>↗</span><div><strong>이어서 학습</strong><small>${esc(recentRound.shortQualification)} · ${recentRound.year}년</small></div><b>›</b></button>` : `<button class="smart-action mint" data-action="nav" data-view="rounds"><span>↗</span><div><strong>첫 학습 시작</strong><small>원하는 회차를 골라보세요</small></div><b>›</b></button>`}</section>
      <section class="section-block"><div class="section-heading"><div><span>QUALIFICATIONS</span><h2>종목 선택</h2></div></div><div class="qualification-grid">${cards}</div></section>
      <section class="dashboard-grid"><article class="panel"><div class="panel-heading"><h3>학습 현황</h3><button data-action="nav" data-view="stats">자세히</button></div><div class="metric-grid"><div><span>전체 문제</span><strong>${stats.total.toLocaleString()}</strong></div><div><span>학습 문제</span><strong>${stats.answered.toLocaleString()}</strong></div><div><span>북마크</span><strong>${stats.bookmarks.toLocaleString()}</strong></div><div><span>학습 범위</span><strong>${stats.coverage}%</strong></div></div></article><article class="panel"><div class="panel-heading"><h3>최근 시험</h3></div><ul class="history-list">${recent}</ul></article></section>
      <aside class="streak-banner"><span>🔥</span><div><strong>${daily.streak}일 연속 학습 중</strong><small>매일 한 문제라도 풀면 연속 기록이 이어집니다.</small></div><div class="streak-dots">${Array.from({length:7},(_,i)=>`<i class="${i < Math.min(7,daily.streak) ? 'on' : ''}"></i>`).join('')}</div></aside>`, '산업기사 통합 CBT', '공조냉동 · 산업안전 · 에너지관리');
  }

  function renderRounds() {
    state.view = 'rounds';
    const years = [...new Set(ROUNDS.filter((round) => state.qualification === 'all' || round.qualificationKey === state.qualification).map((round) => round.year))].sort((a, b) => b - a);
    const query = state.roundSearch.trim().toLowerCase();
    const filtered = ROUNDS.filter((round) => (state.qualification === 'all' || round.qualificationKey === state.qualification) && (state.year === 'all' || String(round.year) === String(state.year)) && (!query || `${round.title} ${round.qualification}`.toLowerCase().includes(query)));
    const qualificationOptions = `<option value="all">전체 종목</option>` + CATALOG.map((item) => `<option value="${item.key}" ${state.qualification === item.key ? 'selected' : ''}>${esc(item.name)}</option>`).join('');
    shell(`<div class="filter-bar"><label>종목<select data-change="qualification">${qualificationOptions}</select></label><label>연도<select data-change="year"><option value="all">전체 연도</option>${years.map((year) => `<option ${String(state.year) === String(year) ? 'selected' : ''}>${year}</option>`).join('')}</select></label><label class="filter-search">회차 검색<input data-input="round-search" value="${esc(state.roundSearch)}" placeholder="예: 2020년 3회"></label></div>
      <div class="section-heading"><div><span>PAST EXAMS</span><h2>${filtered.length}개 회차</h2></div><button class="secondary-button compact" data-action="open-random">랜덤 출제</button></div>
      <div class="round-grid">${filtered.map(renderRoundCard).join('') || '<div class="empty-state">조건에 맞는 회차가 없습니다.</div>'}</div>`, '기출 회차', '학습모드 또는 실제 CBT형 시험모드로 시작할 수 있습니다.');
  }
  function renderRoundCard(round) {
    const progress = store.progress[round.id];
    const count = Object.keys(progress?.answers || {}).length;
    const rate = Math.round(count / round.questions.length * 100);
    const restored = round.qualificationKey === 'hvac' && Number(round.year) >= 2021;
    return `<article class="round-card"><div class="round-card-top"><span class="qualification-chip ${round.qualificationKey}">${esc(round.shortQualification || round.qualification)}</span><span>${round.year}년</span></div>${restored ? '<span class="restoration-chip">CBT 복원문제 · 원문 이미지</span>' : ''}<h3>${esc(round.title.replace(/\s*\(정답, 해설\)$/, ''))}</h3><p>${round.questions.length}문제 · ${round.subjects.length}과목 · 시험 ${round.examMinutes || Math.round(round.questions.length * 1.5)}분</p><div class="subject-tags">${round.subjects.map((subject) => `<span>${esc(subject)}</span>`).join('')}</div>${count ? `<div class="card-progress"><span style="width:${rate}%"></span></div><small>${count}/${round.questions.length} 학습 중</small>` : ''}<button class="card-start" data-action="open-mode" data-round="${round.id}">${count ? '이어 풀기' : '시작하기'} <span>›</span></button></article>`;
  }

  function renderWrong() {
    state.view = 'wrong';
    const wrongItems = Object.keys(store.wrong).map(findQuestion).filter(Boolean);
    const bookmarks = store.bookmarks.map(findQuestion).filter(Boolean);
    const list = (items, type) => items.slice(0, 100).map(({ round, question }) => `<article class="mini-question"><span>${esc(round.shortQualification)} · ${round.year}년 · ${question.number}번</span><strong>${esc(question.text)}</strong><div><button data-action="start-single" data-id="${questionId(round, question)}">풀어보기</button>${type === 'bookmark' ? `<button data-action="toggle-bookmark" data-id="${questionId(round, question)}">북마크 해제</button>` : ''}</div></article>`).join('') || '<div class="empty-state">저장된 문제가 없습니다.</div>';
    shell(`<div class="review-grid"><section class="panel"><div class="panel-heading"><h2>오답 ${wrongItems.length}문제</h2>${wrongItems.length ? '<button data-action="start-wrong">오답 전체 풀기</button>' : ''}</div><div class="mini-list">${list(wrongItems, 'wrong')}</div></section><section class="panel"><div class="panel-heading"><h2>북마크 ${bookmarks.length}문제</h2>${bookmarks.length ? '<button data-action="start-bookmarks">전체 풀기</button>' : ''}</div><div class="mini-list">${list(bookmarks, 'bookmark')}</div></section></div>`, '오답·북마크', '틀린 문제와 기억해 둘 문제를 모아 다시 풉니다.');
  }

  function renderSearch() {
    state.view = 'search';
    const query = state.searchQuery.trim().toLowerCase();
    const results = [];
    if (query.length >= 2) {
      outer: for (const round of ROUNDS) for (const question of round.questions) {
        const text = `${question.text} ${question.choices.map((choice) => choice.text).join(' ')}`.toLowerCase();
        if (text.includes(query)) results.push({ round, question });
        if (results.length >= 150) break outer;
      }
    }
    shell(`<div class="search-hero"><input autofocus data-input="question-search" value="${esc(state.searchQuery)}" placeholder="두 글자 이상 입력하세요"><span>⌕</span></div><p class="search-count">${query.length >= 2 ? `${results.length}${results.length === 150 ? '+' : ''}개 결과` : '문제와 보기의 텍스트를 검색합니다.'}</p><div class="search-results">${results.map(({ round, question }) => `<article><span>${esc(round.shortQualification)} · ${round.year}년 · ${question.number}번</span><strong>${highlight(question.text, query)}</strong><button data-action="start-single" data-id="${questionId(round, question)}">문제 풀기</button></article>`).join('') || (query.length >= 2 ? '<div class="empty-state">검색 결과가 없습니다.</div>' : '')}</div>`, '문제 검색', '13,420문제에서 필요한 내용을 찾습니다.');
  }
  function highlight(text, query) {
    const safe = esc(text); if (!query) return safe;
    return safe.replace(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (value) => `<mark>${value}</mark>`);
  }

  function renderStats() {
    state.view = 'stats';
    const stats = overallStats();
    const rows = CATALOG.filter((item) => PRIMARY_KEYS.includes(item.key)).map((item) => {
      const ids = item.rounds.flatMap((round) => round.questions.map((question) => questionId(round, question)));
      const answered = ids.filter((id) => store.attempts[id]).length;
      const correct = ids.filter((id) => store.attempts[id]?.lastCorrect).length;
      return `<tr><th>${esc(item.name)}</th><td>${ids.length.toLocaleString()}</td><td>${answered.toLocaleString()}</td><td>${answered ? Math.round(correct / answered * 100) : 0}%</td></tr>`;
    }).join('');
    shell(`<div class="stat-cards"><article><span>학습한 문제</span><strong>${stats.answered.toLocaleString()}</strong><small>/ ${stats.total.toLocaleString()}</small></article><article><span>정답률</span><strong>${stats.accuracy}%</strong><small>${stats.correct.toLocaleString()}문제 정답</small></article><article><span>오답노트</span><strong>${stats.wrong.toLocaleString()}</strong><small>복습 필요</small></article><article><span>완료한 시험</span><strong>${store.history.length}</strong><small>최근 50회 저장</small></article></div><article class="panel"><div class="panel-heading"><h2>종목별 학습 현황</h2></div><div class="table-wrap"><table><thead><tr><th>종목</th><th>전체</th><th>학습</th><th>정답률</th></tr></thead><tbody>${rows}</tbody></table></div></article>`, '학습 통계', '이 브라우저에 저장된 학습 기록입니다.');
  }

  function renderModal() {
    if (!state.modal) return '';
    if (state.modal.type === 'mode') {
      const round = getRound(state.modal.roundId);
      if (!round) return '';
      return `<div class="modal-backdrop" data-action="close-modal"><div class="modal" role="dialog"><button class="modal-close" data-action="close-modal">×</button><span class="modal-kicker">${esc(round.shortQualification)}</span><h2>${esc(round.title.replace(/\s*\(정답, 해설\)$/, ''))}</h2><p>${round.questions.length}문제 · ${round.subjects.length}과목</p><div class="mode-grid"><button data-action="start-mode" data-mode="learn" data-round="${round.id}"><span>학습모드</span><strong>여러 문제씩 풀이</strong><small>정답과 해설을 바로 확인하고, 풀이 화면에서 표시 개수를 바꿀 수 있습니다.</small></button><button data-action="start-mode" data-mode="exam" data-round="${round.id}"><span>시험모드</span><strong>실제 CBT 형식</strong><small>2열 문제지와 OMR 답안지, 타이머를 사용해 실전처럼 풉니다.</small></button></div></div></div>`;
    }
    if (state.modal.type === 'settings') {
      return `<div class="modal-backdrop" data-action="close-modal"><div class="modal small-modal"><button class="modal-close" data-action="close-modal">×</button><h2>화면 설정</h2><label class="setting-row">화면 테마<select data-change="theme"><option value="system">기기 설정</option><option value="light">밝게</option><option value="dark">어둡게</option></select></label><label class="setting-row">글자 크기<input type="range" min="0.9" max="1.25" step="0.05" value="${store.fontScale}" data-change="font-scale"></label><p class="setting-note">학습 기록은 서버로 전송되지 않고 이 브라우저에만 저장됩니다.</p><button class="danger-button" data-action="reset-progress">학습 기록 초기화</button></div></div>`;
    }
    if (state.modal.type === 'random') {
      return `<div class="modal-backdrop" data-action="close-modal"><div class="modal small-modal"><button class="modal-close" data-action="close-modal">×</button><h2>랜덤 문제</h2><label class="setting-row">종목<select id="randomQualification">${CATALOG.filter((item) => PRIMARY_KEYS.includes(item.key)).map((item) => `<option value="${item.key}" ${state.qualification === item.key ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label><label class="setting-row">문제 수<select id="randomCount"><option>10</option><option>20</option><option>40</option><option>60</option><option>80</option><option>100</option></select></label><button class="primary-button wide" data-action="start-random">학습 시작</button></div></div>`;
    }
    return '';
  }

  function startRound(roundId, mode) {
    const round = getRound(roundId); if (!round) return;
    clearInterval(timerHandle);
    const saved = mode === 'learn' ? store.progress[round.id] : null;
    const duration = (round.examMinutes || Math.round(round.questions.length * 1.5)) * 60;
    const savedPageSize = Number(saved?.pageSize);
    state.session = { round, questions: round.questions, mode, answers: saved?.answers || {}, revealed: saved?.revealed || {}, review: {}, page: saved?.page || 0, pageSize: [2, 4, 6, 10, 20, 40, round.questions.length].includes(savedPageSize) ? savedPageSize : 4, duration, remaining: duration, startedAt: Date.now() };
    state.modal = null; state.result = null; state.examSheetOpen = false; state.focusSidebarOpen = false; state.view = 'session';
    if (mode === 'exam') startTimer();
    renderSession();
  }
  function startCollection(items, title) {
    if (!items.length) return toast('풀 문제가 없습니다.');
    const questions = items.map(({ round, question }, index) => Object.assign({}, question, { number: index + 1, _originalNumber: question.number, _originRoundId: round.id, _subject: `${round.shortQualification} · ${subjectFor(round, question)}` }));
    const round = { id: `collection-${Date.now()}`, title, qualification: '맞춤 학습', shortQualification: '맞춤', qualificationKey: 'collection', year: '', subjects: [...new Set(questions.map((question) => question._subject))], questions, examMinutes: Math.max(10, Math.round(questions.length * 1.5)) };
    state.session = { round, questions, mode: 'learn', answers: {}, revealed: {}, review: {}, page: 0, pageSize: 4, duration: 0, remaining: 0, startedAt: Date.now(), transient: true };
    state.modal = null; state.focusSidebarOpen = false; state.view = 'session'; renderSession();
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
    const answered = Object.keys(s.answers).length;
    shell(`<div class="session-head"><div><span>학습모드</span><h2>${esc(s.round.title)}</h2></div><div class="session-status"><strong><b data-learning-done>${answered}</b>/${s.questions.length}</strong><span>답변 완료</span></div></div>
      <div class="learning-toolbar"><label>한 화면 문제 수<select data-change="session-page-size">${[2, 4, 6, 10, 20, 40].map((size) => `<option value="${size}" ${s.pageSize === size ? 'selected' : ''}>${size}문제</option>`).join('')}<option value="${s.questions.length}" ${s.pageSize === s.questions.length ? 'selected' : ''}>전체</option></select></label><span>넓은 화면에서는 한 줄에 2문제씩 표시됩니다.</span><div class="learning-toolbar-actions"><button data-action="open-jump">문제 번호로 이동</button><button class="learning-reset-button" data-action="reset-learning-session">현재 풀이 초기화</button></div></div>
      <div class="learning-list">${visible.map((question) => renderLearningQuestion(question)).join('')}</div>
      <div class="pagination"><button data-action="session-prev" ${s.page === 0 ? 'disabled' : ''}>‹ 이전</button><span>${s.page + 1} / ${pages}</span><button data-action="session-next" ${s.page >= pages - 1 ? 'disabled' : ''}>다음 ›</button></div>
      <div class="learning-finish"><button class="primary-button" data-action="finish-session">학습 결과 보기</button></div>`, '문제 풀이', `${s.round.shortQualification || ''} · 학습모드`);
    saveLearningProgress();
  }
  function renderLearningQuestion(question) {
    const s = state.session, id = questionId(s.round, question), selected = s.answers[question.number], revealed = !!s.revealed[question.number], bookmarked = store.bookmarks.includes(id);
    const imagePrimary = isImagePrimary(s.round, question);
    const prompt = imagePrimary
      ? `<div class="image-question-label"><strong>${question.number}번</strong><span>CBT 복원문제 · 원문 이미지</span></div><img class="source-question-main" src="${esc(question.sourceImage)}" alt="${question.number}번 복원문제 원문" loading="lazy">`
      : `<h3><span>${question.number}.</span> ${question.html || esc(question.text)}</h3>${renderImages(question.images, '문제 이미지')}`;
    return `<article class="question-card ${imagePrimary ? 'image-primary' : ''}" id="question-${question.number}"><div class="question-meta"><span>${esc(subjectFor(s.round, question))}</span><button class="bookmark-button ${bookmarked ? 'active' : ''}" data-action="toggle-bookmark" data-id="${id}" title="북마크">★</button></div>${prompt}
      <div class="choice-list ${imagePrimary ? 'image-answer-list' : ''}">${question.choices.map((choice, index) => { const n = index + 1, cls = revealed ? (n === question.answer ? 'correct' : n === selected ? 'wrong' : '') : n === selected ? 'selected' : ''; return `<button class="choice ${cls}" data-action="answer" data-number="${question.number}" data-choice="${n}"><span>${CIRCLES[index]}</span><span>${imagePrimary ? `${n}번 선택` : (choice.html || esc(choice.text))}</span>${imagePrimary ? '' : renderImages(choice.images, '보기 이미지')}</button>`; }).join('')}</div>
      <div class="question-feedback">${revealed ? renderExplanation(question, selected) : '<p class="answer-guide">보기를 선택하면 정답과 해설이 표시됩니다.</p>'}</div>
      ${question.sourceImage && !imagePrimary ? `<details class="source-details"><summary>원문 이미지 확인</summary><img src="${esc(question.sourceImage)}" alt="${question.number}번 원문" loading="lazy"></details>` : ''}</article>`;
  }
  function renderExplanation(question, selected) {
    const correct = selected === question.answer;
    const explanationBadge = question.explanationType === 'ai-reference' ? '<span class="ai-explanation-badge">AI 참고 해설 · 쉽게 풀어보기</span>' : '';
    const explanation = question.explanationHtml || (question.explanation ? esc(question.explanation).replaceAll('\n', '<br>') : '등록된 해설이 없습니다. 정답과 보기를 비교해 복습하세요.');
    return `<div class="explanation ${correct ? 'correct' : 'wrong'}"><strong>${correct ? '정답입니다' : `오답입니다 · 정답 ${CIRCLES[question.answer - 1]}`}</strong>${explanationBadge}<p>${explanation}</p>${question.hint ? `<small>힌트: ${esc(question.hint)}</small>` : ''}</div>`;
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
    return `${showSubject ? `<div class="exam-section-title">${s.round.subjects.indexOf(subjectFor(s.round, question)) + 1}과목 : ${esc(subjectFor(s.round, question))}</div>` : ''}<article class="exam-question ${held ? 'held' : ''} ${imagePrimary ? 'image-primary' : ''}" id="exam-question-${question.number}">${prompt}${imagePrimary ? `<button class="exam-image-hold" data-action="toggle-review" data-number="${question.number}" title="보류 표시">${held ? '★ 보류' : '☆ 보류'}</button>` : ''}<div class="exam-choices ${imagePrimary ? 'exam-image-answers' : ''}">${question.choices.map((choice, index) => `<button class="exam-choice ${selected === index + 1 ? 'selected' : ''}" data-action="answer" data-number="${question.number}" data-choice="${index + 1}"><span>${CIRCLES[index]}</span><span>${imagePrimary ? `${index + 1}번 선택` : (choice.html || esc(choice.text))}</span>${imagePrimary ? '' : renderImages(choice.images, '보기 이미지')}</button>`).join('')}</div></article>`;
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
      const id = questionId(s.round, question), correct = choice === question.answer;
      store.attempts[id] = { count: (store.attempts[id]?.count || 0) + 1, lastCorrect: correct, at: Date.now() };
      if (correct) delete store.wrong[id]; else store.wrong[id] = { at: Date.now(), selected: choice };
      saveStore(); saveLearningProgress();
      const card = document.getElementById(`question-${number}`);
      if (card) {
        card.querySelectorAll('.choice[data-choice]').forEach((node) => {
          const option = Number(node.dataset.choice);
          node.classList.remove('selected');
          node.classList.toggle('correct', option === question.answer);
          node.classList.toggle('wrong', option === choice && choice !== question.answer);
        });
        const feedback = card.querySelector('.question-feedback');
        if (feedback) feedback.innerHTML = renderExplanation(question, choice);
        const answered = Object.keys(s.answers).length;
        document.querySelectorAll('[data-learning-done]').forEach((node) => node.textContent = answered);
        return;
      }
    }
    renderSession();
  }
  function saveLearningProgress() {
    const s = state.session; if (!s || s.mode !== 'learn' || s.transient) return;
    store.progress[s.round.id] = { answers: s.answers, revealed: s.revealed, page: s.page, pageSize: s.pageSize, updatedAt: Date.now() }; saveStore();
  }
  function finishSession(auto) {
    const s = state.session; if (!s) return;
    const unanswered = s.questions.length - Object.keys(s.answers).length;
    if (!auto && s.mode === 'exam' && unanswered && !confirm(`${unanswered}문제가 미응답입니다. 지금 채점할까요?`)) return;
    clearInterval(timerHandle);
    let correct = 0;
    const subjectMap = {};
    s.questions.forEach((question) => {
      const selected = s.answers[question.number], isCorrect = selected === question.answer, subject = subjectFor(s.round, question), id = questionId(s.round, question);
      if (isCorrect) correct++;
      subjectMap[subject] ||= { correct: 0, total: 0 }; subjectMap[subject].total++; if (isCorrect) subjectMap[subject].correct++;
      if (selected) {
        store.attempts[id] = { count: (store.attempts[id]?.count || 0) + (s.mode === 'exam' ? 1 : 0), lastCorrect: isCorrect, at: Date.now() };
        if (isCorrect) delete store.wrong[id]; else store.wrong[id] = { at: Date.now(), selected };
      }
    });
    const score = Math.round(correct / s.questions.length * 100);
    state.result = { score, correct, total: s.questions.length, unanswered, subjects: subjectMap, title: s.round.title, answers: Object.assign({}, s.answers), questions: s.questions, round: s.round, mode: s.mode };
    store.history.unshift({ title: s.round.title, score, correct, total: s.questions.length, at: Date.now() }); store.history = store.history.slice(0, 50); saveStore();
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
    s.page = Math.floor((number - 1) / s.pageSize); renderSession();
    requestAnimationFrame(() => document.getElementById(`question-${number}`)?.scrollIntoView({ block: 'start' }));
  }
  function renderJumpModal() {
    const s = state.session; if (!s) return;
    const input = prompt(`이동할 문제 번호를 입력하세요. (1~${s.questions.length})`);
    if (input && Number(input) >= 1 && Number(input) <= s.questions.length) jumpQuestion(Number(input));
  }
  function bindFocusable() { document.documentElement.style.setProperty('--font-scale', store.fontScale || 1); }

  function actionHandler(event) {
    const button = event.target.closest('[data-action]'); if (!button) return;
    // A backdrop is an ancestor of the dialog as well. Only treat a click on
    // the backdrop itself as a request to close; inner controls must keep working.
    if (button.dataset.action === 'close-modal' && button.classList?.contains('modal-backdrop') && event.target !== button) return;
    const action = button.dataset.action;
    if (action === 'nav') { state.modal = null; state.view = button.dataset.view; route(); }
    else if (action === 'toggle-session-sidebar') { state.focusSidebarOpen = !state.focusSidebarOpen; renderSession(); }
    else if (action === 'select-qualification') { state.qualification = button.dataset.key; state.year = 'all'; renderRounds(); }
    else if (action === 'open-mode') { state.modal = { type: 'mode', roundId: button.dataset.round }; route(); }
    else if (action === 'start-mode') startRound(button.dataset.round, button.dataset.mode);
    else if (action === 'close-modal') { state.modal = null; route(); }
    else if (action === 'open-settings') { state.modal = { type: 'settings' }; route(); }
    else if (action === 'open-search') { state.view = 'search'; state.modal = null; renderSearch(); }
    else if (action === 'open-random') { state.modal = { type: 'random' }; route(); }
    else if (action === 'start-daily') {
      const pool = allQuestionItems(), unseen = pool.filter(({ round, question }) => !store.attempts[questionId(round, question)]);
      const selected = shuffled(unseen).slice(0, 20);
      if (selected.length < 20) selected.push(...shuffled(pool.filter((item) => !selected.includes(item))).slice(0, 20 - selected.length));
      startCollection(selected, '오늘의 20문제');
    }
    else if (action === 'start-weak') {
      const wrong = Object.keys(store.wrong).map(findQuestion).filter(Boolean);
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
    else if (action === 'start-wrong') startCollection(Object.keys(store.wrong).map(findQuestion).filter(Boolean), '오답 다시 풀기');
    else if (action === 'start-bookmarks') startCollection(store.bookmarks.map(findQuestion).filter(Boolean), '북마크 다시 풀기');
    else if (action === 'start-single') { const item = findQuestion(button.dataset.id); if (item) startCollection([item], '선택 문제 풀이'); }
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
    else if (action === 'reset-progress' && confirm('모든 학습 기록, 오답, 북마크를 초기화할까요?')) { store = defaultStore(); saveStore(); state.modal = null; renderHome(); }
  }
  function rRound() { return state.result?.round?.id ? getRound(state.result.round.id) : null; }
  function changeHandler(event) {
    const key = event.target.dataset.change; if (!key) return;
    if (key === 'qualification') { state.qualification = event.target.value; state.year = 'all'; renderRounds(); }
    else if (key === 'year') { state.year = event.target.value; renderRounds(); }
    else if (key === 'theme') { setTheme(event.target.value); route(); }
    else if (key === 'font-scale') { store.fontScale = Number(event.target.value); bindFocusable(); saveStore(); }
    else if (key === 'session-page-size') {
      const s = state.session, first = s.page * s.pageSize; s.pageSize = Number(event.target.value); s.page = Math.floor(first / s.pageSize); saveLearningProgress(); renderSession();
    }
    else if (key === 'exam-subject') {
      const s = state.session, index = Number(event.target.value), size = Math.ceil(s.questions.length / s.round.subjects.length); jumpQuestion(index * size + 1);
    }
  }
  function inputHandler(event) {
    const key = event.target.dataset.input; if (!key) return;
    if (key === 'round-search') { state.roundSearch = event.target.value; clearTimeout(event.target._timer); event.target._timer = setTimeout(renderRounds, 160); }
    if (key === 'question-search') { state.searchQuery = event.target.value; clearTimeout(event.target._timer); event.target._timer = setTimeout(renderSearch, 220); }
  }
  function route() {
    if (state.session) return renderSession();
    if (state.view === 'home') renderHome(); else if (state.view === 'rounds') renderRounds(); else if (state.view === 'wrong') renderWrong(); else if (state.view === 'search') renderSearch(); else if (state.view === 'stats') renderStats(); else if (state.view === 'result') renderResult(); else renderHome();
  }

  app.addEventListener('click', actionHandler);
  app.addEventListener('change', changeHandler);
  app.addEventListener('input', inputHandler);
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (store.theme === 'system') setTheme('system'); });
  setTheme(store.theme || 'system'); bindFocusable(); route();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
