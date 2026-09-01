import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

type RequestBody = {
  action?: string;
  username?: string;
  password?: string;
  recoveryCode?: string;
  userId?: string;
  role?: string;
  permissions?: Partial<AdminPermissions>;
};

type AdminPermissions = {
  viewAnalytics: boolean;
  manageIssues: boolean;
  viewMembers: boolean;
  manageMembers: boolean;
};

type AdminRoleRow = {
  user_id: string;
  role: 'super_admin' | 'admin';
  can_view_analytics: boolean;
  can_manage_issues: boolean;
  can_view_members: boolean;
  can_manage_members: boolean;
};

type AdminAccess = {
  userId: string;
  role: 'super_admin' | 'admin';
  permissions: AdminPermissions;
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

function accessFromRole(row: AdminRoleRow): AdminAccess {
  const superAdmin = row.role === 'super_admin';
  return {
    userId: row.user_id,
    role: row.role,
    permissions: {
      viewAnalytics: superAdmin || row.can_view_analytics,
      manageIssues: superAdmin || row.can_manage_issues,
      viewMembers: superAdmin || row.can_view_members || row.can_manage_members,
      manageMembers: superAdmin || row.can_manage_members,
    },
  };
}

async function requireAdmin(request: Request, adminClient: ReturnType<typeof createClient>): Promise<AdminAccess | null> {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: admin } = await adminClient
    .from('admin_role_members')
    .select('user_id,role,can_view_analytics,can_manage_issues,can_view_members,can_manage_members')
    .eq('user_id', data.user.id)
    .maybeSingle<AdminRoleRow>();
  return admin ? accessFromRole(admin) : null;
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

  if (action.startsWith('admin-')) {
    const access = await requireAdmin(request, adminClient);
    if (!access) return json(request, { error: '관리자 권한이 필요합니다.' }, 403);

    if (action === 'admin-session') {
      return json(request, { access });
    }

    if (action === 'admin-list') {
      if (!access.permissions.viewMembers) return json(request, { error: '회원 목록 조회 권한이 필요합니다.' }, 403);
      const [{ data: recoveryRows, error: recoveryError }, { data: roleRows, error: roleError }, authResponse] = await Promise.all([
        adminClient
        .from('sync_account_recovery')
        .select('user_id,username_display,created_at,updated_at')
        .order('created_at', { ascending: false }),
        adminClient
          .from('admin_role_members')
          .select('user_id,role,can_view_analytics,can_manage_issues,can_view_members,can_manage_members'),
        adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);
      if (recoveryError || roleError || authResponse.error) return json(request, { error: '회원 목록을 불러오지 못했습니다.' }, 500);
      const recoveryByUser = new Map((recoveryRows || []).map((row) => [row.user_id, row]));
      const roleByUser = new Map((roleRows || []).map((row) => [row.user_id, row as AdminRoleRow]));
      return json(request, {
        accounts: authResponse.data.users.map((user) => {
          const recovery = recoveryByUser.get(user.id);
          const role = roleByUser.get(user.id);
          return {
            userId: user.id,
            username: recovery?.username_display || String(user.user_metadata?.sync_username || user.email || '이름 없는 계정'),
            email: recovery ? null : user.email || null,
            accountType: recovery ? 'site_id' : 'email',
            createdAt: user.created_at,
            updatedAt: recovery?.updated_at || user.updated_at || user.created_at,
            lastSignInAt: user.last_sign_in_at || null,
            role: role?.role || null,
            permissions: role ? accessFromRole(role).permissions : {
              viewAnalytics: false,
              manageIssues: false,
              viewMembers: false,
              manageMembers: false,
            },
          };
        }).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
      });
    }

    if (action === 'admin-set-role') {
      if (access.role !== 'super_admin') return json(request, { error: '슈퍼 관리자만 권한을 변경할 수 있습니다.' }, 403);
      const userId = String(body.userId || '');
      if (!/^[0-9a-f-]{36}$/i.test(userId)) return json(request, { error: '회원 정보를 확인해 주세요.' }, 400);
      const nextRole = String(body.role || 'none');
      if (!['none', 'admin', 'super_admin'].includes(nextRole)) return json(request, { error: '관리자 역할을 확인해 주세요.' }, 400);
      if (userId === access.userId && nextRole !== 'super_admin') {
        return json(request, { error: '현재 로그인한 슈퍼 관리자 권한은 직접 해제할 수 없습니다.' }, 400);
      }
      if (nextRole === 'none') {
        const { error } = await adminClient.from('admin_role_members').delete().eq('user_id', userId);
        if (error) return json(request, { error: '관리자 권한을 해제하지 못했습니다.' }, 500);
        return json(request, { updated: true });
      }
      const permissions = body.permissions || {};
      const superAdmin = nextRole === 'super_admin';
      const { error } = await adminClient.from('admin_role_members').upsert({
        user_id: userId,
        role: nextRole,
        can_view_analytics: superAdmin || permissions.viewAnalytics === true,
        can_manage_issues: superAdmin || permissions.manageIssues === true,
        can_view_members: superAdmin || permissions.viewMembers === true,
        can_manage_members: superAdmin || permissions.manageMembers === true,
        created_by: access.userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) return json(request, { error: '관리자 권한을 저장하지 못했습니다.' }, 500);
      return json(request, { updated: true });
    }

    if (action !== 'admin-temp-password') return json(request, { error: '지원하지 않는 관리자 작업입니다.' }, 400);
    if (!access.permissions.manageMembers) return json(request, { error: '회원 복구 권한이 필요합니다.' }, 403);

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
