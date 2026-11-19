-- The account Edge Function checks members.read for every page before calling this projection.
create or replace function public.cbt_member_directory_page(
  before_created_at timestamptz, before_user_id uuid, page_size integer
) returns jsonb
language sql stable security definer set search_path = '' as $$
  with candidates as materialized (
    select u.id, u.email, u.created_at, coalesce(u.created_at, timestamptz '0001-01-01 00:00:00+00') as sort_at, u.updated_at, u.last_sign_in_at, u.raw_user_meta_data->>'sync_username' as display_name
    from auth.users u
    where before_user_id is null or (coalesce(u.created_at, timestamptz '0001-01-01 00:00:00+00'),u.id) < (before_created_at,before_user_id)
    order by sort_at desc,u.id desc
    limit least(greatest(page_size,1),1000) + 1
  ), page as (
    select * from candidates order by sort_at desc,id desc limit least(greatest(page_size,1),1000)
  ), accounts as (
    select p.sort_at, p.id, jsonb_build_object(
      'userId', p.id,
      'username', coalesce(nullif(rec.username_display,''), nullif(p.display_name,''), nullif(p.email,''), '이름 없는 계정'),
      'email', case when rec.user_id is null then nullif(p.email,'') end,
      'accountType', case when rec.user_id is null then 'email' else 'site_id' end,
      'createdAt', p.created_at, 'updatedAt', coalesce(rec.updated_at,p.updated_at,p.created_at),
      'lastSignInAt', p.last_sign_in_at, 'role', r.role,
      'permissions', jsonb_build_object(
        'viewAnalytics', coalesce(r.role='super_admin' or r.can_view_analytics,false),
        'manageIssues', coalesce(r.role='super_admin' or r.can_manage_issues,false),
        'viewMembers', coalesce(r.role='super_admin' or r.can_view_members or r.can_manage_members,false),
        'manageMembers', coalesce(r.role='super_admin' or r.can_manage_members,false)
      )
    ) as account
    from page p left join public.sync_account_recovery rec on rec.user_id=p.id
    left join public.admin_role_members r on r.user_id=p.id
  )
  select jsonb_build_object(
    'accounts', coalesce((select jsonb_agg(account order by sort_at desc,id desc) from accounts),'[]'::jsonb),
    'nextCursor', case when (select count(*) from candidates)>least(greatest(page_size,1),1000)
      then (select jsonb_build_object('createdAt',sort_at,'userId',id) from page order by sort_at,id limit 1) end
  );
$$;
revoke all on function public.cbt_member_directory_page(timestamptz,uuid,integer) from public, anon, authenticated;
grant execute on function public.cbt_member_directory_page(timestamptz,uuid,integer) to service_role;
