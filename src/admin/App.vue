<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { createClient, type RealtimeChannel, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { animate, stagger } from 'motion';

type VisitorProfile = {
  visitor_id: string;
  ip_address: string | null;
  first_seen: string;
  last_seen: string;
  visit_count: number;
  attempt_count: number;
  correct_count: number;
  exam_count: number;
  last_score: number | null;
  best_score: number | null;
  device_type: string | null;
  browser: string | null;
  last_path: string | null;
  location_country: string | null;
  location_country_code: string | null;
  location_region: string | null;
  location_city: string | null;
  location_latitude: number | null;
  location_longitude: number | null;
  location_timezone: string | null;
  network_provider: string | null;
};

type Visit = {
  id: number;
  visitor_id: string;
  visited_at: string;
  device_type: string | null;
  browser: string | null;
  path: string | null;
};

type ExamResult = {
  id: number;
  visitor_id: string;
  ip_address: string | null;
  qualification: string | null;
  title: string | null;
  mode: string | null;
  score: number;
  correct_count: number;
  total_count: number;
  unanswered_count: number;
  completed_at: string;
};

type Attempt = {
  id: number;
  visitor_id: string;
  ip_address: string | null;
  qualification: string | null;
  round_title: string | null;
  question_number: number;
  selected_answer: number;
  correct_answer: number;
  is_correct: boolean;
  mode: string | null;
  answered_at: string;
};

const config = window.CBT_CLOUD_CONFIG;
const configured = Boolean(config?.enabled && config.supabaseUrl && config.supabaseAnonKey);
const client = ref<SupabaseClient | null>(configured ? createClient(config!.supabaseUrl, config!.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true }
}) : null);
const session = ref<Session | null>(null);
const email = ref('');
const password = ref('');
const loginError = ref('');
const dataError = ref('');
const loading = ref(false);
const days = ref(30);
const visitors = ref<VisitorProfile[]>([]);
const visits = ref<Visit[]>([]);
const results = ref<ExamResult[]>([]);
const attempts = ref<Attempt[]>([]);
const realtimeStatus = ref<'connecting' | 'connected' | 'error' | 'closed'>('connecting');
const realtimeUpdatedAt = ref<string | null>(null);
const clockNow = ref(Date.now());
const showLiveVisitors = ref(false);
const selectedAttemptVisitor = ref<string | null>(null);
const attemptDisplayLimit = ref(8);
let realtimeChannel: RealtimeChannel | null = null;
let realtimeReloadTimer: number | null = null;
let clockTimer: number | null = null;
let autoRefreshTimer: number | null = null;

const activeVisitors = computed(() => {
  const since = clockNow.value - 2 * 60 * 1000;
  return visitors.value.filter((item) => new Date(item.last_seen).getTime() >= since);
});
const activeNow = computed(() => activeVisitors.value.length);
const activeToday = computed(() => {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  return new Set(visits.value.filter((item) => new Date(item.visited_at).getTime() >= since).map((item) => item.visitor_id)).size;
});
const solvedTotal = computed(() => visitors.value.reduce((sum, item) => sum + Number(item.attempt_count || 0), 0));
const examTotal = computed(() => visitors.value.reduce((sum, item) => sum + Number(item.exam_count || 0), 0));
const averageScore = computed(() => results.value.length
  ? Math.round(results.value.reduce((sum, item) => sum + Number(item.score || 0), 0) / results.value.length)
  : 0);
const attemptVisitorOptions = computed(() => {
  const counts = new Map<string, number>();
  attempts.value.forEach((attempt) => counts.set(attempt.visitor_id, (counts.get(attempt.visitor_id) || 0) + 1));
  return [...counts.entries()].map(([visitorId, count]) => ({
    visitorId,
    count,
    profile: visitors.value.find((visitor) => visitor.visitor_id === visitorId) || null
  }));
});
const filteredAttempts = computed(() => {
  if (selectedAttemptVisitor.value) {
    return attempts.value.filter((attempt) => attempt.visitor_id === selectedAttemptVisitor.value);
  }
  const seen = new Set<string>();
  return attempts.value.filter((attempt) => {
    if (seen.has(attempt.visitor_id)) return false;
    seen.add(attempt.visitor_id);
    return true;
  });
});
const visibleAttempts = computed(() => filteredAttempts.value.slice(0, attemptDisplayLimit.value));
const accuracy = (visitor: VisitorProfile) => visitor.attempt_count
  ? Math.round(visitor.correct_count / visitor.attempt_count * 100)
  : 0;
