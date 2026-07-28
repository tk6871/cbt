alter table public.visitor_profiles
  add column if not exists location_country text,
  add column if not exists location_country_code text,
  add column if not exists location_region text,
  add column if not exists location_city text,
  add column if not exists location_latitude double precision,
  add column if not exists location_longitude double precision,
  add column if not exists location_timezone text,
  add column if not exists network_provider text,
  add column if not exists location_updated_at timestamptz;
