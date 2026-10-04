-- NULL retains the legacy shared desktop/mobile crop until edited independently.
alter table public.trips add column if not exists cover_mobile_position jsonb constraint trips_mobile_position_valid check (
    case when cover_mobile_position is null then true
      when jsonb_typeof(cover_mobile_position) = 'object'
        and jsonb_typeof(cover_mobile_position->'x') = 'number'
        and jsonb_typeof(cover_mobile_position->'y') = 'number'
        and cover_mobile_position - 'x' - 'y' = '{}'::jsonb
      then (cover_mobile_position->>'x')::numeric between 0 and 100
        and (cover_mobile_position->>'y')::numeric between 0 and 100
      else false end
  );

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
      (select coalesce(jsonb_agg(jsonb_build_object('id',id,'cover_image',cover_image,
        'cover_card_position',cover_card_position,'cover_hero_position',cover_hero_position,
        'cover_mobile_position',cover_mobile_position)),'[]'::jsonb)
       from public.trips where cover_image = row_data->>'url'));
    update public.trips set cover_image = null, cover_card_position = null, cover_hero_position = null, cover_mobile_position = null
      where cover_image = row_data->>'url';
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
    update public.trips set cover_image = cover->>'cover_image',
      cover_card_position = case when cover ? 'cover_card_position' then nullif(cover->'cover_card_position','null'::jsonb) else cover_card_position end,
      cover_hero_position = case when cover ? 'cover_hero_position' then nullif(cover->'cover_hero_position','null'::jsonb) else cover_hero_position end,
      cover_mobile_position = case when cover ? 'cover_mobile_position' then nullif(cover->'cover_mobile_position','null'::jsonb) else null end
      where id = (cover->>'id')::uuid and cover_image is null;
  end loop;
  update public.admin_recycle_bin set restored_at = now() where id = archive_id;
  insert into public.admin_audit_log(action,target,record_id) values ('RESTORE',entry.target,entry.record_id);
end $$;

revoke all on function public.admin_archive_delete(text,uuid), public.admin_restore(uuid) from public, anon, authenticated;
grant execute on function public.admin_archive_delete(text,uuid), public.admin_restore(uuid) to service_role;
notify pgrst, 'reload schema';
