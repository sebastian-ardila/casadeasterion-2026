-- Owner-only RPC that fully removes a user from the system: deletes the
-- auth.users row (which cascades to profiles → admin_permissions),
-- and tidies up loose ends (admin_emails entry, subscriber row by email).
--
-- Used by the CMS's "Eliminar usuario completamente" button alongside
-- the existing "Revocar acceso" (which only removes from admin_emails).
--
-- We require the caller to be the owner because this is destructive.
-- Self-deletion is rejected so the only owner can't lock themselves out.

create or replace function public.delete_admin_user(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  caller_id uuid := auth.uid();
  target_email citext;
begin
  if caller_id is null or not public.is_owner(caller_id) then
    raise exception 'forbidden: owner only' using errcode = '42501';
  end if;

  if target_id = caller_id then
    raise exception 'cannot delete yourself' using errcode = '22023';
  end if;

  -- Capture the email so we can clean up admin_emails / subscribers,
  -- which key by email rather than user id.
  select email into target_email from public.profiles where id = target_id;

  delete from public.admin_emails  where email = target_email;
  delete from public.subscribers   where email = target_email;
  -- Cascades to profiles → admin_permissions.
  delete from auth.users where id = target_id;
end;
$$;

revoke all on function public.delete_admin_user(uuid) from public;
revoke all on function public.delete_admin_user(uuid) from anon, authenticated;
grant execute on function public.delete_admin_user(uuid) to authenticated;
