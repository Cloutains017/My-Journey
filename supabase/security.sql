-- Security upgrade, applied transactionally after a verified backup.
begin;

create table if not exists public.admin_login_limits (
  key text primary key,
  attempts integer not null,
  window_start timestamptz not null
);
create table if not exists public.admin_recycle_bin (
  id uuid primary key default gen_random_uuid(),
  target text not null,
  record_id uuid not null,
  label text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  restored_at timestamptz
);
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  action text not null,
  target text not null,
  record_id uuid,
  actor text not null default current_user,
  before_data jsonb,
  after_data jsonb
);
create index if not exists admin_audit_log_created_at on public.admin_audit_log(created_at desc);
create index if not exists admin_recycle_bin_created_at on public.admin_recycle_bin(created_at desc);

alter table public.admin_login_limits enable row level security;
alter table public.admin_recycle_bin enable row level security;
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_login_limits, public.admin_recycle_bin, public.admin_audit_log from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.admin_login_limits to service_role;
grant select, insert, update on public.admin_recycle_bin to service_role;
grant select, insert on public.admin_audit_log to service_role;

do $$
declare t text;
begin
  foreach t in array array['trips','photos','agreement_votes','desire_votes','city_boundaries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;

create or replace function public.admin_login_attempt(source_key text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare n integer; k text; allowed boolean := true;
begin
  if source_key is null or length(source_key) > 128 then raise exception 'Invalid source'; end if;
  -- Every instance uses the same counters. Always lock global first.
  foreach k in array array['global', 'ip:' || source_key] loop
    insert into public.admin_login_limits as limits(key, attempts, window_start)
    values (k, 1, now())
    on conflict (key) do update set
      attempts = case when limits.window_start <= now() - interval '15 minutes' then 1 else least(limits.attempts + 1, 101) end,
      window_start = case when limits.window_start <= now() - interval '15 minutes' then now() else limits.window_start end
    returning attempts into n;
    if n > (case when k = 'global' then 100 else 10 end) then allowed := false; end if;
  end loop;
  delete from public.admin_login_limits where window_start < now() - interval '1 day';
  return allowed;
end $$;

create or replace function public.admin_record_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.admin_audit_log(action,target,record_id,before_data,after_data)
  values (TG_OP,TG_TABLE_NAME,coalesce(NEW.id,OLD.id),
    case when TG_OP <> 'INSERT' then to_jsonb(OLD) end,
    case when TG_OP <> 'DELETE' then to_jsonb(NEW) end);
  return null;
end $$;
do $$
declare t text;
begin
  foreach t in array array['trips','photos','agreement_votes','desire_votes','city_boundaries'] loop
    execute format('drop trigger if exists admin_audit_changes on public.%I',t);
    execute format('create trigger admin_audit_changes after insert or update or delete on public.%I for each row execute function public.admin_record_change()',t);
  end loop;
end $$;

create or replace function public.admin_archive_delete(target_table text, target_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare row_data jsonb; bundle jsonb; archive_id uuid;
begin
  if target_table is null or target_table not in ('trips','photos','agreement_votes','desire_votes') then raise exception 'Invalid target'; end if;
  -- Serialize snapshot/delete/restore with concurrent writes, including child inserts.
  lock table public.trips, public.photos, public.agreement_votes, public.desire_votes in share row exclusive mode;
  execute format('select to_jsonb(t) from public.%I t where id = $1',target_table) into row_data using target_id;
  if row_data is null then raise exception 'Record not found'; end if;
  bundle := jsonb_build_object(target_table,jsonb_build_array(row_data));
  if target_table = 'trips' then
    bundle := bundle || jsonb_build_object(
      'photos',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from public.photos p where trip_id = target_id),
      'agreement_votes',(select coalesce(jsonb_agg(to_jsonb(v)),'[]'::jsonb) from public.agreement_votes v where trip_id = target_id),
      'desire_votes',(select coalesce(jsonb_agg(to_jsonb(v)),'[]'::jsonb) from public.desire_votes v where trip_id = target_id));
  elsif target_table = 'photos' then
    bundle := bundle || jsonb_build_object('covers',
      (select coalesce(jsonb_agg(jsonb_build_object('id',id,'cover_image',cover_image)),'[]'::jsonb)
       from public.trips where cover_image = row_data->>'url'));
    update public.trips set cover_image = null where cover_image = row_data->>'url';
  end if;
  insert into public.admin_recycle_bin(target,record_id,label,payload)
    values(target_table,target_id,coalesce(row_data->>'title',row_data->>'caption',row_data->>'nickname','照片'),bundle)
    returning id into archive_id;
  execute format('delete from public.%I where id = $1',target_table) using target_id;
  return archive_id;
end $$;

create or replace function public.admin_restore(archive_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare entry public.admin_recycle_bin; t text; cover jsonb;
begin
  lock table public.trips, public.photos, public.agreement_votes, public.desire_votes in share row exclusive mode;
  select * into entry from public.admin_recycle_bin where id = archive_id and restored_at is null for update;
  if not found then raise exception 'Archive not available'; end if;
  foreach t in array array['trips','photos','agreement_votes','desire_votes'] loop
    if entry.payload ? t then
      -- No ON CONFLICT: fail the complete transaction if existing data conflicts.
      execute format('insert into public.%I select * from jsonb_populate_recordset(null::public.%I, $1)',t,t)
        using entry.payload->t;
    end if;
  end loop;
  for cover in select value from jsonb_array_elements(coalesce(entry.payload->'covers','[]'::jsonb)) loop
    update public.trips set cover_image = cover->>'cover_image'
      where id = (cover->>'id')::uuid and cover_image is null;
  end loop;
  update public.admin_recycle_bin set restored_at = now() where id = archive_id;
  insert into public.admin_audit_log(action,target,record_id) values ('RESTORE',entry.target,entry.record_id);
end $$;

revoke all on function public.admin_login_attempt(text), public.admin_record_change(), public.admin_archive_delete(text,uuid), public.admin_restore(uuid) from public, anon, authenticated;
grant execute on function public.admin_login_attempt(text), public.admin_record_change(), public.admin_archive_delete(text,uuid), public.admin_restore(uuid) to service_role;
notify pgrst, 'reload schema';
commit;
