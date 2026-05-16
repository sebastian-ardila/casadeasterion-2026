-- 0044_collections.sql
--
-- Adds the "Colecciones" feature: editorial groupings of books beyond
-- author and category. Each collection has its own slug, name, cover
-- and optional category; a book belongs to 0 or 1 collection via the
-- new `books.collection_id` FK.
--
-- Same RLS / trigger conventions as staff (0043) and collaborators (0040).

-- 1) collections ------------------------------------------------------
create table if not exists public.collections (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  description_md  text,
  cover_image_url text,
  category_id     uuid references public.categories(id) on delete set null,
  sort_order      smallint not null default 0,
  status          text not null default 'published' check (status in ('published','draft')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles(id)
);

create index if not exists collections_sort_idx on public.collections (sort_order, name);
create index if not exists collections_status_idx on public.collections (status);
create index if not exists collections_category_idx on public.collections (category_id);

alter table public.collections enable row level security;

-- Anonymous visitors only see published rows.
drop policy if exists "collections anon select published" on public.collections;
create policy "collections anon select published" on public.collections
  for select to anon
  using (status = 'published');

drop policy if exists "collections authed select all" on public.collections;
create policy "collections authed select all" on public.collections
  for select to authenticated using (true);

drop policy if exists "collections insert" on public.collections;
create policy "collections insert" on public.collections
  for insert to authenticated
  with check ((select public.has_permission((select auth.uid()), 'collections', 'edit')));

drop policy if exists "collections update" on public.collections;
create policy "collections update" on public.collections
  for update to authenticated
  using ((select public.has_permission((select auth.uid()), 'collections', 'edit')))
  with check ((select public.has_permission((select auth.uid()), 'collections', 'edit')));

drop policy if exists "collections delete" on public.collections;
create policy "collections delete" on public.collections
  for delete to authenticated
  using ((select public.has_permission((select auth.uid()), 'collections', 'edit')));

-- House-keeping triggers.
drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function extensions.moddatetime('updated_at');

drop trigger if exists collections_set_updated_by on public.collections;
create trigger collections_set_updated_by
  before insert or update on public.collections
  for each row execute function public.set_updated_by();

-- Rebuild the public site whenever a collection row changes —
-- /colecciones and /colecciones/[slug] are statically generated.
drop trigger if exists collections_rebuild on public.collections;
create trigger collections_rebuild
  after insert or update or delete on public.collections
  for each statement execute procedure public.trigger_amplify_rebuild();

-- 2) admin_permissions: extend resource check to include 'collections' ----
alter table public.admin_permissions
  drop constraint if exists admin_permissions_resource_check;

alter table public.admin_permissions
  add constraint admin_permissions_resource_check
  check (resource in (
    'posts', 'books', 'authors', 'collaborators',
    'categories', 'site', 'orders', 'subscribers', 'admins',
    'staff', 'collections'
  ));

-- Seed: admins + editors get collections=edit by default.
insert into public.admin_permissions (profile_id, resource, level)
select p.id, 'collections', 'edit'
from public.profiles p
where p.role in ('admin', 'editor')
on conflict (profile_id, resource) do nothing;

-- 3) books.collection_id ---------------------------------------------
-- Optional FK from a book to its collection. ON DELETE SET NULL so
-- removing a collection doesn't cascade-delete its books.
alter table public.books
  add column if not exists collection_id uuid references public.collections(id) on delete set null;
create index if not exists books_collection_id_idx on public.books (collection_id);