const realtimeLabel = computed(() => ({
  connecting: '실시간 연결 중',
  connected: '실시간 연결됨',
  error: '실시간 연결 오류',
  closed: '실시간 연결 종료'
}[realtimeStatus.value]));

function formatDate(value: string | null): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

function locationLabel(visitor: VisitorProfile): string {
  const parts = [visitor.location_country, visitor.location_region, visitor.location_city].filter(Boolean);
  return [...new Set(parts)].join(' · ') || '위치 확인 중';
}

function locationDetail(visitor: VisitorProfile): string {
  return [visitor.network_provider, visitor.location_timezone].filter(Boolean).join(' · ') || 'IP 기반 추정 위치';
}

function selectAttemptVisitor(visitorId: string | null): void {
  selectedAttemptVisitor.value = visitorId;
  attemptDisplayLimit.value = 8;
}

function viewLabel(value: string | null): string {
  const labels: Record<string, string> = {
    home: '첫 화면',
    rounds: '기출 회차',
    learning: '학습모드',
    exam: '시험모드',
    wrong: '오답·북마크',
    search: '문제 검색',
    stats: '학습 통계',
    updates: '패치노트'
  };
  if (!value) return '-';
  return labels[value] || value;
}

async function login(): Promise<void> {
  if (!client.value) return;
  loginError.value = '';
  loading.value = true;
  const { data, error } = await client.value.auth.signInWithPassword({
    email: email.value.trim(),
    password: password.value
  });
  loading.value = false;
  if (error || !data.session) {
    loginError.value = '로그인 정보를 확인해 주세요.';
    return;
  }
  session.value = data.session;
  await loadData();
  startRealtime();
  startAutoRefresh();
}

