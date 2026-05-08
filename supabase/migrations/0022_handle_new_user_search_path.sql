-- Fix: handle_new_user trigger fails on `new.email::citext` because the
-- function's search_path didn't include the `extensions` schema (where
-- the citext type lives in Supabase). Result: every new OAuth signup
-- aborted at the auth.users insert with "Database error saving new user".
-- Postgres logs showed:
--   ERROR: type "citext" does not exist
--   ERROR: current transaction is aborted, commands ignored until end
--          of transaction block
--
-- Same fix applied to handle_admin_email_added — even though it doesn't
-- cast, the citext = citext comparison relies on operators that live in
-- the extensions schema, so the search_path must reach them.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  is_admin_email boolean := false;
  existing_role  text;
begin
  if new.email is not null then
    select exists (select 1 from public.admin_emails ae where ae.email = new.email::citext)
      into is_admin_email;
  end if;

  select role into existing_role from public.profiles where id = new.id;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email::citext,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    case
      when existing_role = 'owner' then 'owner'
      when is_admin_email then 'admin'
      else 'viewer'
    end
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  return new;
end;
$$;

create or replace function public.handle_admin_email_added()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.profiles
     set role = 'admin', updated_at = now()
   where email = new.email and role <> 'admin';
  return new;
end;
$$;
