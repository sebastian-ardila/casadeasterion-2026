-- Solo dispara rebuild cuando el cambio afecta al sitio público:
-- - posts/books: cuando se publica, se modifica un publicado, o se despublica
-- - authors/categories/site_configuration: cualquier cambio

drop trigger if exists posts_rebuild on public.posts;
drop trigger if exists books_rebuild on public.books;
drop trigger if exists authors_rebuild on public.authors;
drop trigger if exists categories_rebuild on public.categories;
drop trigger if exists site_configuration_rebuild on public.site_configuration;

create trigger posts_rebuild_insert
  after insert on public.posts
  for each row
  when (new.status = 'published')
  execute procedure public.trigger_amplify_rebuild();

create trigger posts_rebuild_update
  after update on public.posts
  for each row
  when (new.status = 'published' or old.status = 'published')
  execute procedure public.trigger_amplify_rebuild();

create trigger posts_rebuild_delete
  after delete on public.posts
  for each row
  when (old.status = 'published')
  execute procedure public.trigger_amplify_rebuild();

create trigger books_rebuild_insert
  after insert on public.books
  for each row
  when (new.status = 'published')
  execute procedure public.trigger_amplify_rebuild();

create trigger books_rebuild_update
  after update on public.books
  for each row
  when (new.status = 'published' or old.status = 'published')
  execute procedure public.trigger_amplify_rebuild();

create trigger books_rebuild_delete
  after delete on public.books
  for each row
  when (old.status = 'published')
  execute procedure public.trigger_amplify_rebuild();

create trigger authors_rebuild
  after insert or update or delete on public.authors
  for each statement execute procedure public.trigger_amplify_rebuild();

create trigger categories_rebuild
  after insert or update or delete on public.categories
  for each statement execute procedure public.trigger_amplify_rebuild();

create trigger site_configuration_rebuild
  after insert or update or delete on public.site_configuration
  for each statement execute procedure public.trigger_amplify_rebuild();
