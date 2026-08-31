import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

type RequestBody = {
  action?: string;
  username?: string;
  password?: string;
  recoveryCode?: string;
};

type RecoveryRow = {
  user_id: string;
  username_key: string;
  username_display: string;
  recovery_hash: string;
  created_at: string;
  updated_at: string;
};

const usernamePattern = /^[\p{L}\p{N}][\p{L}\p{N}._-]{3,23}$/u;
const recoveryAlphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const passwordAlphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function corsHeaders(request: Request): Record<string, string> {
  const configured = Deno.env.get('ALLOWED_ORIGIN') || '*';
  const origin = request.headers.get('origin') || '';
  const allowOrigin = configured === '*' || configured === origin ? (configured === '*' ? '*' : origin) : configured;
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(request: Request, body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders(request) });
}

function normalizeUsername(value: unknown): { key: string; display: string } | null {
  const display = String(value ?? '').normalize('NFKC').trim();
  const key = display.toLocaleLowerCase('ko-KR');
  return usernamePattern.test(key) ? { key, display } : null;
}

function normalizeRecoveryCode(value: unknown): string {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 72;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomString(length: number, alphabet: string): string {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return [...values].map((value) => alphabet[value % alphabet.length]).join('');
}

function newRecoveryCode(): string {
  return randomString(20, recoveryAlphabet).match(/.{1,5}/g)!.join('-');
}

function newTemporaryPassword(): string {
  return `Cbt!${randomString(14, passwordAlphabet)}`;
}

async function internalEmail(usernameKey: string): Promise<string> {
  const digest = await sha256(`cbt-sync:${usernameKey}`);
  return `${digest.slice(0, 40)}@accounts.cbt.invalid`;
}

function serviceKey(): string {
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys);
      if (Array.isArray(parsed) && typeof parsed[0] === 'string') return parsed[0];
      if (typeof parsed === 'string') return parsed;
    } catch {
      if (secretKeys.startsWith('sb_secret_')) return secretKeys;
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}

