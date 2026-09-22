-- Enables irreversible photo cleanup from the admin recycle bin.
begin;

grant delete on public.admin_recycle_bin to service_role;

create or replace function public.admin_purge_archive(archive_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare entry public.admin_recycle_bin;
begin
  select * into entry from public.admin_recycle_bin
    where id = archive_id and restored_at is null and target = 'photos' for update;
  if not found then raise exception 'Archive not available'; end if;
  delete from public.admin_recycle_bin where id = archive_id;
  insert into public.admin_audit_log(action,target,record_id,before_data)
    values ('PURGE','photos',entry.record_id,entry.payload);
end $$;

revoke all on function public.admin_purge_archive(uuid) from public, anon, authenticated;
grant execute on function public.admin_purge_archive(uuid) to service_role;
notify pgrst, 'reload schema';
commit;
