create table public.explanation_revisions (
  question_id text not null check (length(question_id) between 1 and 180),
  version integer not null check(version > 0),
  status text not null check(status in ('draft','approved')),
  explanation text not null check(length(btrim(explanation)) between 1 and 20000),
  author_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key(question_id,version)
);
alter table public.explanation_revisions enable row level security;
revoke all on public.explanation_revisions from anon, authenticated;
grant select on public.explanation_revisions to authenticated;
grant insert(question_id,version,status,explanation) on public.explanation_revisions to authenticated;
create policy review_history on public.explanation_revisions for select to authenticated
  using ((select public.has_cbt_admin_permission('issues.manage')));
create policy append_review on public.explanation_revisions for insert to authenticated
  with check(author_id=(select auth.uid()) and (select public.has_cbt_admin_permission('issues.manage')));

-- The primary key arbitrates concurrent appends. Each later revision also
-- needs a committed predecessor visible to the calling administrator.
create function public.check_explanation_revision_sequence() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.version > 1 and not exists (
    select 1 from public.explanation_revisions
    where question_id = new.question_id and version = new.version - 1
  ) then
    raise unique_violation using message = 'Reload the latest explanation revision before saving.';
  end if;
  return new;
end;
$$;
create trigger check_explanation_revision_sequence before insert on public.explanation_revisions
for each row execute function public.check_explanation_revision_sequence();
