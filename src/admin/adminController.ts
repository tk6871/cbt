import {adminPages, adminHref, type AdminSection} from './navigation';
import { computed, nextTick, proxyRefs, ref, createObservers, mutableRef } from '../cbt/controllerSignals';
import { createClient, type RealtimeChannel, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { animate, stagger } from 'motion';
import { adminViewLabel as viewLabel, issueImageUrl, issueTypeLabel, issueStatusLabel, seoulDayStart, resultModeLabel, resultResponseLabel, paginate } from './presentation';

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
  subject_scores: Array<{
    subject: string;
    correct: number;
    total: number;
    score: number;
  }> | null;
  completed_at: string;
};

export type QuestionIssueStatus = 'open' | 'reviewing' | 'resolved' | 'deferred';

type AdminPermissions = {
  viewAnalytics: boolean;
  manageIssues: boolean;
  viewMembers: boolean;
  manageMembers: boolean;
};
type AdminAccess = {
  userId: string;
  role: 'super_admin' | 'admin';
  permissions: AdminPermissions;
};
type SyncAccountRow = {
  userId: string;
  username: string;
  email: string | null;
  accountType: 'site_id' | 'email';
  createdAt: string;
  updatedAt: string;
  lastSignInAt: string | null;
  role: 'super_admin' | 'admin' | null;
  permissions: AdminPermissions;
};
type IssuedCredentials = {
  username: string;
  temporaryPassword: string;
  recoveryCode: string;
};
export type QuestionIssueReport = {
  id: number;
  space: 'industrial' | 'jewelry';
  qualification_key: string;
  qualification: string | null;
  round_id: string;
  round_title: string | null;
  round_year: number | null;
  round_session: string | null;
  question_id: string;
  question_number: number;
  display_number: number | null;
  subject: string | null;
  issue_types: string[];
  details: string;
  question_text: string | null;
  choices_snapshot: string[] | null;
  configured_answer: number | null;
  source_image: string | null;
  page_url: string | null;
  app_version: string | null;
  device_info: string | null;
  status: QuestionIssueStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export function createAdminController() {
const observers=createObservers();
const watch=observers.observe;
const config = window.CBT_CLOUD_CONFIG;
const configured = Boolean(config?.enabled && config.supabaseUrl && config.supabaseAnonKey);
const client = ref<SupabaseClient | null>(configured ? createClient(config!.supabaseUrl, config!.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true }
}) : null);
const session = ref<Session | null>(null);
const adminAccess = ref<AdminAccess | null>(null);
const email = ref('');
const password = ref('');
const loginError = ref('');
const dataError = ref('');
const loading = ref(false);
const days = ref(30);
const visitors = ref<VisitorProfile[]>([]);
const visits = ref<Visit[]>([]);
const results = ref<ExamResult[]>([]);
const issueReports = mutableRef<QuestionIssueReport[]>([]);
const issueStatusFilter = ref<'all' | QuestionIssueStatus>('open');
type IssuePatch = Partial<Pick<QuestionIssueReport, 'status' | 'admin_note'>>;
const issueSaving = mutableRef<Record<number, boolean>>({});
const issueSavingId = computed(() => Number(Object.keys(issueSaving.value).find(id => issueSaving.value[Number(id)])) || null);
const issueDrafts = mutableRef<Record<number, string>>({});
const issueMessages = mutableRef<Record<number, string>>({});
const issueFailed = mutableRef<Record<number, IssuePatch>>({});
const issueQueues = new Map<number, Promise<void>>();
const operationAborts = new Set<AbortController>();
let authEpoch = 0;
let accountRequestId = 0;
let issueRevision = 0;
let authSubscription: { unsubscribe(): void } | null = null;
const syncAccounts = ref<SyncAccountRow[]>([]);
const accountLoading = ref(false);
const accountError = ref('');
const issuedCredentials = ref<IssuedCredentials | null>(null);
const accountSearch = ref('');
const accountPage = ref(1);
watch(accountSearch, () => { accountPage.value = 1; });
const roleSavingId = ref<string | null>(null);
const realtimeStatus = ref<'connecting' | 'connected' | 'error' | 'closed'>('connecting');
const realtimeUpdatedAt = ref<string | null>(null);
const clockNow = ref(Date.now());
const activeSection = ref<AdminSection>('overview');
const followupTarget = ref('');
const followupQueue = ref('');
const lastLoadedAt = ref<string | null>(null);
const loadedDays = ref(30);
const dataLoading = ref(false);
const resultSearch = ref('');
const resultMode = ref('all');
const resultPage = ref(1);
const issueSearch = ref('');
const visitorSearch = ref('');
const displayedVisitors = computed(() => {
  const needle = visitorSearch.value.trim().toLocaleLowerCase('ko-KR');
  if (!needle) return visitors.value;
  return visitors.value.filter(row => [row.visitor_id, row.ip_address, row.browser, row.device_type, locationLabel(row)]
    .some(value => value?.toLocaleLowerCase('ko-KR').includes(needle)));
});
let dataRequestId = 0;
let dataAbort: AbortController | null = null;
const issueWorkspaceOpen = ref(false);
let realtimeChannel: RealtimeChannel | null = null;
let realtimeReloadTimer: number | null = null;
let clockTimer: number | null = null;
let autoRefreshTimer: number | null = null;

