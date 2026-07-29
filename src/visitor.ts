import Dexie, { type EntityTable } from 'dexie';

type AnalyticsEventType = 'visit' | 'navigation' | 'attempt' | 'result' | 'heartbeat';

type QueuedEvent = {
  id: string;
  type: AnalyticsEventType;
  createdAt: number;
  payload: Record<string, unknown>;
};

class AnalyticsQueue extends Dexie {
  queue!: EntityTable<QueuedEvent, 'id'>;

  constructor() {
    super('industrial-cbt-analytics');
    this.version(1).stores({
      queue: 'id, type, createdAt'
    });
  }
}

const db = new AnalyticsQueue();
const config = window.CBT_CLOUD_CONFIG;
const enabled = Boolean(config?.enabled && config.supabaseUrl && config.supabaseAnonKey);
const VISITOR_KEY = 'unified-cbt-visitor-id';
const SESSION_KEY = 'unified-cbt-session-id';
const LAST_VISIT_KEY = 'unified-cbt-last-visit-event';
const LAST_NAV_KEY = 'unified-cbt-last-navigation-event';
const HEARTBEAT_INTERVAL = 3 * 60 * 1000;
const BATCH_LIMIT = 20;
let flushing = false;
let currentView = '';

function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function persistentId(key: string, storage: Storage): string {
  try {
    const saved = storage.getItem(key);
    if (saved) return saved;
    const value = randomId();
    storage.setItem(key, value);
    return value;
  } catch {
    return randomId();
  }
}

const visitorId = persistentId(VISITOR_KEY, localStorage);
const sessionId = persistentId(SESSION_KEY, sessionStorage);

function deviceType(): string {
  const width = Math.min(screen.width || innerWidth, innerWidth || screen.width);
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua) || (ua.includes('android') && width >= 600)) return '태블릿';
  if (/iphone|android|mobile/.test(ua) || width < 600) return '휴대폰';
  return 'PC';
}

function browserName(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/SamsungBrowser\//.test(ua)) return 'Samsung Internet';
  if (/CriOS\//.test(ua)) return 'Chrome iOS';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/FxiOS\//.test(ua) || /Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  return '기타';
}

function appVersion(): string {
  const changelog = (window as Window & { CBT_CHANGELOG?: { versions?: { industrial?: string } } }).CBT_CHANGELOG;
  return changelog?.versions?.industrial || '';
}

function commonPayload(): Record<string, unknown> {
  return {
    visitorId,
    sessionId,
    occurredAt: new Date().toISOString(),
    path: location.pathname,
    pageTitle: document.title.slice(0, 180),
    referrerHost: (() => {
      try { return document.referrer ? new URL(document.referrer).host : ''; }
      catch { return ''; }
    })(),
    deviceType: deviceType(),
    browser: browserName(),
    screenWidth: Math.round(innerWidth),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    appVersion: appVersion()
  };
}

async function enqueue(type: AnalyticsEventType, payload: Record<string, unknown> = {}): Promise<void> {
  if (!enabled) return;
  await db.queue.put({
    id: randomId(),
    type,
    createdAt: Date.now(),
    payload: { ...commonPayload(), ...payload }
  });
  const queued = await db.queue.count();
  if (type === 'result' || queued >= BATCH_LIMIT) void flush();
}

async function flush(): Promise<void> {
  if (!enabled || flushing || !navigator.onLine || !config) return;
  flushing = true;
  try {
    const batch = await db.queue.orderBy('createdAt').limit(50).toArray();
    if (!batch.length) return;
    const functionName = config.analyticsFunction || 'cbt-analytics';
    const response = await fetch(`${config.supabaseUrl.replace(/\/$/, '')}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`
      },
      body: JSON.stringify({
        events: batch.map(({ type, payload }) => ({ type, payload }))
      }),
      keepalive: true
    });
    if (!response.ok) return;
    await db.queue.bulkDelete(batch.map((item) => item.id));
    if (await db.queue.count()) void flush();
  } catch {
    // Offline queues are intentionally retained in IndexedDB for the next connection.
  } finally {
    flushing = false;
  }
}

function shouldLog(key: string, intervalMs: number): boolean {
  try {
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < intervalMs) return false;
    localStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

window.CBTAnalytics = {
  trackAttempt() {
    // 이전 캐시와의 호환용입니다. 문제별 선택은 서버로 전송하지 않습니다.
  },
  trackResult(payload) {
    void enqueue('result', payload as unknown as Record<string, unknown>);
  },
  trackNavigation(view) {
    currentView = String(view).slice(0, 80);
    if (!shouldLog(LAST_NAV_KEY, 10 * 60 * 1000)) return;
    void enqueue('navigation', { view: currentView });
  },
  consent() {
    return enabled ? '자동 기록 사용 중' : '클라우드 기록 꺼짐';
  },
  revokeConsent() {
    // Kept for backwards-compatible settings UI. Tracking is controlled by cloud-config.js.
  }
};

if (enabled) {
  if (shouldLog(LAST_VISIT_KEY, 30 * 60 * 1000)) void enqueue('visit');
  window.addEventListener('online', () => void flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (navigator.onLine) void enqueue('heartbeat', { view: currentView });
      void flush();
    }
  });
  setInterval(() => {
    if (document.visibilityState === 'visible' && navigator.onLine) void enqueue('heartbeat', { view: currentView });
  }, HEARTBEAT_INTERVAL);
  setInterval(() => void flush(), HEARTBEAT_INTERVAL);
  window.addEventListener('pagehide', () => void flush());
  if (document.visibilityState === 'visible' && navigator.onLine) void enqueue('heartbeat', { view: currentView });
  window.setTimeout(() => void flush(), 1_500);
}
