-- 학습 화면의 이상 문제 신고 저장소.
-- 일반 사용자는 신고만 추가할 수 있고, 목록 조회와 처리는 CBT 관리자만 가능합니다.

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
  issue_types text[] not null check (
    cardinality(issue_types) between 1 and 8
    and issue_types <@ array[
      'missing-image', 'wrong-image', 'answer-hotspot', 'answer',
      'explanation', 'text-ocr', 'layout', 'other'
    ]::text[]
  ),
  details text not null check (char_length(btrim(details)) between 3 and 1500),
  question_text text check (question_text is null or char_length(question_text) <= 5000),
  choices_snapshot jsonb check (choices_snapshot is null or jsonb_typeof(choices_snapshot) = 'array'),
  configured_answer integer check (configured_answer is null or configured_answer between 1 and 4),
  source_image text check (source_image is null or char_length(source_image) <= 1000),
  page_url text check (page_url is null or char_length(page_url) <= 2000),
  app_version text check (app_version is null or char_length(app_version) <= 50),
  device_info text check (device_info is null or char_length(device_info) <= 500),
  reporter_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'deferred')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists question_issue_reports_status_created_idx
  on public.question_issue_reports(status, created_at desc);
create index if not exists question_issue_reports_question_idx
  on public.question_issue_reports(qualification_key, round_id, question_number, created_at desc);
create index if not exists question_issue_reports_reporter_user_idx
  on public.question_issue_reports(reporter_user_id);

alter table public.question_issue_reports enable row level security;

drop policy if exists "anyone can submit question issues" on public.question_issue_reports;
create policy "anyone can submit question issues"
on public.question_issue_reports for insert
to anon, authenticated
with check (
  status = 'open'
  and admin_note is null
  and reporter_user_id is not distinct from (select auth.uid())
);

drop policy if exists "admins can read question issues" on public.question_issue_reports;
create policy "admins can read question issues"
on public.question_issue_reports for select
to authenticated
using ((select public.is_cbt_admin()));

drop policy if exists "admins can update question issues" on public.question_issue_reports;
create policy "admins can update question issues"
on public.question_issue_reports for update
to authenticated
using ((select public.is_cbt_admin()))
with check ((select public.is_cbt_admin()));

drop policy if exists "admins can delete question issues" on public.question_issue_reports;
create policy "admins can delete question issues"
on public.question_issue_reports for delete
to authenticated
using ((select public.is_cbt_admin()));

revoke all on table public.question_issue_reports from anon, authenticated;
grant insert (
  space, qualification_key, qualification, round_id, round_title, round_year,
  round_session, question_id, question_number, display_number, subject,
  issue_types, details, question_text, choices_snapshot, configured_answer,
  source_image, page_url, app_version, device_info
) on table public.question_issue_reports to anon, authenticated;
grant select, update, delete on table public.question_issue_reports to authenticated;
grant select, insert, update, delete on table public.question_issue_reports to service_role;
grant usage on sequence public.question_issue_reports_id_seq to anon, authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables publication_table
    where publication_table.pubname = 'supabase_realtime'
      and publication_table.schemaname = 'public'
      and publication_table.tablename = 'question_issue_reports'
  ) then
    alter publication supabase_realtime add table public.question_issue_reports;
  end if;
end
$$;
