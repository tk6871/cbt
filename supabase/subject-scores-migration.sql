alter table public.exam_results
  add column if not exists subject_scores jsonb not null default '[]'::jsonb;
