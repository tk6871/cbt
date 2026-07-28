create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.visitor_profiles (
  visitor_id text primary key,
  ip_address inet,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  visit_count integer not null default 0 check (visit_count >= 0),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  exam_count integer not null default 0 check (exam_count >= 0),
  last_score integer check (last_score between 0 and 100),
  best_score integer check (best_score between 0 and 100),
  device_type text,
  browser text,
  last_path text
);

create table if not exists public.visit_events (
  id bigint generated always as identity primary key,
  visitor_id text not null references public.visitor_profiles(visitor_id) on delete cascade,
  ip_address inet,
  event_type text not null default 'visit' check (event_type in ('visit', 'navigation')),
  visited_at timestamptz not null default now(),
  path text,
  view_name text,
  referrer_host text,
  device_type text,
  browser text,
  screen_width integer,
  timezone text,
  app_version text
);

create table if not exists public.question_attempts (
  id bigint generated always as identity primary key,
  visitor_id text not null references public.visitor_profiles(visitor_id) on delete cascade,
  ip_address inet,
  qualification_key text,
  qualification text,
  round_id text,
  round_title text,
  question_number integer not null check (question_number > 0),
  selected_answer integer not null check (selected_answer between 1 and 4),
  correct_answer integer not null check (correct_answer between 1 and 4),
  is_correct boolean not null,
  mode text,
  answered_at timestamptz not null default now()
);

create table if not exists public.exam_results (
  id bigint generated always as identity primary key,
  visitor_id text not null references public.visitor_profiles(visitor_id) on delete cascade,
  ip_address inet,
  qualification_key text,
  qualification text,
  round_id text,
  title text,
  mode text,
  score integer not null check (score between 0 and 100),
  correct_count integer not null check (correct_count >= 0),
  total_count integer not null check (total_count > 0),
  unanswered_count integer not null default 0 check (unanswered_count >= 0),
  duration_seconds integer,
  completed_at timestamptz not null default now()
);

create index if not exists visitor_profiles_last_seen_idx on public.visitor_profiles(last_seen desc);
create index if not exists visit_events_visited_at_idx on public.visit_events(visited_at desc);
create index if not exists visit_events_visitor_idx on public.visit_events(visitor_id, visited_at desc);
create index if not exists question_attempts_answered_at_idx on public.question_attempts(answered_at desc);
create index if not exists question_attempts_visitor_idx on public.question_attempts(visitor_id, answered_at desc);
create index if not exists exam_results_completed_at_idx on public.exam_results(completed_at desc);
create index if not exists exam_results_visitor_idx on public.exam_results(visitor_id, completed_at desc);

alter table public.admin_users enable row level security;
alter table public.visitor_profiles enable row level security;
alter table public.visit_events enable row level security;
alter table public.question_attempts enable row level security;
alter table public.exam_results enable row level security;

create or replace function public.is_cbt_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_cbt_admin() from public;
grant execute on function public.is_cbt_admin() to authenticated;

drop policy if exists "admin can read own registration" on public.admin_users;
create policy "admin can read own registration"
on public.admin_users for select
to authenticated
using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "admins can read visitor profiles" on public.visitor_profiles;
create policy "admins can read visitor profiles"
on public.visitor_profiles for select
to authenticated
using (public.is_cbt_admin());

drop policy if exists "admins can read visit events" on public.visit_events;
create policy "admins can read visit events"
on public.visit_events for select
to authenticated
using (public.is_cbt_admin());

drop policy if exists "admins can read question attempts" on public.question_attempts;
create policy "admins can read question attempts"
on public.question_attempts for select
to authenticated
using (public.is_cbt_admin());

drop policy if exists "admins can read exam results" on public.exam_results;
create policy "admins can read exam results"
on public.exam_results for select
to authenticated
using (public.is_cbt_admin());

revoke all on table public.admin_users from anon, authenticated;
revoke all on table public.visitor_profiles from anon, authenticated;
revoke all on table public.visit_events from anon, authenticated;
revoke all on table public.question_attempts from anon, authenticated;
revoke all on table public.exam_results from anon, authenticated;

grant select on table public.admin_users to authenticated;
grant select on table public.visitor_profiles to authenticated;
grant select on table public.visit_events to authenticated;
grant select on table public.question_attempts to authenticated;
grant select on table public.exam_results to authenticated;

do $$
declare
  realtime_table text;
begin
  foreach realtime_table in array array[
    'visitor_profiles',
    'visit_events',
    'question_attempts',
    'exam_results'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables publication_table
      where publication_table.pubname = 'supabase_realtime'
        and publication_table.schemaname = 'public'
        and publication_table.tablename = realtime_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', realtime_table);
    end if;
  end loop;
end
$$;

-- SQL Editor에서 아래 이메일을 실제 관리자 로그인 이메일로 바꿔 한 번 실행하세요.
-- insert into public.admin_users(email) values ('your-email@example.com')
-- on conflict (email) do nothing;
