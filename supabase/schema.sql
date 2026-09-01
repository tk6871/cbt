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

alter table public.visitor_profiles
  add column if not exists location_country text,
  add column if not exists location_country_code text,
  add column if not exists location_region text,
  add column if not exists location_city text,
  add column if not exists location_latitude double precision,
  add column if not exists location_longitude double precision,
  add column if not exists location_timezone text,
  add column if not exists network_provider text,
  add column if not exists location_updated_at timestamptz;

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
  subject_scores jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null default now()
);

alter table public.exam_results
  add column if not exists subject_scores jsonb not null default '[]'::jsonb;

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
using (lower(email) = lower(coalesce((select auth.jwt()) ->> 'email', '')));

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

grant select, insert, update, delete on table public.visitor_profiles to service_role;
grant select, insert, update, delete on table public.visit_events to service_role;
grant select, insert, update, delete on table public.question_attempts to service_role;
grant select, insert, update, delete on table public.exam_results to service_role;
grant usage, select on sequence public.visit_events_id_seq to service_role;
grant usage, select on sequence public.question_attempts_id_seq to service_role;
grant usage, select on sequence public.exam_results_id_seq to service_role;

-- 문제별 이상 신고: 일반 사용자는 INSERT만, 목록 조회와 처리는 CBT 관리자만 허용합니다.
create table if not exists public.question_issue_reports (
  id bigint generated always as identity primary key,
  space text not null check (space in ('industrial', 'jewelry')),
  qualification_key text not null check (char_length(qualification_key) between 1 and 120),
  qualification text check (qualification is null or char_length(qualification) <= 200),
  round_id text not null check (char_length(round_id) between 1 and 200),
  round_title text check (round_title is null or char_length(round_title) <= 300),
  round_year integer check (round_year is null or round_year between 1900 and 2200),
  round_session text check (round_session is null or char_length(round_session) <= 100),
  question_id text not null check (char_length(question_id) between 1 and 300),
  question_number integer not null check (question_number > 0),
  display_number integer check (display_number is null or display_number > 0),
  subject text check (subject is null or char_length(subject) <= 200),
  issue_types text[] not null check (cardinality(issue_types) between 1 and 8 and issue_types <@ array['missing-image','wrong-image','answer-hotspot','answer','explanation','text-ocr','layout','other']::text[]),
  details text not null check (char_length(btrim(details)) between 3 and 1500),
  question_text text check (question_text is null or char_length(question_text) <= 5000),
  choices_snapshot jsonb check (choices_snapshot is null or jsonb_typeof(choices_snapshot) = 'array'),
  configured_answer integer check (configured_answer is null or configured_answer between 1 and 4),
  source_image text check (source_image is null or char_length(source_image) <= 1000),
  page_url text check (page_url is null or char_length(page_url) <= 2000),
  app_version text check (app_version is null or char_length(app_version) <= 50),
  device_info text check (device_info is null or char_length(device_info) <= 500),
  reporter_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  status text not null default 'open' check (status in ('open','reviewing','resolved','deferred')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists question_issue_reports_status_created_idx on public.question_issue_reports(status, created_at desc);
create index if not exists question_issue_reports_question_idx on public.question_issue_reports(qualification_key, round_id, question_number, created_at desc);
create index if not exists question_issue_reports_reporter_user_idx on public.question_issue_reports(reporter_user_id);
alter table public.question_issue_reports enable row level security;
drop policy if exists "anyone can submit question issues" on public.question_issue_reports;
create policy "anyone can submit question issues" on public.question_issue_reports for insert to anon, authenticated
with check (status = 'open' and admin_note is null and reporter_user_id is not distinct from (select auth.uid()));
drop policy if exists "admins can read question issues" on public.question_issue_reports;
create policy "admins can read question issues" on public.question_issue_reports for select to authenticated using ((select public.is_cbt_admin()));
drop policy if exists "admins can update question issues" on public.question_issue_reports;
create policy "admins can update question issues" on public.question_issue_reports for update to authenticated using ((select public.is_cbt_admin())) with check ((select public.is_cbt_admin()));
drop policy if exists "admins can delete question issues" on public.question_issue_reports;
create policy "admins can delete question issues" on public.question_issue_reports for delete to authenticated using ((select public.is_cbt_admin()));
revoke all on table public.question_issue_reports from anon, authenticated;
grant insert (space, qualification_key, qualification, round_id, round_title, round_year, round_session, question_id, question_number, display_number, subject, issue_types, details, question_text, choices_snapshot, configured_answer, source_image, page_url, app_version, device_info) on table public.question_issue_reports to anon, authenticated;
grant select, update, delete on table public.question_issue_reports to authenticated;
grant select, insert, update, delete on table public.question_issue_reports to service_role;
grant usage on sequence public.question_issue_reports_id_seq to anon, authenticated, service_role;

do $$
declare
  realtime_table text;
begin
  foreach realtime_table in array array[
    'visitor_profiles',
    'visit_events',
    'question_attempts',
    'exam_results',
    'question_issue_reports'
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

-- UUID 기반 관리자 역할·세부 권한. 위의 이메일 목록은 기존 설치 호환용으로만 남깁니다.
-- 관리자 이메일 문자열 비교를 사용자 UUID 기반 역할·권한으로 전환합니다.
create table if not exists public.admin_role_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('super_admin', 'admin')),
  can_view_analytics boolean not null default false,
  can_manage_issues boolean not null default false,
  can_view_members boolean not null default false,
  can_manage_members boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_role_members_created_by_idx
on public.admin_role_members(created_by)
where created_by is not null;

alter table public.admin_role_members enable row level security;

create or replace function public.has_cbt_admin_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_role_members member
    where member.user_id = (select auth.uid())
      and (
        member.role = 'super_admin'
        or case permission_name
          when 'analytics.read' then member.can_view_analytics
          when 'issues.manage' then member.can_manage_issues
          when 'members.read' then member.can_view_members or member.can_manage_members
          when 'members.manage' then member.can_manage_members
          else false
        end
      )
  );
$$;

create or replace function public.is_cbt_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_role_members member
    where member.user_id = (select auth.uid())
  );