async function logout(): Promise<void> {
  stopRealtime();
  await client.value?.auth.signOut();
  session.value = null;
  visitors.value = [];
  visits.value = [];
  results.value = [];
  attempts.value = [];
  if (autoRefreshTimer !== null) {
    window.clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

async function loadData(options: { silent?: boolean } = {}): Promise<void> {
  if (!client.value || !session.value) return;
  const silent = options.silent === true;
  if (!silent) loading.value = true;
  dataError.value = '';
  const since = new Date(Date.now() - days.value * 24 * 60 * 60 * 1000).toISOString();
  const [visitorResponse, visitResponse, resultResponse, attemptResponse] = await Promise.all([
    client.value.from('visitor_profiles').select('*').order('last_seen', { ascending: false }).limit(300),
    client.value.from('visit_events').select('id,visitor_id,visited_at,device_type,browser,path').gte('visited_at', since).order('visited_at', { ascending: false }).limit(3000),
    client.value.from('exam_results').select('*').gte('completed_at', since).order('completed_at', { ascending: false }).limit(1000),
    client.value.from('question_attempts').select('*').gte('answered_at', since).order('answered_at', { ascending: false }).limit(2000)
  ]);
  if (!silent) loading.value = false;
  const error = visitorResponse.error || visitResponse.error || resultResponse.error || attemptResponse.error;
  if (error) {
    dataError.value = '관리자 권한이 없거나 데이터베이스 설정이 완료되지 않았습니다.';
    visitors.value = [];
    return;
  }
  visitors.value = (visitorResponse.data || []) as VisitorProfile[];
  visits.value = (visitResponse.data || []) as Visit[];
  results.value = (resultResponse.data || []) as ExamResult[];
  attempts.value = (attemptResponse.data || []) as Attempt[];
  await nextTick();
  if (!silent) {
    animate('.admin-stat-card', {
      opacity: [0, 1],
      transform: ['translateY(12px)', 'translateY(0px)']
    }, { duration: 0.35, delay: stagger(0.055) });
  }
}

function scheduleRealtimeReload(): void {
  realtimeUpdatedAt.value = new Date().toISOString();
  if (realtimeReloadTimer !== null) window.clearTimeout(realtimeReloadTimer);
  realtimeReloadTimer = window.setTimeout(() => {
    realtimeReloadTimer = null;
    void loadData({ silent: true });
  }, 350);
}

function stopRealtime(): void {
  if (realtimeReloadTimer !== null) {
    window.clearTimeout(realtimeReloadTimer);
    realtimeReloadTimer = null;
  }
  if (realtimeChannel && client.value) void client.value.removeChannel(realtimeChannel);
  realtimeChannel = null;
  realtimeStatus.value = 'closed';
}

function startRealtime(): void {
  if (!client.value || !session.value) return;
  stopRealtime();
  realtimeStatus.value = 'connecting';
  realtimeChannel = client.value
    .channel(`cbt-admin-live-${session.value.user.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'visitor_profiles' }, scheduleRealtimeReload)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'visit_events' }, scheduleRealtimeReload)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'question_attempts' }, scheduleRealtimeReload)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'exam_results' }, scheduleRealtimeReload)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') realtimeStatus.value = 'connected';
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') realtimeStatus.value = 'error';
      else if (status === 'CLOSED') realtimeStatus.value = 'closed';
    });
}

function startAutoRefresh(): void {
  if (autoRefreshTimer !== null) window.clearInterval(autoRefreshTimer);
  autoRefreshTimer = window.setInterval(() => {
    void loadData({ silent: true });
  }, 15_000);
}

onMounted(async () => {
  if (!client.value) return;
  const { data } = await client.value.auth.getSession();
  session.value = data.session;
  if (session.value) {
    await loadData();
    startRealtime();
    startAutoRefresh();
  }
  clockTimer = window.setInterval(() => {
    clockNow.value = Date.now();
  }, 30_000);
});

onBeforeUnmount(() => {
  stopRealtime();
  if (clockTimer !== null) window.clearInterval(clockTimer);
  if (autoRefreshTimer !== null) window.clearInterval(autoRefreshTimer);
});
</script>

<template>
  <main class="admin-page">
    <section v-if="!configured" class="admin-auth-card setup-card">
      <span class="admin-kicker">ADMIN SETUP</span>
      <h1>관리자 통계 연결이 꺼져 있습니다</h1>
      <p><code>cloud-config.js</code>에 Supabase 주소와 공개 키를 입력하고 <b>enabled</b>를 켜면 관리자 로그인이 활성화됩니다.</p>
      <a href="./관리자_방문기록_설정방법.txt">설정 방법 열기</a>
    </section>

    <section v-else-if="!session" class="admin-auth-card">
      <div class="admin-brand"><span>CBT</span><div><strong>관리자 센터</strong><small>방문·학습 통계</small></div></div>
      <span class="admin-kicker">SECURE ADMIN ACCESS</span>
      <h1>관리자 로그인</h1>
      <form @submit.prevent="login">
        <label>이메일<input v-model="email" type="email" autocomplete="username" required></label>
        <label>비밀번호<input v-model="password" type="password" autocomplete="current-password" required></label>
        <button :disabled="loading">{{ loading ? '확인 중…' : '로그인' }}</button>
      </form>
      <p v-if="loginError" class="admin-error">{{ loginError }}</p>
      <a class="back-link" href="./">← CBT로 돌아가기</a>
    </section>

    <template v-else>
      <header class="admin-header">
        <div class="admin-brand"><span>CBT</span><div><strong>관리자 센터</strong><small>방문·문제풀이·시험점수</small></div></div>
        <div class="admin-header-actions">
          <div class="live-status" :class="`is-${realtimeStatus}`"><i></i><div><strong>{{ realtimeLabel }}</strong><small>현재 {{ activeNow }}명</small></div></div>
          <label>기간<select v-model.number="days" @change="loadData()"><option :value="7">7일</option><option :value="30">30일</option><option :value="90">90일</option></select></label>
          <button @click="loadData()" :disabled="loading">{{ loading ? '불러오는 중' : '새로고침' }}</button>
          <button class="logout-button" @click="logout">로그아웃</button>
        </div>
      </header>

      <section class="admin-intro">
        <div><span class="admin-kicker">PRIVATE ANALYTICS</span><h1>최근 접속과 학습 현황</h1><p>IP 위치는 통신사·VPN 출구 기준의 대략적인 국가·지역·도시이며 실제 현재 위치와 다를 수 있습니다.</p></div>
        <div class="admin-account"><span>로그인 계정</span><strong>{{ session.user.email }}</strong></div>
      </section>

      <p v-if="dataError" class="admin-error admin-data-error">{{ dataError }}</p>

      <section class="admin-stats">
        <button type="button" class="admin-stat-card live-card" :aria-expanded="showLiveVisitors" @click="showLiveVisitors = !showLiveVisitors"><span>현재 접속 추정</span><strong>{{ activeNow.toLocaleString() }}<b>명</b></strong><small>{{ showLiveVisitors ? '접속 목록 닫기' : '눌러서 IP 목록 보기' }}</small></button>
        <article class="admin-stat-card"><span>최근 24시간 방문자</span><strong>{{ activeToday.toLocaleString() }}</strong><small>고유 브라우저 기준</small></article>
        <article class="admin-stat-card"><span>누적 풀이 기록</span><strong>{{ solvedTotal.toLocaleString() }}</strong><small>관리자 수집 시작 이후</small></article>
        <article class="admin-stat-card"><span>완료 시험</span><strong>{{ examTotal.toLocaleString() }}</strong><small>학습 결과 포함</small></article>
        <article class="admin-stat-card"><span>평균 점수</span><strong>{{ averageScore }}<b>점</b></strong><small>선택 기간 완료 시험</small></article>
      </section>

      <section v-if="showLiveVisitors" class="live-access-panel">
        <div class="live-access-heading">
          <div><span class="admin-kicker">LIVE ACCESS</span><h2>현재 접속 중</h2><p>최근 2분 안에 일반 CBT에서 활동 신호를 보낸 접속자입니다.</p></div>
          <strong><i></i>{{ activeNow }}명 접속 중</strong>
        </div>
        <div v-if="activeVisitors.length" class="live-visitor-grid">
          <article v-for="visitor in activeVisitors" :key="visitor.visitor_id" class="live-visitor-card">
            <div class="live-visitor-top"><span><i></i>접속 중</span><code>{{ visitor.ip_address || 'IP 확인 중' }}</code></div>
            <dl>
              <div><dt>기기·브라우저</dt><dd>{{ visitor.device_type || '-' }} · {{ visitor.browser || '-' }}</dd></div>
              <div><dt>추정 위치</dt><dd>{{ locationLabel(visitor) }}</dd></div>
              <div><dt>현재 화면</dt><dd>{{ viewLabel(visitor.last_path) }}</dd></div>
              <div><dt>마지막 신호</dt><dd>{{ formatDate(visitor.last_seen) }}</dd></div>
              <div><dt>풀이·시험</dt><dd>{{ visitor.attempt_count }}문제 · {{ visitor.exam_count }}회</dd></div>
            </dl>
          </article>
        </div>
        <div v-else class="live-access-empty"><i></i><div><strong>현재 활동 중인 접속자가 없습니다</strong><span>일반 CBT를 열면 최대 1분 안에 IP와 기기가 표시됩니다.</span></div></div>
      </section>

      <section class="admin-panel">
        <div class="admin-panel-title"><span>RECENT VISITORS</span><h2>최근 접속 IP</h2><p>{{ visitors.length }}개 브라우저 · 마지막 실시간 반영 {{ formatDate(realtimeUpdatedAt) }}</p></div>
        <div class="admin-table-wrap">
          <table>
            <thead><tr><th>최근 접속</th><th>IP 주소</th><th>추정 위치</th><th>방문자 ID</th><th>기기</th><th>접속</th><th>풀이</th><th>정답률</th><th>최근/최고 점수</th></tr></thead>
            <tbody>
              <tr v-for="visitor in visitors" :key="visitor.visitor_id">
                <td>{{ formatDate(visitor.last_seen) }}</td><td><code>{{ visitor.ip_address || '-' }}</code></td>
                <td class="location-cell"><strong>{{ locationLabel(visitor) }}</strong><small>{{ locationDetail(visitor) }}</small></td>
                <td :title="visitor.visitor_id">{{ shortId(visitor.visitor_id) }}</td>
                <td>{{ visitor.device_type || '-' }} · {{ visitor.browser || '-' }}</td><td>{{ visitor.visit_count }}</td><td>{{ visitor.attempt_count }}</td><td>{{ accuracy(visitor) }}%</td>
                <td>{{ visitor.last_score ?? '-' }} / {{ visitor.best_score ?? '-' }}</td>
              </tr>
              <tr v-if="!visitors.length"><td colspan="9" class="empty-cell">아직 수집된 방문 기록이 없습니다.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="admin-panel">
        <div class="admin-panel-title"><span>EXAM RESULTS</span><h2>최근 시험 점수</h2><p>선택 기간 {{ results.length }}건</p></div>
        <div class="admin-table-wrap">
          <table>
            <thead><tr><th>완료 시각</th><th>IP 주소</th><th>종목</th><th>시험</th><th>모드</th><th>점수</th><th>정답</th></tr></thead>
            <tbody>
              <tr v-for="result in results.slice(0, 100)" :key="result.id">
                <td>{{ formatDate(result.completed_at) }}</td><td><code>{{ result.ip_address || '-' }}</code></td><td>{{ result.qualification || '-' }}</td><td>{{ result.title || '-' }}</td>
                <td>{{ result.mode === 'exam' ? '시험' : '학습' }}</td><td><strong class="score">{{ result.score }}점</strong></td><td>{{ result.correct_count }}/{{ result.total_count }}</td>
              </tr>
              <tr v-if="!results.length"><td colspan="7" class="empty-cell">완료된 시험 기록이 없습니다.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="admin-panel">
        <div class="admin-panel-title"><span>QUESTION ATTEMPTS</span><h2>접속자별 최근 푼 문제</h2><p>처음에는 최근 8문제만 표시</p></div>
        <div class="attempt-visitor-filter">
          <button type="button" :class="{ active: selectedAttemptVisitor === null }" @click="selectAttemptVisitor(null)"><strong>전체 접속자</strong><small>접속자마다 최근 1문제</small></button>
          <button
            v-for="option in attemptVisitorOptions"
            :key="option.visitorId"
            type="button"
            :class="{ active: selectedAttemptVisitor === option.visitorId }"
            @click="selectAttemptVisitor(option.visitorId)"
          >
            <strong>{{ option.profile?.ip_address || shortId(option.visitorId) }}</strong>
            <small>{{ option.profile ? locationLabel(option.profile) : '위치 미확인' }} · {{ option.count }}문제</small>
          </button>
        </div>
        <div class="admin-table-wrap">
          <table>
            <thead><tr><th>풀이 시각</th><th>IP 주소</th><th>종목</th><th>회차·문제</th><th>선택/정답</th><th>결과</th><th>모드</th></tr></thead>
            <tbody>
              <tr v-for="attempt in visibleAttempts" :key="attempt.id">
                <td>{{ formatDate(attempt.answered_at) }}</td><td><code>{{ attempt.ip_address || '-' }}</code></td><td>{{ attempt.qualification || '-' }}</td>
                <td>{{ attempt.round_title || '-' }} · {{ attempt.question_number }}번</td><td>{{ attempt.selected_answer }} / {{ attempt.correct_answer }}</td>
                <td><span :class="attempt.is_correct ? 'correct-chip' : 'wrong-chip'">{{ attempt.is_correct ? '정답' : '오답' }}</span></td><td>{{ attempt.mode === 'exam' ? '시험' : '학습' }}</td>
              </tr>
              <tr v-if="!visibleAttempts.length"><td colspan="7" class="empty-cell">문제 풀이 기록이 없습니다.</td></tr>
            </tbody>
          </table>
        </div>
        <button
          v-if="selectedAttemptVisitor && filteredAttempts.length > visibleAttempts.length"
          type="button"
          class="attempt-more-button"
          @click="attemptDisplayLimit += 8"
        >8문제 더 보기 ({{ visibleAttempts.length }}/{{ filteredAttempts.length }})</button>
      </section>
    </template>
  </main>
</template>
