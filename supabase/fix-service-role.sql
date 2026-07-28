grant select, insert, update, delete on table public.visitor_profiles to service_role;
grant select, insert, update, delete on table public.visit_events to service_role;
grant select, insert, update, delete on table public.question_attempts to service_role;
grant select, insert, update, delete on table public.exam_results to service_role;

grant usage, select on sequence public.visit_events_id_seq to service_role;
grant usage, select on sequence public.question_attempts_id_seq to service_role;
grant usage, select on sequence public.exam_results_id_seq to service_role;