$$;

revoke all on function public.has_cbt_admin_permission(text) from public;
revoke all on function public.is_cbt_admin() from public;
grant execute on function public.has_cbt_admin_permission(text) to authenticated;
grant execute on function public.is_cbt_admin() to authenticated;

drop policy if exists "admins can read own role" on public.admin_role_members;
create policy "admins can read own role"
on public.admin_role_members for select to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.admin_role_members from anon, authenticated;
grant select on table public.admin_role_members to authenticated;
grant select, insert, update, delete on table public.admin_role_members to service_role;

-- 기존 admin_users 등록과 Auth 사용자를 연결해 최초 소유자를 슈퍼 관리자로 승격합니다.
insert into public.admin_role_members (
  user_id, role, can_view_analytics, can_manage_issues, can_view_members, can_manage_members
)
select
  auth_user.id, 'super_admin', true, true, true, true
from auth.users auth_user
join public.admin_users legacy_admin
  on lower(legacy_admin.email) = lower(auth_user.email)
on conflict (user_id) do update set
  role = 'super_admin',
  can_view_analytics = true,
  can_manage_issues = true,
  can_view_members = true,
  can_manage_members = true,
  updated_at = now();

drop policy if exists "admins can read visitor profiles" on public.visitor_profiles;
create policy "admins can read visitor profiles"
on public.visitor_profiles for select to authenticated
using ((select public.has_cbt_admin_permission('analytics.read')));

drop policy if exists "admins can read visit events" on public.visit_events;
create policy "admins can read visit events"
on public.visit_events for select to authenticated
using ((select public.has_cbt_admin_permission('analytics.read')));

drop policy if exists "admins can read question attempts" on public.question_attempts;
create policy "admins can read question attempts"
on public.question_attempts for select to authenticated
using ((select public.has_cbt_admin_permission('analytics.read')));

drop policy if exists "admins can read exam results" on public.exam_results;
create policy "admins can read exam results"
on public.exam_results for select to authenticated
using ((select public.has_cbt_admin_permission('analytics.read')));

drop policy if exists "admins can read question issues" on public.question_issue_reports;
create policy "admins can read question issues"
on public.question_issue_reports for select to authenticated
using ((select public.has_cbt_admin_permission('issues.manage')));

create or replace function public.bootstrap_cbt_super_admin()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.admin_role_members (
    user_id, role, can_view_analytics, can_manage_issues, can_view_members, can_manage_members
  )
  select id, 'super_admin', true, true, true, true
  from auth.users
  where lower(email) = lower(new.email)
  on conflict (user_id) do update set
    role = 'super_admin',
    can_view_analytics = true,
    can_manage_issues = true,
    can_view_members = true,
    can_manage_members = true,
    updated_at = now();
  return new;
end;
$$;

revoke all on function public.bootstrap_cbt_super_admin() from public, anon, authenticated;
drop trigger if exists admin_users_bootstrap_super_admin on public.admin_users;
create trigger admin_users_bootstrap_super_admin
after insert or update of email on public.admin_users
for each row execute function public.bootstrap_cbt_super_admin();

drop policy if exists "admins can update question issues" on public.question_issue_reports;
create policy "admins can update question issues"
on public.question_issue_reports for update to authenticated
using ((select public.has_cbt_admin_permission('issues.manage')))
with check ((select public.has_cbt_admin_permission('issues.manage')));

drop policy if exists "admins can delete question issues" on public.question_issue_reports;
create policy "admins can delete question issues"
on public.question_issue_reports for delete to authenticated
using ((select public.has_cbt_admin_permission('issues.manage')));
