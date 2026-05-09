-- Track who last edited a row in each content table. The CMS shows
-- this in the ListPanel ("Editado por X · hace 2 días") so editors
-- can see at a glance who touched what.
--
-- updated_by is set automatically by a trigger reading auth.uid(),
-- so callers don't have to remember to write it. ON DELETE SET NULL
-- handles the "user got removed from CMS" case gracefully — the
-- timestamp survives, just without an attributable name.

alter table public.posts
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;
alter table public.books
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;
alter table public.authors
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;
alter table public.categories
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

create or replace function public.set_updated_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- auth.uid() is null for service-role / trigger-driven writes
  -- (e.g. amplify rebuild trigger). In that case we leave whatever
  -- the row already had instead of clobbering it with NULL.
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists posts_set_updated_by on public.posts;
create trigger posts_set_updated_by
  before insert or update on public.posts
  for each row execute procedure public.set_updated_by();

drop trigger if exists books_set_updated_by on public.books;
create trigger books_set_updated_by
  before insert or update on public.books
  for each row execute procedure public.set_updated_by();

drop trigger if exists authors_set_updated_by on public.authors;
create trigger authors_set_updated_by
  before insert or update on public.authors
  for each row execute procedure public.set_updated_by();

drop trigger if exists categories_set_updated_by on public.categories;
create trigger categories_set_updated_by
  before insert or update on public.categories
  for each row execute procedure public.set_updated_by();
