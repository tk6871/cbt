create table public.admin_member_followups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 2000),
  needs_follow_up boolean not null default false,
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.admin_member_followups enable row level security;
revoke all on public.admin_member_followups from public, anon, authenticated;
grant select on public.admin_member_followups to authenticated;
grant insert (user_id,note,needs_follow_up), update (note,needs_follow_up) on public.admin_member_followups to authenticated;
create policy followups_read on public.admin_member_followups for select to authenticated
  using ((select public.has_cbt_admin_permission('members.read')));
create policy followups_create on public.admin_member_followups for insert to authenticated
  with check ((select public.has_cbt_admin_permission('members.manage')));
create policy followups_edit on public.admin_member_followups for update to authenticated
  using ((select public.has_cbt_admin_permission('members.manage')))
  with check ((select public.has_cbt_admin_permission('members.manage')));
create function public.bump_member_followup_revision() returns trigger language plpgsql set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger member_followup_revision before update on public.admin_member_followups
  for each row execute function public.bump_member_followup_revision();
