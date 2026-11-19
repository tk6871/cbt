create table public.admin_followup_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.admin_member_followups(user_id) on delete cascade,
  recipient_id uuid not null references public.admin_role_members(user_id) on delete cascade,
  revision integer not null,
  created_at timestamptz not null,
  seen boolean not null default false,
  unique(user_id, revision)
);
alter table public.admin_followup_notifications enable row level security;
revoke all on public.admin_followup_notifications from public, anon, authenticated;
grant select, update(seen) on public.admin_followup_notifications to authenticated;
create policy notification_read on public.admin_followup_notifications for select to authenticated
  using (recipient_id=(select auth.uid()) and (select public.has_cbt_admin_permission('members.manage')));
create policy notification_seen on public.admin_followup_notifications for update to authenticated
  using (recipient_id=(select auth.uid()) and (select public.has_cbt_admin_permission('members.manage')))
  with check (seen and recipient_id=(select auth.uid()) and (select public.has_cbt_admin_permission('members.manage')));
create index followup_inbox_unread_idx on public.admin_followup_notifications(recipient_id,created_at desc,id) where not seen;
create index followup_open_queue_idx on public.admin_member_followups(assignee_id,updated_at desc,user_id) where needs_follow_up;

create function public.notify_followup_assignment() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous_owner uuid;
begin
  if tg_op='UPDATE' then
    previous_owner:=old.assignee_id;
    if previous_owner is distinct from new.assignee_id or (old.needs_follow_up and not new.needs_follow_up) then
      update public.admin_followup_notifications set seen=true
        where user_id=new.user_id and recipient_id=previous_owner and not seen;
    end if;
  end if;
  if new.assignee_id is not null and new.assignee_id is distinct from previous_owner then
    insert into public.admin_followup_notifications(user_id,recipient_id,revision,created_at)
      values(new.user_id,new.assignee_id,new.revision,new.updated_at);
  end if;
  return new;
end;
$$;
revoke all on function public.notify_followup_assignment() from public, anon, authenticated;
create trigger followup_assignment_notice after insert or update of assignee_id,needs_follow_up on public.admin_member_followups
  for each row execute function public.notify_followup_assignment();

create function public.cbt_followup_desk(show_queues boolean) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=auth.uid(); inbox jsonb; queues jsonb;
begin
  if me is null or not public.has_cbt_admin_permission('members.read') then
    raise insufficient_privilege using message='회원 조회 권한이 필요합니다.';
  end if;
  select jsonb_build_object('total',coalesce(max(total),0),'items',coalesce(jsonb_agg(
    jsonb_build_object('id',id,'member',user_id,'name',public.followup_account_label(user_id),'at',created_at)
    order by created_at desc,id),'[]'::jsonb)) into inbox
  from (select id,user_id,created_at,count(*) over() as total from public.admin_followup_notifications
        where recipient_id=me and not seen and public.has_cbt_admin_permission('members.manage')
        order by created_at desc,id limit 10) n;
  if show_queues then
    select jsonb_object_agg(kind,jsonb_build_object('total',total,'items',items)) into queues from (
      select q.kind, coalesce(max(f.total),0) as total,
        coalesce(jsonb_agg(jsonb_build_object('member',f.user_id,'name',public.followup_account_label(f.user_id))
          order by f.updated_at desc,f.user_id) filter(where f.user_id is not null),'[]'::jsonb) as items
      from (values ('mine',me),('unassigned',null::uuid)) q(kind,owner)
      left join lateral (select user_id,updated_at,count(*) over() as total from public.admin_member_followups
        where needs_follow_up and assignee_id is not distinct from q.owner
        order by updated_at desc,user_id limit 5) f on true
      group by q.kind
    ) grouped;
  end if;
  return jsonb_build_object('inbox',inbox,'queues',queues);
end;
$$;
revoke all on function public.cbt_followup_desk(boolean) from public, anon, authenticated;
grant execute on function public.cbt_followup_desk(boolean) to authenticated;
