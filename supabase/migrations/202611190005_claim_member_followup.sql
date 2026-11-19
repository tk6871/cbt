create function public.claim_member_followup(target_member uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  me uuid := auth.uid();
  is_open boolean;
  current_owner uuid;
begin
  if me is null or not public.has_cbt_admin_permission('members.manage') then
    raise insufficient_privilege using message='회원 관리 권한이 필요합니다.';
  end if;

  select needs_follow_up, assignee_id into is_open, current_owner
    from public.admin_member_followups where user_id=target_member for update;
  if not found or not is_open then
    return jsonb_build_object('status','closed');
  elsif current_owner=me then
    return jsonb_build_object('status','already_mine');
  elsif current_owner is not null then
    return jsonb_build_object('status','taken','owner',public.followup_account_label(current_owner));
  end if;

  update public.admin_member_followups set assignee_id=me where user_id=target_member;
  return jsonb_build_object('status','claimed');
end;
$$;
revoke all on function public.claim_member_followup(uuid) from public, anon, authenticated;
grant execute on function public.claim_member_followup(uuid) to authenticated;