const activeVisitors = computed(() => {
  const since = clockNow.value - (3 * 60 + 15) * 1000;
  return visitors.value.filter((item) => new Date(item.last_seen).getTime() >= since);
});
const activeNow = computed(() => activeVisitors.value.length);
const activeToday = computed(() => {
  const since = seoulDayStart(clockNow.value);
  return new Set(visits.value.filter((item) => new Date(item.visited_at).getTime() >= since).map((item) => item.visitor_id)).size;
});
const answeredTotal = computed(() => results.value.reduce(
  (sum, item) => sum + Math.max(0, Number(item.total_count || 0) - Number(item.unanswered_count || 0)),
  0
));
const averageScore = computed(() => results.value.length
  ? Math.round(results.value.reduce((sum, item) => sum + Number(item.score || 0), 0) / results.value.length)
  : 0);
const openIssueCount = computed(() => issueReports.value.filter((item) => item.status === 'open').length);
const completedResultCount = computed(() => results.value.filter((item) => !item.unanswered_count).length);
const interruptedResultCount = computed(() => results.value.filter((item) => item.unanswered_count > 0).length);
const recentOpenIssues = computed(() => issueReports.value.filter((item) => item.status === 'open').slice(0, 5));
const recentResults = computed(() => results.value.slice(0, 6));
const displayedIssueReports = computed(() => issueReports.value.filter(item =>
  (issueStatusFilter.value === 'all' || item.status === issueStatusFilter.value)
  && `${item.id} ${item.qualification || item.qualification_key} ${item.round_title || ''} ${item.question_number} ${item.question_text || ''} ${item.details}`.toLocaleLowerCase('ko-KR').includes(issueSearch.value.trim().toLocaleLowerCase('ko-KR'))));
const filteredResults = computed(() => results.value.filter(item =>
  (resultMode.value === 'all' || item.mode === resultMode.value)
  && `${item.qualification || ''} ${item.title || ''}`.toLocaleLowerCase('ko-KR').includes(resultSearch.value.trim().toLocaleLowerCase('ko-KR'))));
