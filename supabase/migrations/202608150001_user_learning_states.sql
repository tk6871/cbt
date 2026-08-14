create table if not exists public.user_learning_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  space text not null check (space in ('industrial', 'jewelry')),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, space)
);

alter table public.user_learning_states enable row level security;

drop policy if exists "users can read own learning state" on public.user_learning_states;
create policy "users can read own learning state"
on public.user_learning_states for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "users can insert own learning state" on public.user_learning_states;
create policy "users can insert own learning state"
on public.user_learning_states for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "users can update own learning state" on public.user_learning_states;
create policy "users can update own learning state"
on public.user_learning_states for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "users can delete own learning state" on public.user_learning_states;
create policy "users can delete own learning state"
on public.user_learning_states for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.user_learning_states from anon;
grant select, insert, update, delete on table public.user_learning_states to authenticated;
