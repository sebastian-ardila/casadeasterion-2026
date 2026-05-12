-- Adds three pieces:
--
-- 1. `collaborators` table — mirror of `authors`. A second class of
--    people we associate to publications (posts). Same shape so the
--    CMS forms and public pages can reuse the components/queries.
--
-- 2. `post_collaborators` junction — many-to-many between posts and
--    collaborators with sort_order, mirroring post_authors.
--
-- 3. `posts.book_id` — optional FK to books. When a publication is
--    part of a book, this points to that book; otherwise it's null.
--    ON DELETE SET NULL so deleting a book doesn't cascade-delete
--    its publications.

-- 1. collaborators table ----------------------------------------------

create table if not exists public.collaborators (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  bio_md      text,
  photo_url   text,
  links       jsonb not null default '{}'::jsonb,
  keywords    text[],
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id)
);

create index if not exists collaborators_name_idx on public.collaborators (name);

alter table public.collaborators enable row level security;

drop policy if exists "collaborators select all" on public.collaborators;
create policy "collaborators select all" on public.collaborators
  for select to anon, authenticated using (true);

drop policy if exists "collaborators insert" on public.collaborators;
create policy "collaborators insert" on public.collaborators
  for insert to authenticated
  with check ((select public.has_permission((select auth.uid()), 'collaborators', 'edit')));

drop policy if exists "collaborators update" on public.collaborators;
create policy "collaborators update" on public.collaborators
  for update to authenticated
  using ((select public.has_permission((select auth.uid()), 'collaborators', 'edit')))
  with check ((select public.has_permission((select auth.uid()), 'collaborators', 'edit')));

drop policy if exists "collaborators delete" on public.collaborators;
create policy "collaborators delete" on public.collaborators
  for delete to authenticated
  using ((select public.has_permission((select auth.uid()), 'collaborators', 'edit')));

-- House-keeping triggers (mirror of authors)
drop trigger if exists collaborators_set_updated_at on public.collaborators;
create trigger collaborators_set_updated_at
  before update on public.collaborators
  for each row execute function extensions.moddatetime('updated_at');

drop trigger if exists collaborators_set_updated_by on public.collaborators;
create trigger collaborators_set_updated_by
  before insert or update on public.collaborators
  for each row execute function public.set_updated_by();

-- Any change to a collaborator can affect a published publication,
-- so re-trigger an Amplify build on every change.
drop trigger if exists collaborators_rebuild on public.collaborators;
create trigger collaborators_rebuild
  after insert or update or delete on public.collaborators
  for each statement execute procedure public.trigger_amplify_rebuild();

-- 2. post_collaborators junction --------------------------------------

create table if not exists public.post_collaborators (
  post_id          uuid not null references public.posts(id) on delete cascade,
  collaborator_id  uuid not null references public.collaborators(id) on delete cascade,
  sort_order       smallint not null default 0,
  created_at       timestamptz not null default now(),
  primary key (post_id, collaborator_id)
);
create index if not exists post_collaborators_post_sort_idx
  on public.post_collaborators (post_id, sort_order);
create index if not exists post_collaborators_collab_idx
  on public.post_collaborators (collaborator_id);

alter table public.post_collaborators enable row level security;

drop policy if exists post_collaborators_anon_select on public.post_collaborators;
create policy post_collaborators_anon_select on public.post_collaborators
  for select to anon
  using (exists (select 1 from public.posts p where p.id = post_collaborators.post_id and p.status = 'published'));

drop policy if exists post_collaborators_authed_select on public.post_collaborators;
create policy post_collaborators_authed_select on public.post_collaborators
  for select to authenticated using (true);

-- Escrituras gated by the same permission as the parent posts table.
drop policy if exists post_collaborators_admin_all on public.post_collaborators;
create policy post_collaborators_admin_all on public.post_collaborators
  for all to authenticated
  using (public.has_permission((select auth.uid()), 'posts', 'edit'))
  with check (public.has_permission((select auth.uid()), 'posts', 'edit'));

-- Junction-level rebuild trigger (mirror of post_authors version 0039).
-- SECURITY DEFINER so it can call queue_rebuild even when the writer
-- is the authenticated role (which doesn't have EXECUTE on it).
create or replace function public.trigger_rebuild_post_collaborators()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  is_published boolean;
  target_post uuid;
begin
  target_post := coalesce(new.post_id, old.post_id);
  select (status = 'published') into is_published from public.posts where id = target_post;
  if is_published then
    perform public.queue_rebuild();
  end if;
  return null;
end;
$$;

drop trigger if exists post_collaborators_rebuild on public.post_collaborators;
create trigger post_collaborators_rebuild
  after insert or update or delete on public.post_collaborators
  for each row execute function public.trigger_rebuild_post_collaborators();

-- 3. posts.book_id ----------------------------------------------------
-- Optional link from a publication to the book it belongs to. Some
-- publications are standalone; some are essays / introductions /
-- excerpts of a specific book. The detail page on the public site
-- surfaces this association when present.

alter table public.posts
  add column if not exists book_id uuid references public.books(id) on delete set null;
create index if not exists posts_book_id_idx on public.posts (book_id);