const resultPagination = computed(() => paginate(filteredResults.value, resultPage.value));
watch([resultSearch, resultMode, days], () => { resultPage.value = 1; });
const realtimeLabel = computed(() => ({
  connecting: '실시간 연결 중',
  connected: '실시간 연결됨',
  error: '실시간 연결 오류',
  closed: '실시간 연결 종료'
}[realtimeStatus.value]));
const isSuperAdmin = computed(() => adminAccess.value?.role === 'super_admin');
const canViewAnalytics = computed(() => adminAccess.value?.permissions.viewAnalytics === true);
const canManageIssues = computed(() => adminAccess.value?.permissions.manageIssues === true);
const canViewMembers = computed(() => adminAccess.value?.permissions.viewMembers === true);
const canManageMembers = computed(() => adminAccess.value?.permissions.manageMembers === true);
const displayedSyncAccounts = computed(() => {
  const keyword = accountSearch.value.trim().toLocaleLowerCase('ko-KR');
  if (!keyword) return syncAccounts.value;
  return syncAccounts.value.filter((account) => `${account.username} ${account.email || ''}`.toLocaleLowerCase('ko-KR').includes(keyword));
});

const accountPagination = computed(() => paginate(displayedSyncAccounts.value, accountPage.value, 25));

const allowedPages = computed(() => adminPages.filter(page => adminAccess.value?.permissions[page.permission] || (page.id === 'overview' && canViewMembers.value)));

function applyLocation(focus: boolean): void {
  const [route,search] = location.hash.split('?');
  const page = allowedPages.value.find(item => adminHref(item.id) === route) || allowedPages.value[0];
  if (!page) return;
  const params = new URLSearchParams(search);
  const member = params.get('member') || '';
  const queue = params.get('queue') || '';
  followupTarget.value = page.id === 'member-followups' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(member) ? member : '';
  followupQueue.value = page.id === 'member-followups' && ['mine','unassigned'].includes(queue) ? queue : '';
  const suffix = followupTarget.value ? '?member='+followupTarget.value : followupQueue.value ? '?queue='+followupQueue.value : '';
  const canonical = adminHref(page.id)+suffix;
  if (location.hash !== canonical) history.replaceState(history.state, '', canonical);
  activeSection.value = page.id;
  document.title = page.title + ' · CBT 관리자 센터';
  if ((page.id === 'accounts' || page.id === 'member-followups') && !syncAccounts.value.length && !accountLoading.value) void loadSyncAccounts();
  if (focus) requestAnimationFrame(() => document.getElementById('admin-page-title')?.focus());
}

function handleHashChange(): void { applyLocation(true); }

function openSection(section: AdminSection): void {
  if (!allowedPages.value.some(page => page.id === section)) return;
  if (location.hash !== adminHref(section)) history.pushState(null, '', adminHref(section));
  applyLocation(true);
}

function showIssues(status: QuestionIssueStatus): void {
  issueStatusFilter.value = status;
  issueSearch.value = '';
  issueWorkspaceOpen.value = false;
  openSection('issues');
}

