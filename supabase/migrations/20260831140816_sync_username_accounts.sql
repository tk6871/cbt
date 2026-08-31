create table if not exists public.sync_account_recovery (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username_key text not null unique,
  username_display text not null,
  recovery_hash text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sync_account_username_length check (char_length(username_key) between 4 and 24),
  constraint sync_account_recovery_hash_length check (char_length(recovery_hash) = 64)
);

alter table public.sync_account_recovery enable row level security;

revoke all on table public.sync_account_recovery from public, anon, authenticated;
grant all on table public.sync_account_recovery to service_role;

comment on table public.sync_account_recovery is
  '동기화 계정의 아이디와 복구코드 해시. 원문 복구코드와 비밀번호는 저장하지 않는다.';
