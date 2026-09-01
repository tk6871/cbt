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

drop policy if exists "admins can update question issues" on public.question_issue_reports;
create policy "admins can update question issues"
on public.question_issue_reports for update to authenticated
using ((select public.has_cbt_admin_permission('issues.manage')))
with check ((select public.has_cbt_admin_permission('issues.manage')));

drop policy if exists "admins can delete question issues" on public.question_issue_reports;
create policy "admins can delete question issues"
on public.question_issue_reports for delete to authenticated
using ((select public.has_cbt_admin_permission('issues.manage')));
