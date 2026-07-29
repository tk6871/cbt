import { createClient } from 'npm:@supabase/supabase-js@2';

type IncomingEvent = {
  type: 'visit' | 'navigation' | 'attempt' | 'result' | 'heartbeat';
  payload: Record<string, unknown>;
};

const allowedTypes = new Set(['visit', 'navigation', 'attempt', 'result', 'heartbeat']);

function corsHeaders(request: Request): Record<string, string> {
  const configured = Deno.env.get('ALLOWED_ORIGIN') || '*';
  const origin = request.headers.get('origin') || '';
  const allowOrigin = configured === '*' || configured === origin ? (configured === '*' ? '*' : origin) : configured;
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

function text(value: unknown, max = 240): string {
  return String(value ?? '').trim().slice(0, max);
}

function integer(value: unknown, min: number, max: number): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : min;
}

function subjectScores(value: unknown): Array<{ subject: string; correct: number; total: number; score: number }> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((entry) => {
    const row = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    const total = integer(row.total, 1, 1000);
    const correct = integer(row.correct, 0, total);
    return {
      subject: text(row.subject, 120),
      correct,
      total,
      score: integer(row.score, 0, 100)
    };
  }).filter((row) => row.subject);
}

function requestIp(request: Request): string | null {
  const value = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')
    || request.headers.get('x-real-ip')
    || '';
  const first = value.split(',')[0]?.trim().replace(/^::ffff:/, '');
  return first || null;
}

type IpLocation = {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  provider: string;
};

function publicIp(value: string | null): boolean {
  if (!value) return false;
  if (value === '::1' || value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd')) return false;
  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  return !(parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168));
}

