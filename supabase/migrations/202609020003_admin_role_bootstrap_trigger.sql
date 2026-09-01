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
