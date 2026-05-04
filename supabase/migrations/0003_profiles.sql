-- profiles: mirrors auth.users with a role.
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        citext not null,
  full_name    text,
  avatar_url   text,
  role         text not null default 'viewer'
               check (role in ('admin','editor','viewer')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index profiles_email_idx on public.profiles (email);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure extensions.moddatetime(updated_at);

-- admin_emails: allowlist managed from the CMS.
create table public.admin_emails (
  email      citext primary key,
  added_at   timestamptz not null default now(),
  added_by   uuid references public.profiles(id) on delete set null,
  note       text
);

insert into public.admin_emails (email) values ('sebas.dila@gmail.com')
on conflict (email) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  is_admin_email boolean := false;
begin
  if new.email is not null then
    select exists (select 1 from public.admin_emails ae where ae.email = new.email::citext)
      into is_admin_email;
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email::citext,
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.handle_admin_email_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set role = 'admin', updated_at = now()
   where email = new.email and role <> 'admin';
  return new;
end;
$$;

create trigger admin_emails_promote
after insert on public.admin_emails
for each row execute procedure public.handle_admin_email_added();

create or replace function public.handle_admin_email_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set role = 'viewer', updated_at = now()
   where email = old.email and role = 'admin';
  return old;
end;
$$;

create trigger admin_emails_demote
after delete on public.admin_emails
for each row execute procedure public.handle_admin_email_removed();

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to anon, authenticated, service_role;

insert into public.profiles (id, email, full_name, avatar_url, role)
select
  u.id,
  u.email::citext,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
  u.raw_user_meta_data->>'avatar_url',
  case when exists (select 1 from public.admin_emails ae where ae.email = u.email::citext)
       then 'admin' else 'viewer' end
from auth.users u
where u.email is not null
on conflict (id) do nothing;
