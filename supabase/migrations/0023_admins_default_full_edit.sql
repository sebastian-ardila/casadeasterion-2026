-- Pre-approved admins should arrive with full edit permissions on every
-- section by default. Without this, a freshly-created admin profile has
-- no rows in admin_permissions → getPermission returns 'none' for every
-- resource → the new admin sees a locked-out CMS until the owner clicks
-- through every section to flip the levels.
--
-- Seeding is idempotent (ON CONFLICT DO NOTHING) so the owner's later
-- adjustments are preserved on subsequent logins.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  is_admin_email boolean := false;
  existing_role  text;
  effective_role text;
begin
  if new.email is not null then
    select exists (select 1 from public.admin_emails ae where ae.email = new.email::citext)
      into is_admin_email;
  end if;

  select role into existing_role from public.profiles where id = new.id;

  effective_role := case
    when existing_role = 'owner' then 'owner'
    when is_admin_email then 'admin'
    else 'viewer'
  end;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email::citext,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    effective_role
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  -- Seed full edit permissions for new admins. Idempotent — preserves
  -- whatever the owner has already configured if the row already exists.
  if effective_role = 'admin' then
    insert into public.admin_permissions (profile_id, resource, level)
    select new.id, r, 'edit'
    from unnest(array['posts','books','authors','categories','site']::text[]) as t(r)
    on conflict (profile_id, resource) do nothing;
  end if;

  return new;
end;
$$;

-- Mirror the seed in the trigger that runs when an email is added to
-- admin_emails AFTER the user has already signed up (their profile is
-- promoted from viewer → admin in place).
create or replace function public.handle_admin_email_added()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  promoted_id uuid;
begin
  update public.profiles
     set role = 'admin', updated_at = now()
   where email = new.email and role <> 'admin'
   returning id into promoted_id;

  if promoted_id is not null then
    insert into public.admin_permissions (profile_id, resource, level)
    select promoted_id, r, 'edit'
    from unnest(array['posts','books','authors','categories','site']::text[]) as t(r)
    on conflict (profile_id, resource) do nothing;
  end if;

  return new;
end;
$$;

-- Backfill: any existing admin missing rows now gets 'edit' for the
-- defaults. Anything the owner already set explicitly stays.
insert into public.admin_permissions (profile_id, resource, level)
select p.id, r, 'edit'
from public.profiles p
cross join unnest(array['posts','books','authors','categories','site']::text[]) as t(r)
where p.role = 'admin'
on conflict (profile_id, resource) do nothing;
