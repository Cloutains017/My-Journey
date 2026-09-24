-- Apply to existing databases before publishing photo grouping.
alter table public.trips
  add column if not exists photo_groups jsonb default '[]'::jsonb;
