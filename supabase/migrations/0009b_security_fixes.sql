-- 1. Drop legacy function from previous public.users table.
drop function if exists public.update_updated_at_column() cascade;

-- 2. Pin search_path on set_updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 3. Move extensions out of public schema.
create schema if not exists extensions;
alter extension citext   set schema extensions;
alter extension pg_trgm  set schema extensions;
alter extension unaccent set schema extensions;

-- 4. Update functions referencing citext via search_path.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  is_admin_email boolean := false;
begin
  if new.email is not null then
    select exists (select 1 from public.admin_emails ae where ae.email = new.email::extensions.citext)
      into is_admin_email;
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email::extensions.citext,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    case when is_admin_email then 'admin' else 'viewer' end
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  return new;
end;
$$;

-- 5. Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_admin_email_added() from public, anon, authenticated;
revoke execute on function public.handle_admin_email_removed() from public, anon, authenticated;
revoke execute on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;

revoke execute on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated, service_role;
