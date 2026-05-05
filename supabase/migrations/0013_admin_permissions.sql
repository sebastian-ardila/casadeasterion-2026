-- Roles & granular admin permissions per CMS resource.
-- 'owner' = full access (no admin_permissions rows needed)
-- 'admin' = per-resource permission required via admin_permissions
-- 'viewer' = no CMS access (default for new sign-ups)

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('owner', 'admin', 'editor', 'viewer'));

update public.profiles set role = 'owner'
where email = 'sebas.dila@gmail.com'::citext and role <> 'owner';

create table if not exists public.admin_permissions (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  resource    text not null check (resource in ('posts','books','authors','categories','site')),
  level       text not null default 'none' check (level in ('none','view','edit')),
  updated_at  timestamptz not null default now(),
  primary key (profile_id, resource)
);

drop trigger if exists admin_permissions_set_updated_at on public.admin_permissions;
create trigger admin_permissions_set_updated_at
before update on public.admin_permissions
for each row execute procedure extensions.moddatetime(updated_at);

create or replace function public.is_owner(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = uid and role = 'owner');
$$;
revoke all on function public.is_owner(uuid) from public;
grant execute on function public.is_owner(uuid) to anon, authenticated, service_role;

create or replace function public.has_permission(uid uuid, res text, lvl text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.is_owner(uid) then true
    when not public.is_admin(uid) then false
    when lvl = 'view' then exists (
      select 1 from public.admin_permissions
      where profile_id = uid and resource = res and level in ('view','edit')
    )
    when lvl = 'edit' then exists (
      select 1 from public.admin_permissions
      where profile_id = uid and resource = res and level = 'edit'
    )
    else false
  end;
$$;
revoke all on function public.has_permission(uuid, text, text) from public;
grant execute on function public.has_permission(uuid, text, text) to anon, authenticated, service_role;

create or replace function public.handle_admin_email_added()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set role = 'admin', updated_at = now()
   where email = new.email and role not in ('admin', 'owner');
  return new;
end;
$$;

create or replace function public.handle_admin_email_removed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set role = 'viewer', updated_at = now()
   where email = old.email and role = 'admin';
  return old;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  is_admin_email boolean := false;
  existing_role text;
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

alter table public.admin_permissions enable row level security;

drop policy if exists "admin_permissions read self or owner" on public.admin_permissions;
create policy "admin_permissions read self or owner"
  on public.admin_permissions for select to authenticated
  using (public.is_owner((select auth.uid())) or profile_id = (select auth.uid()));

drop policy if exists "admin_permissions owner write" on public.admin_permissions;
create policy "admin_permissions owner write"
  on public.admin_permissions for all to authenticated
  using (public.is_owner((select auth.uid())))
  with check (public.is_owner((select auth.uid())));
