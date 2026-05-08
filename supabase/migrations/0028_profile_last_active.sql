-- Track activity (any authenticated CMS request) instead of just login.
-- The CMS calls touch_profile_activity() at most once every few minutes per
-- session, so this is one cheap UPDATE per active user.

alter table public.profiles
  add column if not exists last_active_at timestamptz;

create or replace function public.touch_profile_activity()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  ts timestamptz := now();
begin
  update public.profiles
     set last_active_at = ts
   where id = auth.uid();
  return ts;
end;
$$;

revoke all on function public.touch_profile_activity() from public;
grant execute on function public.touch_profile_activity() to authenticated;

-- Replace list_cms_users to also expose last_active_at. Drop first because
-- Postgres won't let CREATE OR REPLACE change the OUT-param row type.
drop function if exists public.list_cms_users();

create function public.list_cms_users()
returns table (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  role text,
  last_sign_in_at timestamptz,
  last_active_at timestamptz
)
language sql
security definer
stable
set search_path = public, auth
as $$
  select p.id,
         p.email::text,
         p.full_name,
         p.avatar_url,
         p.role,
         u.last_sign_in_at,
         p.last_active_at
    from public.profiles p
    left join auth.users u on u.id = p.id
   where p.role in ('owner', 'admin', 'editor')
     and public.is_admin(auth.uid());
$$;

revoke all on function public.list_cms_users() from public;
grant execute on function public.list_cms_users() to authenticated;
