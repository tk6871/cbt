create index if not exists admin_role_members_created_by_idx
on public.admin_role_members(created_by)
where created_by is not null;
