-- Triggers que disparan un build de AWS Amplify cuando cambia contenido
-- relevante para el sitio público. La URL del Build Hook vive cifrada en
-- vault.secrets bajo la clave 'amplify_build_hook_url'. Si aún no existe,
-- la función no hace nada (silent no-op).

create or replace function public.trigger_amplify_rebuild()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  hook_url text;
begin
  select decrypted_secret into hook_url
    from vault.decrypted_secrets
   where name = 'amplify_build_hook_url'
   limit 1;

  if hook_url is null or hook_url = '' then
    return null;
  end if;

  perform extensions.net.http_post(
    url := hook_url,
    headers := jsonb_build_object('content-type', 'application/json'),
    body := jsonb_build_object(
      'source', 'supabase',
      'table', tg_table_name,
      'op', tg_op,
      'at', now()
    )
  );

  return null;
exception when others then
  raise warning 'amplify rebuild trigger failed: %', sqlerrm;
  return null;
end;
$$;

revoke all on function public.trigger_amplify_rebuild() from public, anon, authenticated;

drop trigger if exists posts_rebuild on public.posts;
create trigger posts_rebuild
  after insert or update or delete on public.posts
  for each statement execute procedure public.trigger_amplify_rebuild();

drop trigger if exists books_rebuild on public.books;
create trigger books_rebuild
  after insert or update or delete on public.books
  for each statement execute procedure public.trigger_amplify_rebuild();

drop trigger if exists authors_rebuild on public.authors;
create trigger authors_rebuild
  after insert or update or delete on public.authors
  for each statement execute procedure public.trigger_amplify_rebuild();

drop trigger if exists categories_rebuild on public.categories;
create trigger categories_rebuild
  after insert or update or delete on public.categories
  for each statement execute procedure public.trigger_amplify_rebuild();

drop trigger if exists site_configuration_rebuild on public.site_configuration;
create trigger site_configuration_rebuild
  after insert or update or delete on public.site_configuration
  for each statement execute procedure public.trigger_amplify_rebuild();
