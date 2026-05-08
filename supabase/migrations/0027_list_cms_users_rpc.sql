-- Owner/admin user-management views need last_sign_in_at to show when each
-- person was last active. That column lives on auth.users which isn't
-- exposed to the public schema, so this SECURITY DEFINER RPC joins it in
-- and is callable only by users that pass is_admin().

create or replace function public.list_cms_users()
returns table (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  role text,
  last_sign_in_at timestamptz
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
         u.last_sign_in_at
    from public.profiles p
    left join auth.users u on u.id = p.id
   where p.role in ('owner', 'admin', 'editor')
     and public.is_admin(auth.uid());
$$;

revoke all on function public.list_cms_users() from public;
grant execute on function public.list_cms_users() to authenticated;
