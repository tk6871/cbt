do $$
declare
  realtime_table text;
begin
  foreach realtime_table in array array[
    'visitor_profiles',
    'visit_events',
    'question_attempts',
    'exam_results'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables publication_table
      where publication_table.pubname = 'supabase_realtime'
        and publication_table.schemaname = 'public'
        and publication_table.tablename = realtime_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', realtime_table);
    end if;
  end loop;
end
$$;
