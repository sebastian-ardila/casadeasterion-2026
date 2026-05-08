-- Distinguish admin vs editor at the allowlist level. The handle_new_user
-- trigger reads admin_emails.role to decide which profile role to assign.
--
-- editor: produces content (posts/books/authors). Cannot manage CMS users
-- or change site configuration. admin: full CMS access (and can manage
-- editors). owner: hard-coded role on a specific profile.

alter table public.admin_emails
  add column if not exists role text not null default 'admin'
    check (role in ('admin', 'editor'));

-- Replace handle_new_user so it picks the role from admin_emails.role and
-- seeds the matching default permissions. Editors get a curated subset.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  allow_role     text;
  existing_role  text;
  effective_role text;
begin
  if new.email is not null then
    select role into allow_role
    from public.admin_emails ae
    where ae.email = new.email::citext;
  end if;

  select role into existing_role from public.profiles where id = new.id;

  effective_role := case
    when existing_role = 'owner' then 'owner'
    when allow_role is not null    then allow_role
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

  -- Seed default permissions on first login.
  if effective_role = 'admin' then
    insert into public.admin_permissions (profile_id, resource, level)
    select new.id, r, 'edit'
    from unnest(array['posts','books','authors','categories','site']::text[]) as t(r)
    on conflict (profile_id, resource) do nothing;
  elsif effective_role = 'editor' then
    -- Editors: edit posts/books/authors, view categories, none on site.
    insert into public.admin_permissions (profile_id, resource, level) values
      (new.id, 'posts',      'edit'),
      (new.id, 'books',      'edit'),
      (new.id, 'authors',    'edit'),
      (new.id, 'categories', 'view'),
      (new.id, 'site',       'none')
    on conflict (profile_id, resource) do nothing;
  end if;

  return new;
end;
$$;

-- Same logic when an email is added to the allowlist after the user
-- already signed up: promote in place + seed the appropriate permissions.

create or replace function public.handle_admin_email_added()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  promoted_id uuid;
  target_role text := new.role;
begin
  update public.profiles
     set role = target_role, updated_at = now()
   where email = new.email and role <> 'owner' and role <> target_role
   returning id into promoted_id;

  if promoted_id is null then
    -- Profile already at target role (or an existing owner — leave alone).
    select id into promoted_id
    from public.profiles
    where email = new.email and role = target_role;
  end if;

  if promoted_id is not null then
    if target_role = 'admin' then
      insert into public.admin_permissions (profile_id, resource, level)
      select promoted_id, r, 'edit'
      from unnest(array['posts','books','authors','categories','site']::text[]) as t(r)
      on conflict (profile_id, resource) do nothing;
    elsif target_role = 'editor' then
      insert into public.admin_permissions (profile_id, resource, level) values
        (promoted_id, 'posts',      'edit'),
        (promoted_id, 'books',      'edit'),
        (promoted_id, 'authors',    'edit'),
        (promoted_id, 'categories', 'view'),
        (promoted_id, 'site',       'none')
      on conflict (profile_id, resource) do nothing;
    end if;
  end if;

  return new;
end;
$$;

-- is_admin() RPC: editors are also CMS users. Treat editor as admin for
-- the purposes of "may write through RLS policies that gate on this".
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role in ('owner', 'admin', 'editor')
  );
$$;
