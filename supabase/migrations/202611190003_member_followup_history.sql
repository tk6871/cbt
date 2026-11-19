alter table public.admin_member_followups add column assignee_id uuid
  references public.admin_role_members(user_id) on delete set null;
create index admin_member_followups_assignee_idx on public.admin_member_followups(assignee_id)
  where assignee_id is not null;
grant insert (assignee_id), update (assignee_id) on public.admin_member_followups to authenticated;

create table public.admin_member_followup_history (
  user_id uuid not null references public.admin_member_followups(user_id) on delete cascade,
  revision integer not null,
  changed_at timestamptz not null,
  actor_id uuid,
  actor_name text not null,
  changes jsonb not null,
  primary key (user_id, revision)
);
alter table public.admin_member_followup_history enable row level security;
revoke all on public.admin_member_followup_history from public, anon, authenticated;
grant select on public.admin_member_followup_history to authenticated;
create policy followup_history_read on public.admin_member_followup_history for select to authenticated
  using ((select public.has_cbt_admin_permission('members.read')));

create function public.validate_followup_assignee() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.assignee_id is not null then
    perform user_id from public.admin_role_members where user_id = new.assignee_id
      and (role = 'super_admin' or can_manage_members) for share;
    if not found then
      raise exception using errcode='23514', message='담당자는 회원 관리 권한이 필요합니다.';
    end if;
  end if;
  return new;
end;
$$;
create trigger validate_followup_assignee before insert or update of assignee_id
  on public.admin_member_followups for each row execute function public.validate_followup_assignee();

create function public.clear_ineligible_followup_assignments() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.admin_member_followups set assignee_id=null where assignee_id=new.user_id;
  return new;
end;
$$;
create trigger clear_ineligible_followup_assignments after update of role,can_manage_members on public.admin_role_members
  for each row when ((old.role='super_admin' or old.can_manage_members) and new.role<>'super_admin' and not new.can_manage_members)
  execute function public.clear_ineligible_followup_assignments();

-- Snapshot the account label so renaming or removing an operator cannot change past entries.
create function public.followup_account_label(account_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(r.username_display,''),nullif(u.email,''),u.id::text)
    from auth.users u left join public.sync_account_recovery r on r.user_id=u.id where u.id=account_id;
$$;
create function public.record_member_followup_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  delta jsonb := '{}'::jsonb;
  prior_note text := '';
  prior_flag boolean := false;
  prior_assignee uuid;
begin
  if tg_op='UPDATE' then
    prior_note:=old.note; prior_flag:=old.needs_follow_up; prior_assignee:=old.assignee_id;
  end if;
  if prior_note is distinct from new.note then
    delta:=delta || jsonb_build_object('note',jsonb_build_array(prior_note,new.note));
  end if;
  if prior_flag is distinct from new.needs_follow_up then
    delta:=delta || jsonb_build_object('followUp',jsonb_build_array(prior_flag,new.needs_follow_up));
  end if;
  if prior_assignee is distinct from new.assignee_id then
    delta:=delta || jsonb_build_object('assignee',jsonb_build_array(
      coalesce(public.followup_account_label(prior_assignee),prior_assignee::text),
      coalesce(public.followup_account_label(new.assignee_id),new.assignee_id::text)));
  end if;
  if delta <> '{}'::jsonb then
    insert into public.admin_member_followup_history(user_id,revision,changed_at,actor_id,actor_name,changes)
      values(new.user_id,new.revision,new.updated_at,actor,
        coalesce(public.followup_account_label(actor),actor::text,'시스템'),delta);
  end if;
  return new;
end;
$$;
create trigger record_member_followup_change after insert or update on public.admin_member_followups
  for each row execute function public.record_member_followup_change();

revoke all on function public.validate_followup_assignee(), public.clear_ineligible_followup_assignments(),
  public.followup_account_label(uuid), public.record_member_followup_change() from public, anon, authenticated;
