-- Multi-author support for books and posts.
--
-- Adds two many-to-many junction tables (book_authors, post_authors) with
-- a sort_order so the CMS can pick an arbitrary author order. Existing
-- single-author rows are backfilled with sort_order = 0.
--
-- books.author_id / posts.author_id are kept as a denormalized "primary
-- author" pointer (= the author at sort_order 0) so existing card / list
-- queries that join only on author_id keep working without rewrite. The
-- sync_*_primary_author triggers maintain this invariant automatically
-- on every junction change.
--
-- Rebuild triggers fire on junction changes for published parents so the
-- public SSG site re-renders when the author list changes.

-- 1. Junction tables ---------------------------------------------------

create table if not exists public.book_authors (
  book_id uuid not null references public.books(id) on delete cascade,
  author_id uuid not null references public.authors(id) on delete cascade,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  primary key (book_id, author_id)
);
create index if not exists book_authors_book_sort_idx
  on public.book_authors (book_id, sort_order);
create index if not exists book_authors_author_idx
  on public.book_authors (author_id);

create table if not exists public.post_authors (
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.authors(id) on delete cascade,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  primary key (post_id, author_id)
);
create index if not exists post_authors_post_sort_idx
  on public.post_authors (post_id, sort_order);
create index if not exists post_authors_author_idx
  on public.post_authors (author_id);

-- 2. RLS ---------------------------------------------------------------

alter table public.book_authors enable row level security;
alter table public.post_authors enable row level security;

-- Anon can read junction rows only for published parents (mirrors the
-- visibility rules on books/posts themselves).
drop policy if exists book_authors_anon_select on public.book_authors;
create policy book_authors_anon_select on public.book_authors
  for select to anon
  using (
    exists (
      select 1 from public.books b
      where b.id = book_authors.book_id and b.status = 'published'
    )
  );

drop policy if exists book_authors_authed_select on public.book_authors;
create policy book_authors_authed_select on public.book_authors
  for select to authenticated using (true);

-- Admin/editor write access mirrors the parent books policy.
drop policy if exists book_authors_admin_all on public.book_authors;
create policy book_authors_admin_all on public.book_authors
  for all to authenticated
  using (public.has_permission((select auth.uid()), 'books', 'edit'))
  with check (public.has_permission((select auth.uid()), 'books', 'edit'));

drop policy if exists post_authors_anon_select on public.post_authors;
create policy post_authors_anon_select on public.post_authors
  for select to anon
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_authors.post_id and p.status = 'published'
    )
  );

drop policy if exists post_authors_authed_select on public.post_authors;
create policy post_authors_authed_select on public.post_authors
  for select to authenticated using (true);

-- Admin/editor write access mirrors the parent posts policy.
drop policy if exists post_authors_admin_all on public.post_authors;
create policy post_authors_admin_all on public.post_authors
  for all to authenticated
  using (public.has_permission((select auth.uid()), 'posts', 'edit'))
  with check (public.has_permission((select auth.uid()), 'posts', 'edit'));

-- 3. Backfill from existing single-author columns ----------------------

insert into public.book_authors (book_id, author_id, sort_order)
select id, author_id, 0 from public.books where author_id is not null
on conflict do nothing;

insert into public.post_authors (post_id, author_id, sort_order)
select id, author_id, 0 from public.posts where author_id is not null
on conflict do nothing;

-- 4. Maintenance triggers: sync books.author_id / posts.author_id ------

create or replace function public.sync_book_primary_author()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_book uuid;
  new_primary uuid;
begin
  target_book := coalesce(new.book_id, old.book_id);
  select author_id into new_primary
    from public.book_authors
    where book_id = target_book
    order by sort_order, created_at
    limit 1;
  update public.books set author_id = new_primary
    where id = target_book and author_id is distinct from new_primary;
  return null;
end;
$$;

drop trigger if exists book_authors_sync_primary on public.book_authors;
create trigger book_authors_sync_primary
  after insert or update or delete on public.book_authors
  for each row execute function public.sync_book_primary_author();

create or replace function public.sync_post_primary_author()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_post uuid;
  new_primary uuid;
begin
  target_post := coalesce(new.post_id, old.post_id);
  select author_id into new_primary
    from public.post_authors
    where post_id = target_post
    order by sort_order, created_at
    limit 1;
  update public.posts set author_id = new_primary
    where id = target_post and author_id is distinct from new_primary;
  return null;
end;
$$;

drop trigger if exists post_authors_sync_primary on public.post_authors;
create trigger post_authors_sync_primary
  after insert or update or delete on public.post_authors
  for each row execute function public.sync_post_primary_author();

-- 5. Rebuild triggers for junction changes -----------------------------
-- A pure reorder (same authors, different sort_order) does not change
-- author_id, so the books/posts UPDATE trigger from 0012 does not fire.
-- We need an explicit trigger here to catch that case.

create or replace function public.trigger_rebuild_book_authors()
returns trigger
language plpgsql
as $$
declare
  is_published boolean;
  target_book uuid;
begin
  target_book := coalesce(new.book_id, old.book_id);
  select (status = 'published') into is_published
    from public.books where id = target_book;
  if is_published then
    perform public.trigger_amplify_rebuild();
  end if;
  return null;
end;
$$;

drop trigger if exists book_authors_rebuild on public.book_authors;
create trigger book_authors_rebuild
  after insert or update or delete on public.book_authors
  for each row execute function public.trigger_rebuild_book_authors();

create or replace function public.trigger_rebuild_post_authors()
returns trigger
language plpgsql
as $$
declare
  is_published boolean;
  target_post uuid;
begin
  target_post := coalesce(new.post_id, old.post_id);
  select (status = 'published') into is_published
    from public.posts where id = target_post;
  if is_published then
    perform public.trigger_amplify_rebuild();
  end if;
  return null;
end;
$$;

drop trigger if exists post_authors_rebuild on public.post_authors;
create trigger post_authors_rebuild
  after insert or update or delete on public.post_authors
  for each row execute function public.trigger_rebuild_post_authors();
