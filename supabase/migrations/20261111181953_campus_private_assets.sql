-- Private preview membership is an explicit snapshot, not every future admin.
create table public.campus_preview_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.campus_preview_members enable row level security;
revoke all on public.campus_preview_members from anon, authenticated;
grant select on public.campus_preview_members to authenticated;
create policy campus_preview_self on public.campus_preview_members
  for select to authenticated using (user_id = (select auth.uid()));
insert into public.campus_preview_members(user_id)
select user_id from public.admin_role_members where role = 'super_admin';

create table public.campus_preview_assets (
  path text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 100),
  author text not null check (length(author) between 1 and 100),
  source text not null check (source like 'https://%' and length(source) <= 1000),
  license text not null check (length(license) between 1 and 200),
  created_at timestamptz not null default now(),
  check (path like user_id::text || '/%.glb')
);
alter table public.campus_preview_assets enable row level security;
revoke all on public.campus_preview_assets from anon, authenticated;
grant select, insert on public.campus_preview_assets to authenticated;
create policy campus_preview_assets_read on public.campus_preview_assets
  for select to authenticated using (
    user_id = (select auth.uid()) and exists
    (select 1 from public.campus_preview_members where user_id = (select auth.uid()))
  );
create policy campus_preview_assets_add on public.campus_preview_assets
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists
    (select 1 from public.campus_preview_members where user_id = (select auth.uid()))
  );

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('campus-private', 'campus-private', false, 52428800,
  array['model/gltf-binary', 'application/octet-stream']);
create policy campus_private_read on storage.objects for select to authenticated
using (bucket_id = 'campus-private'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (select 1 from public.campus_preview_members where user_id = (select auth.uid())));
create policy campus_private_add on storage.objects for insert to authenticated
with check (bucket_id = 'campus-private'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and storage.extension(name) = 'glb'
  and exists (select 1 from public.campus_preview_members where user_id = (select auth.uid())));
-- No public retrieval, UPDATE, DELETE or membership self-enrollment policies.