async function reviewToken():Promise<string>{
  const result=await client.value?.auth.getSession();
  return result?.data.session?.user.id === session.value?.user.id ? result?.data.session?.access_token ?? '' : '';
}
async function accountRequest(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!config || !session.value || !client.value) return { error: '관리자 로그인이 필요합니다.' };
  const epoch = authEpoch;
  const userId = session.value.user.id;
  const abort = new AbortController();
  operationAborts.add(abort);
  const timeout = window.setTimeout(() => abort.abort(), 20_000);
  try {
    // Read the SDK's refreshed token; server authorization remains mandatory.
    const { data, error } = await client.value.auth.getSession();
    if (epoch !== authEpoch || abort.signal.aborted || error || !data.session || data.session.user.id !== userId) return { error: '로그인 상태를 다시 확인해 주세요.' };
    session.value = data.session;
    const response = await fetch(`${config.supabaseUrl.replace(/\/$/, '')}/functions/v1/sync-account`, {
      method: 'POST',
      signal: abort.signal,
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${session.value.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const result = await response.json() as Record<string, unknown>;
    if (epoch !== authEpoch) return { error: '로그인 상태가 변경되었습니다.' };
    return response.ok ? result : { error: String(result.error || '회원 계정 요청을 처리하지 못했습니다.') };
  } catch {
    return { error: '서버 응답을 확인하지 못했습니다. 목록을 새로고침해 처리 결과를 확인한 뒤 다시 시도해 주세요.' };
  } finally {
    window.clearTimeout(timeout);
    operationAborts.delete(abort);
  }
}

async function loadSyncAccounts(preserveMessage = false): Promise<void> {
  const requestId = ++accountRequestId;
  const epoch = authEpoch;
  accountLoading.value = true;
  if (!preserveMessage) accountError.value = '';
  const accounts = new Map<string, SyncAccountRow>();
  const seenCursors = new Set<string>();
  let cursor: {createdAt:string; userId:string} | null = null;
  for (;;) {
    const result = await accountRequest({action:'admin-list', pageSize:200, cursor});
    if (epoch !== authEpoch || requestId !== accountRequestId) return;
    if (result.error || !Array.isArray(result.accounts)) {
      accountError.value = String(result.error || '회원 목록 응답을 확인해 주세요.');
      break;
    }
    for (const account of result.accounts as SyncAccountRow[]) accounts.set(account.userId, account);
    if (result.nextCursor == null) {
      if (result.nextCursor === undefined && result.accounts.length >= 1000) {
        accountError.value = '전체 회원을 조회하려면 관리자 서버를 업데이트해 주세요.';
        break;
      }
      syncAccounts.value = [...accounts.values()];
      break;
    }
    const next = result.nextCursor as {createdAt:string; userId:string};
    if (!next?.createdAt || !next.userId || seenCursors.has(next.userId)) {
      accountError.value = '회원 목록의 다음 페이지를 확인할 수 없습니다. 다시 조회해 주세요.';
      break;
    }
    seenCursors.add(next.userId);
    cursor = next;
  }
  accountLoading.value = false;
}

async function loadAdminSession(): Promise<boolean> {
  const epoch = authEpoch;
  const result = await accountRequest({ action: 'admin-session' });
  if (epoch !== authEpoch || !session.value) return false;
  if (result.error || !result.access) {
    loginError.value = result.error ? String(result.error) : '관리자 권한이 없는 계정입니다.';
    return false;
  }
  adminAccess.value = result.access as unknown as AdminAccess;
  if (!allowedPages.value.length) {
    loginError.value = '조회할 수 있는 관리자 메뉴가 없습니다.';
    return false;
  }
  applyLocation(false);
  return true;
}

async function saveAccountRole(account: SyncAccountRow): Promise<void> {
  if (!isSuperAdmin.value || account.userId === adminAccess.value?.userId) return;
  const epoch = authEpoch;
  roleSavingId.value = account.userId;
  accountError.value = '';
  const result = await accountRequest({
    action: 'admin-set-role',
    userId: account.userId,
    role: account.role || 'none',
    permissions: account.permissions,
  });
  if (epoch !== authEpoch) return;
  roleSavingId.value = null;
  if (result.error) {
    accountError.value = String(result.error);
    await loadSyncAccounts(true);
    return;
  }
  accountError.value = `${account.username} 계정 권한을 저장했습니다.`;
  await loadSyncAccounts(true);
}

async function issueTemporaryPassword(account: SyncAccountRow): Promise<void> {
  const epoch = authEpoch;
  accountLoading.value = true;
  accountError.value = '';
  issuedCredentials.value = null;
  const result = await accountRequest({ action: 'admin-temp-password', username: account.username });
  if (epoch !== authEpoch) return;
  accountLoading.value = false;
  if (result.error) {
    accountError.value = String(result.error);
    return;
  }
  issuedCredentials.value = result as unknown as IssuedCredentials;
  await loadSyncAccounts();
}

async function copyCredentials(): Promise<void> {
  if (!issuedCredentials.value) return;
  const value = `아이디: ${issuedCredentials.value.username}\n임시 비밀번호: ${issuedCredentials.value.temporaryPassword}\n새 복구코드: ${issuedCredentials.value.recoveryCode}`;
  try {
    await navigator.clipboard.writeText(value);
    accountError.value = '임시 로그인 정보를 복사했습니다.';
  } catch {
    accountError.value = '자동 복사가 되지 않았습니다. 화면의 값을 직접 복사해 주세요.';
  }
}

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

async function internalEmail(usernameKey: string): Promise<string> {
  const source = new TextEncoder().encode(`cbt-sync:${usernameKey}`);
  const digest = await crypto.subtle.digest('SHA-256', source);
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hash.slice(0, 40)}@accounts.cbt.invalid`;
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

async function updateIssueReport(report: QuestionIssueReport, patch: IssuePatch): Promise<void> {
  if (!client.value || !session.value || !canManageIssues.value) return;
  const epoch = authEpoch;
  const id = report.id;
  issueSaving.value[id] = true;
  // Serialize changes to the same report; different reports may save independently.
  const task = (issueQueues.get(id) || Promise.resolve()).then(async () => {
    if (epoch !== authEpoch || !client.value || !session.value) return;
    const current = issueReports.value.find(item => item.id === id) || report;
    const nextStatus = patch.status || current.status;
    const values = { ...patch, updated_at: new Date().toISOString(), resolved_at: nextStatus === 'resolved' ? (current.resolved_at || new Date().toISOString()) : null };
    const abort = new AbortController();
    operationAborts.add(abort);
    const timeout = window.setTimeout(() => abort.abort(), 20_000);
    issueMessages.value[id] = '저장 중…';
    try {
      const { data, error } = await client.value.from('question_issue_reports').update(values).eq('id', id)
        .select('id,status,admin_note,updated_at,resolved_at').abortSignal(abort.signal).single();
      if (epoch !== authEpoch) return;
      if (error || !data || data.id !== id) throw new Error('Save not confirmed');
      issueRevision += 1;
      Object.assign(current, data);
      if ('admin_note' in patch && (issueDrafts.value[id]?.trim() || null) === patch.admin_note) delete issueDrafts.value[id];
      const failed = issueFailed.value[id];
      if (failed) {
        for (const key of Object.keys(patch) as (keyof IssuePatch)[]) delete failed[key];
        if (!Object.keys(failed).length) delete issueFailed.value[id];
      }
      issueMessages.value[id] = issueFailed.value[id] ? '일부 변경 미저장 · 다시 저장해 주세요.' : '저장 완료';
    } catch {
      if (epoch !== authEpoch) return;
      issueFailed.value[id] = { ...issueFailed.value[id], ...patch };
      issueMessages.value[id] = '저장 확인 실패 · 입력은 유지됩니다. 연결·권한 확인 후 다시 저장해 주세요.';
    } finally {
      window.clearTimeout(timeout);
      operationAborts.delete(abort);
    }
  });
  issueQueues.set(id, task);
  await task;
  if (epoch === authEpoch && issueQueues.get(id) === task) {
    issueQueues.delete(id);
    issueSaving.value[id] = false;
  }
}

function saveIssueNote(report: QuestionIssueReport): void {
  const draft = issueDrafts.value[report.id];
  if (draft === undefined) return;
  void updateIssueReport(report, { admin_note: draft.trim() || null });
}

function retryIssue(report: QuestionIssueReport): void {
  const patch = { ...issueFailed.value[report.id] };
  if (issueDrafts.value[report.id] !== undefined) patch.admin_note = issueDrafts.value[report.id]!.trim() || null;
  if (Object.keys(patch).length) void updateIssueReport(report, patch);
}

function exportIssueReports(): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    filter: issueStatusFilter.value,
    count: displayedIssueReports.value.length,
    reports: displayedIssueReports.value,
  };
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cbt-question-issues-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function submitCredentials(user:string,pw:string){
  email.value=user;password.value=pw;
  void login().finally(()=>{password.value=''});
}
async function login(): Promise<void> {
  if (!client.value) return;
  const epoch = authEpoch;
  loginError.value = '';
  loading.value = true;
  try {
  const loginId = email.value.normalize('NFKC').trim();
  const loginEmail = loginId.includes('@') ? loginId : await internalEmail(loginId.toLocaleLowerCase('ko-KR'));
  const { data, error } = await client.value.auth.signInWithPassword({
    email: loginEmail,
    password: password.value
  });
  if (epoch !== authEpoch) return;
  loading.value = false;
  if (error || !data.session) {
    loginError.value = '로그인 정보를 확인해 주세요.';
    return;
  }
  session.value = data.session;
  if (!await loadAdminSession()) {
    if (epoch !== authEpoch) return;
    const reason = loginError.value;
    await client.value.auth.signOut();
    session.value = null;
    loginError.value = reason;
    return;
  }
  await loadData();
  startRealtime();
  startAutoRefresh();
  } catch {
    if (epoch === authEpoch) loginError.value = '연결을 확인한 뒤 다시 로그인해 주세요.';
  } finally {
    if (epoch === authEpoch) loading.value = false;
  }
}

function clearAdminState(): void {
  authEpoch += 1;
  accountRequestId += 1;
  for (const abort of operationAborts) abort.abort();
  operationAborts.clear();
  issueQueues.clear();
  issueSaving.value = {};
  issueDrafts.value = {};
  issueFailed.value = {};
  issueMessages.value = {};
  accountLoading.value = false;
  loading.value = false;
  roleSavingId.value = null;
  accountError.value = '';
  visitorSearch.value = '';
  dataRequestId += 1;
  dataAbort?.abort();
  dataLoading.value = false;
  lastLoadedAt.value = null;
  dataError.value = '';
  stopRealtime();
  session.value = null;
  document.title = 'CBT 관리자 센터';
  adminAccess.value = null;
  visitors.value = [];
  visits.value = [];
  results.value = [];
  issueReports.value = [];
  syncAccounts.value = [];
  accountSearch.value = '';
  accountPage.value = 1;
  issuedCredentials.value = null;
  if (autoRefreshTimer !== null) {
    window.clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

async function logout(): Promise<void> {
  if (hasUnsavedNotes() && !window.confirm('저장되지 않은 메모가 있습니다. 로그아웃하면 입력 내용이 사라집니다. 로그아웃할까요?')) return;
  clearAdminState();
  await client.value?.auth.signOut();
}

function hasUnsavedNotes(): boolean {
  return Object.keys(issueDrafts.value).length > 0 || Object.keys(issueFailed.value).length > 0 || issueSavingId.value !== null;
}

function warnUnsavedNotes(event: BeforeUnloadEvent): void {
  if (!hasUnsavedNotes()) return;
  event.preventDefault();
  event.returnValue = '';
}

async function loadData(options: { silent?: boolean } = {}): Promise<void> {
  if (!client.value || !session.value) return;
  const silent = options.silent === true;
  if (silent && (dataLoading.value || document.hidden || issueSavingId.value !== null || document.activeElement?.matches('textarea'))) return;
  const requestId = ++dataRequestId;
  dataAbort?.abort();
  const abort = new AbortController();
  dataAbort = abort;
  const timeout = window.setTimeout(() => abort.abort(), 20_000);
  dataLoading.value = true;
  dataError.value = '';
  const requestedDays = days.value;
  const requestedIssueRevision = issueRevision;
  const since = new Date(Date.now() - requestedDays * 24 * 60 * 60 * 1000).toISOString();
  try {
    const responses = await Promise.allSettled([
      canViewAnalytics.value ? client.value.from('visitor_profiles').select('*').order('last_seen', { ascending: false }).limit(300).abortSignal(abort.signal) : null,
      canViewAnalytics.value ? client.value.from('visit_events').select('id,visitor_id,visited_at,device_type,browser,path').gte('visited_at', since).order('visited_at', { ascending: false }).limit(3000).abortSignal(abort.signal) : null,
      canViewAnalytics.value ? client.value.from('exam_results').select('*').gte('completed_at', since).order('completed_at', { ascending: false }).limit(1000).abortSignal(abort.signal) : null,
      canManageIssues.value ? client.value.from('question_issue_reports').select('*').order('created_at', { ascending: false }).limit(1000).abortSignal(abort.signal) : null,
    ]);
    if (requestId !== dataRequestId || !session.value) return;
    const failed = responses.flatMap((response, index) => response.status === 'rejected' || response.value?.error
      ? [['접속 현황', '방문 기록', '학습 결과', '문제 제보'][index]] : []);
    if (failed.length) {
      dataError.value = `${failed.join('·')} 조회에 실패했습니다. 연결 상태를 확인하고 새로고침해 주세요.${lastLoadedAt.value ? ` 마지막 성공한 ${loadedDays.value}일 기준 자료를 유지합니다.` : ' 아직 조회된 자료가 없습니다.'}`;
      return;
    }
    const data = responses.map(response => response.status === 'fulfilled' ? response.value?.data || [] : []);
    visitors.value = data[0] as VisitorProfile[];
    visits.value = data[1] as Visit[];
    results.value = data[2] as ExamResult[];
    if (requestedIssueRevision === issueRevision) issueReports.value = (data[3] as QuestionIssueReport[]).map(report => {
      // Do not replace a row while its save is in flight.
      const existing = issueReports.value.find(item => item.id === report.id);
      return existing && (issueSaving.value[report.id] || issueDrafts.value[report.id] !== undefined || issueFailed.value[report.id]) ? existing : report;
    });
    loadedDays.value = requestedDays;
    lastLoadedAt.value = new Date().toISOString();
    await nextTick();
    if (!silent && canViewAnalytics.value) animate('.admin-stat-card', {
      opacity: [0, 1], transform: ['translateY(12px)', 'translateY(0px)'],
    }, { duration: 0.35, delay: stagger(0.055) });
  } finally {
    window.clearTimeout(timeout);
    if (requestId === dataRequestId) dataLoading.value = false;
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
  if (!canViewAnalytics.value && !canManageIssues.value) return;
  realtimeStatus.value = 'connecting';
  const channel = client.value.channel(`cbt-admin-live-${session.value.user.id}`);
  if (canViewAnalytics.value) {
    channel.on('postgres_changes', {event:'*', schema:'public', table:'visitor_profiles'}, scheduleRealtimeReload)
      .on('postgres_changes', {event:'INSERT', schema:'public', table:'visit_events'}, scheduleRealtimeReload)
      .on('postgres_changes', {event:'INSERT', schema:'public', table:'exam_results'}, scheduleRealtimeReload);
  }
  if (canManageIssues.value) {
    channel.on('postgres_changes', {event:'*', schema:'public', table:'question_issue_reports'}, scheduleRealtimeReload);
  }
  realtimeChannel = channel;
  channel.subscribe((status) => {
      if (realtimeChannel !== channel) return;
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

async function start() {
  observers.start();
  if (!client.value) return;
  window.addEventListener('hashchange', handleHashChange);
  window.addEventListener('beforeunload', warnUnsavedNotes);
  authSubscription = client.value.auth.onAuthStateChange((event, nextSession) => {
    // Keep this callback synchronous; never await another Auth call inside it.
    if (event === 'SIGNED_OUT' || (session.value && nextSession && session.value.user.id !== nextSession.user.id)) {
      clearAdminState();
      loginError.value = '로그인 상태가 변경되었습니다. 다시 로그인해 주세요.';
    } else if (nextSession && session.value?.user.id === nextSession.user.id) {
      session.value = nextSession;
    }
  }).data.subscription;
  const epoch = authEpoch;
  const { data } = await client.value.auth.getSession();
  if (epoch !== authEpoch) return;
  if (data.session) {
    session.value = data.session;
    if (!await loadAdminSession()) {
      if (epoch !== authEpoch) return;
      const reason = loginError.value;
      await client.value.auth.signOut();
      session.value = null;
      loginError.value = reason;
    }
  }
  if (session.value) {
    await loadData();
    startRealtime();
    startAutoRefresh();
  }
  clockTimer = window.setInterval(() => {
    clockNow.value = Date.now();
  }, 30_000);
}

function stop() {
  observers.stop();
  window.removeEventListener('hashchange', handleHashChange);
  window.removeEventListener('beforeunload', warnUnsavedNotes);
  authSubscription?.unsubscribe();
  clearAdminState();
  if (clockTimer !== null) window.clearInterval(clockTimer);
  if (autoRefreshTimer !== null) window.clearInterval(autoRefreshTimer);
}
const adminHeaderModel=proxyRefs({
  allowedPages,
  activeNow,
  activeSection,
  activeToday,
  answeredTotal,
  averageScore,
  canManageIssues,
  canViewAnalytics,
  canViewMembers,
  completedResultCount,
  dataError,
  dataLoading,
  days,
  formatDate,
  interruptedResultCount,
  isSuperAdmin,
  lastLoadedAt,
  loadData,
  loadedDays,
  logout,
  openIssueCount,
  openSection,
  realtimeLabel,
  realtimeStatus,
  results,
  session,
  visitors
});

const adminOverviewModel=proxyRefs({
  activeNow,
  activeVisitors,
  canManageIssues,
  formatDate,
  issueTypeLabel,
  locationLabel,
  openSection,
  recentOpenIssues,
  recentResults,
  resultModeLabel,
  results,
  viewLabel,
  visits
});

const adminIssuesModel=proxyRefs({
  issueReports, showIssues,
  canManageIssues,
  config,
  displayedIssueReports,
  exportIssueReports,
  formatDate,
  issueDrafts,
  issueFailed,
  issueImageUrl,
  issueMessages,
  issueSaving,
  issueSearch,
  issueStatusFilter,
  issueStatusLabel,
  issueTypeLabel,
  issueWorkspaceOpen,
  retryIssue,
  reviewToken,
  saveIssueNote,
  session,
  updateIssueReport
});

const adminVisitorsModel=proxyRefs({
  visitorSearch, displayedVisitors,
  formatDate,
  locationDetail,
  locationLabel,
  realtimeUpdatedAt,
  shortId,
  visitors
});

const adminResultsModel=proxyRefs({
  dataError,
  filteredResults,
  formatDate,
  loadedDays,
  resultMode,
  resultModeLabel,
  resultPage,
  resultPagination,
  resultResponseLabel,
  resultSearch,
  results
});

const adminAccountsModel=proxyRefs({
  client, syncAccounts,
  accountError,
  accountLoading,
  accountSearch, accountPage, accountPagination,
  adminAccess,
  canManageMembers,
  copyCredentials,
  displayedSyncAccounts,
  formatDate,
  isSuperAdmin,
  issueTemporaryPassword,
  issuedCredentials,
  loadSyncAccounts,
  roleSavingId,
  saveAccountRole
});

return { start, stop, access: proxyRefs({configured, session, loading, loginError, submitCredentials, canViewAnalytics, canManageIssues, canViewMembers, activeSection, followupTarget, followupQueue}),
adminHeaderModel, adminOverviewModel, adminIssuesModel, adminVisitorsModel, adminResultsModel, adminAccountsModel };
}

export type AdminHeaderModel = ReturnType<typeof createAdminController>['adminHeaderModel'];
export type AdminOverviewModel = ReturnType<typeof createAdminController>['adminOverviewModel'];
export type AdminIssuesModel = ReturnType<typeof createAdminController>['adminIssuesModel'];
export type AdminVisitorsModel = ReturnType<typeof createAdminController>['adminVisitorsModel'];
export type AdminResultsModel = ReturnType<typeof createAdminController>['adminResultsModel'];
export type AdminAccountsModel = ReturnType<typeof createAdminController>['adminAccountsModel'];