async function lookupIpLocation(ipAddress: string | null, countryCodeFallback = ''): Promise<IpLocation> {
  const fallback: IpLocation = {
    country: '',
    countryCode: countryCodeFallback,
    region: '',
    city: '',
    latitude: null,
    longitude: null,
    timezone: '',
    provider: ''
  };
  if (!publicIp(ipAddress)) return fallback;
  try {
    const fields = 'success,country,country_code,region,city,latitude,longitude,timezone,connection';
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ipAddress!)}?fields=${fields}`, {
      signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) return fallback;
    const data = await response.json();
    if (!data?.success) return fallback;
    return {
      country: text(data.country, 80),
      countryCode: text(data.country_code || countryCodeFallback, 8),
      region: text(data.region, 100),
      city: text(data.city, 100),
      latitude: Number.isFinite(Number(data.latitude)) ? Number(data.latitude) : null,
      longitude: Number.isFinite(Number(data.longitude)) ? Number(data.longitude) : null,
      timezone: text(data.timezone?.id || data.timezone, 80),
      provider: text(data.connection?.isp || data.connection?.org, 160)
    };
  } catch {
    return fallback;
  }
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: 'Server configuration missing' }, { status: 500, headers: cors });
  }

  let body: { events?: IncomingEvent[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: cors });
  }

  const events = Array.isArray(body.events) ? body.events.slice(0, 50).filter((event) => allowedTypes.has(event?.type)) : [];
  if (!events.length) return Response.json({ ok: true, accepted: 0 }, { headers: cors });

  const visitorId = text(events[0].payload?.visitorId, 100);
  if (!visitorId || events.some((event) => text(event.payload?.visitorId, 100) !== visitorId)) {
    return Response.json({ error: 'Invalid visitor' }, { status: 400, headers: cors });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const ipAddress = requestIp(request);
  const lastPayload = events[events.length - 1].payload;
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from('visitor_profiles')
    .select('*')
    .eq('visitor_id', visitorId)
    .maybeSingle();
  const ipChanged = Boolean(ipAddress && String(existing?.ip_address || '') !== ipAddress);
  const needsLocation = Boolean(ipAddress && (ipChanged || !existing?.location_country_code));
  const location = needsLocation
    ? await lookupIpLocation(ipAddress, text(request.headers.get('cf-ipcountry'), 8))
    : {
        country: text(existing?.location_country, 80),
        countryCode: text(existing?.location_country_code, 8),
        region: text(existing?.location_region, 100),
        city: text(existing?.location_city, 100),
        latitude: Number.isFinite(Number(existing?.location_latitude)) ? Number(existing.location_latitude) : null,
        longitude: Number.isFinite(Number(existing?.location_longitude)) ? Number(existing.location_longitude) : null,
        timezone: text(existing?.location_timezone, 80),
        provider: text(existing?.network_provider, 160)
      };

  const visitIncrement = events.filter((event) => event.type === 'visit').length;
  const results = events.filter((event) => event.type === 'result');
  const scores = results.map((event) => integer(event.payload.score, 0, 100));
  const lastScore = scores.length ? scores[scores.length - 1] : existing?.last_score ?? null;
  const bestScore = scores.length ? Math.max(existing?.best_score ?? 0, ...scores) : existing?.best_score ?? null;

  const { error: profileError } = await supabase.from('visitor_profiles').upsert({
    visitor_id: visitorId,
    ip_address: ipAddress,
    first_seen: existing?.first_seen || now,
    last_seen: now,
    visit_count: Number(existing?.visit_count || 0) + visitIncrement,
    attempt_count: Number(existing?.attempt_count || 0),
    correct_count: Number(existing?.correct_count || 0),
    exam_count: Number(existing?.exam_count || 0) + results.length,
    last_score: lastScore,
    best_score: bestScore,
    device_type: text(lastPayload.deviceType, 40),
    browser: text(lastPayload.browser, 60),
    last_path: text(lastPayload.view || lastPayload.path, 160),
    location_country: location.country || null,
    location_country_code: location.countryCode || null,
    location_region: location.region || null,
    location_city: location.city || null,
    location_latitude: location.latitude,
    location_longitude: location.longitude,
    location_timezone: location.timezone || null,
    network_provider: location.provider || null,
    location_updated_at: needsLocation ? now : existing?.location_updated_at || null
  });
  if (profileError) return Response.json({ error: profileError.message }, { status: 500, headers: cors });

  const visitRows = events.filter((event) => event.type === 'visit' || event.type === 'navigation').map((event) => ({
    visitor_id: visitorId,
    ip_address: ipAddress,
    event_type: event.type,
    visited_at: text(event.payload.occurredAt, 40) || now,
    path: text(event.payload.path, 160),
    view_name: text(event.payload.view, 80),
    referrer_host: text(event.payload.referrerHost, 160),
    device_type: text(event.payload.deviceType, 40),
    browser: text(event.payload.browser, 60),
    screen_width: integer(event.payload.screenWidth, 0, 10000),
    timezone: text(event.payload.timezone, 80),
    app_version: text(event.payload.appVersion, 30)
  }));

  const resultRows = results.map((event) => ({
    visitor_id: visitorId,
    ip_address: ipAddress,
    qualification_key: text(event.payload.qualificationKey, 60),
    qualification: text(event.payload.qualification, 120),
    round_id: text(event.payload.roundId, 120),
    title: text(event.payload.title, 240),
    mode: text(event.payload.mode, 30),
    score: integer(event.payload.score, 0, 100),
    correct_count: integer(event.payload.correct, 0, 1000),
    total_count: integer(event.payload.total, 1, 1000),
    unanswered_count: integer(event.payload.unanswered, 0, 1000),
    duration_seconds: integer(event.payload.durationSeconds, 0, 86400),
    subject_scores: subjectScores(event.payload.subjects),
    completed_at: text(event.payload.occurredAt, 40) || now
  }));

  const inserts = [];
  if (visitRows.length) inserts.push(supabase.from('visit_events').insert(visitRows));
  if (resultRows.length) inserts.push(supabase.from('exam_results').insert(resultRows));
  const responses = await Promise.all(inserts);
  const insertError = responses.find((response) => response.error)?.error;
  if (insertError) return Response.json({ error: insertError.message }, { status: 500, headers: cors });

  return Response.json({ ok: true, accepted: events.length }, { headers: cors });
});