async function requireAdmin(request: Request, adminClient: ReturnType<typeof createClient>): Promise<boolean> {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data.user?.email) return false;
  const { data: admin } = await adminClient
    .from('admin_users')
    .select('email')
    .eq('email', data.user.email.toLowerCase())
    .maybeSingle();
  return Boolean(admin);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, { error: '지원하지 않는 요청입니다.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const secret = serviceKey();
  if (!supabaseUrl || !secret) return json(request, { error: '서버 계정 설정을 확인해 주세요.' }, 500);

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return json(request, { error: '요청 형식이 올바르지 않습니다.' }, 400);
  }

  const adminClient = createClient(supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const action = String(body.action || '');

  if (action === 'signup') {
    const username = normalizeUsername(body.username);
    if (!username) return json(request, { error: '아이디는 한글·영문·숫자로 시작하는 4~24자로 입력해 주세요.' }, 400);
    if (!validPassword(body.password)) return json(request, { error: '비밀번호는 8~72자로 입력해 주세요.' }, 400);

    const { data: existing } = await adminClient
      .from('sync_account_recovery')
      .select('user_id')
      .eq('username_key', username.key)
      .maybeSingle();
    if (existing) return json(request, { error: '이미 사용 중인 아이디입니다.' }, 409);

    const email = await internalEmail(username.key);
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      user_metadata: { sync_username: username.display },
      app_metadata: { sync_account: true },
    });
    if (createError || !created.user) {
      const duplicate = createError?.message.toLowerCase().includes('already');
      return json(request, { error: duplicate ? '이미 사용 중인 아이디입니다.' : '계정을 만들지 못했습니다.' }, duplicate ? 409 : 500);
    }

    const recoveryCode = newRecoveryCode();
    const recoveryHash = await sha256(normalizeRecoveryCode(recoveryCode));
    const { error: insertError } = await adminClient.from('sync_account_recovery').insert({
      user_id: created.user.id,
      username_key: username.key,
      username_display: username.display,
      recovery_hash: recoveryHash,
    });
    if (insertError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      return json(request, { error: '계정 정보를 저장하지 못했습니다.' }, 500);
    }
    return json(request, { username: username.display, internalEmail: email, recoveryCode });
  }

  if (action === 'find-id') {
    const code = normalizeRecoveryCode(body.recoveryCode);
    if (code.length !== 20) return json(request, { error: '복구코드를 확인해 주세요.' }, 400);
    const hash = await sha256(code);
    const { data } = await adminClient
      .from('sync_account_recovery')
      .select('username_display')
      .eq('recovery_hash', hash)
      .maybeSingle();
    if (!data) return json(request, { error: '복구코드를 확인해 주세요.' }, 404);
    return json(request, { username: data.username_display });
  }

  if (action === 'reset-password') {
    const username = normalizeUsername(body.username);
    const code = normalizeRecoveryCode(body.recoveryCode);
    if (!username || code.length !== 20 || !validPassword(body.password)) {
      return json(request, { error: '아이디·복구코드·새 비밀번호를 확인해 주세요.' }, 400);
    }
    const hash = await sha256(code);
    const { data: row } = await adminClient
      .from('sync_account_recovery')
      .select('*')
      .eq('username_key', username.key)
      .eq('recovery_hash', hash)
      .maybeSingle<RecoveryRow>();
    if (!row) return json(request, { error: '아이디 또는 복구코드를 확인해 주세요.' }, 404);

    const recoveryCode = newRecoveryCode();
    const recoveryHash = await sha256(normalizeRecoveryCode(recoveryCode));
    const { error: rotateError } = await adminClient.from('sync_account_recovery').update({
      recovery_hash: recoveryHash,
      updated_at: new Date().toISOString(),
    }).eq('user_id', row.user_id);
    if (rotateError) return json(request, { error: '복구코드를 갱신하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 500);
    const { error: passwordError } = await adminClient.auth.admin.updateUserById(row.user_id, { password: body.password });
    if (passwordError) {
      await adminClient.from('sync_account_recovery').update({
        recovery_hash: row.recovery_hash,
        updated_at: row.updated_at,
      }).eq('user_id', row.user_id);
      return json(request, { error: '비밀번호를 바꾸지 못했습니다.' }, 500);
    }
    return json(request, { username: row.username_display, recoveryCode });
  }

  if (action === 'admin-list' || action === 'admin-temp-password') {
    if (!await requireAdmin(request, adminClient)) return json(request, { error: '관리자 권한이 필요합니다.' }, 403);
    if (action === 'admin-list') {
      const { data, error } = await adminClient
        .from('sync_account_recovery')
        .select('username_display, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) return json(request, { error: '회원 목록을 불러오지 못했습니다.' }, 500);
      return json(request, {
        accounts: (data || []).map((row) => ({
          username: row.username_display,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      });
    }

    const username = normalizeUsername(body.username);
    if (!username) return json(request, { error: '회원 아이디를 확인해 주세요.' }, 400);
    const { data: row } = await adminClient
      .from('sync_account_recovery')
      .select('*')
      .eq('username_key', username.key)
      .maybeSingle<RecoveryRow>();
    if (!row) return json(request, { error: '회원 계정을 찾지 못했습니다.' }, 404);

    const temporaryPassword = newTemporaryPassword();
    const recoveryCode = newRecoveryCode();
    const { error: rotateError } = await adminClient.from('sync_account_recovery').update({
      recovery_hash: await sha256(normalizeRecoveryCode(recoveryCode)),
      updated_at: new Date().toISOString(),
    }).eq('user_id', row.user_id);
    if (rotateError) return json(request, { error: '복구코드를 갱신하지 못해 임시 비밀번호를 발급하지 않았습니다.' }, 500);
    const { error: passwordError } = await adminClient.auth.admin.updateUserById(row.user_id, {
      password: temporaryPassword,
      user_metadata: { sync_username: row.username_display, must_change_password: true },
    });
    if (passwordError) {
      await adminClient.from('sync_account_recovery').update({
        recovery_hash: row.recovery_hash,
        updated_at: row.updated_at,
      }).eq('user_id', row.user_id);
      return json(request, { error: '임시 비밀번호를 발급하지 못했습니다.' }, 500);
    }
    return json(request, { username: row.username_display, temporaryPassword, recoveryCode });
  }

  return json(request, { error: '지원하지 않는 계정 작업입니다.' }, 400);
});
