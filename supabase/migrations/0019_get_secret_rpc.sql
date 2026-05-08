-- Edge functions can't reach the `vault` schema through PostgREST because
-- the API config only exposes `public`. Provide a tiny SECURITY DEFINER
-- wrapper they can call via supabase.rpc('get_secret', { name }).
--
-- Restricted to service_role: this function reads decrypted vault secrets,
-- so anon/authenticated must never be able to call it. Edge functions
-- always authenticate as service_role, so they can.

create or replace function public.get_secret(p_name text)
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = p_name
  limit 1;
$$;

revoke all on function public.get_secret(text) from public;
revoke all on function public.get_secret(text) from anon, authenticated;
grant execute on function public.get_secret(text) to service_role;
