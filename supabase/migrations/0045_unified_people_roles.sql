-- 0045_unified_people_roles.sql
--
-- Unifica todas las personas (autores, colaboradores, traductores,
-- prologuistas) bajo la tabla `authors`. Una persona = una fila, con
-- `role_tags text[]` indicando qué roles cumple. Las junctions
-- separadas por rol mantienen la relación con libros y posts.
--
-- - Borra `collaborators` y `post_collaborators` (0 filas).
-- - Crea 6 junctions nuevas con FK a authors.
-- - Extiende admin_permissions resource CHECK con translators y prologuists.
-- - Seed permisos para los nuevos recursos.

-- 1) authors.role_tags -----------------------------------------------
alter table public.authors
  add column if not exists role_tags text[] not null default '{}'::text[];

-- Backfill: todas las personas existentes son autores (eso es lo que
-- estaba almacenado en authors hasta ahora).
update public.authors
  set role_tags = array['author']
  where role_tags = '{}'::text[];

alter table public.authors
  drop constraint if exists authors_role_tags_check;
alter table public.authors
  add constraint authors_role_tags_check
  check (role_tags <@ array['author','collaborator','translator','prologuist']::text[]);

create index if not exists authors_role_tags_idx on public.authors using gin (role_tags);

-- 2) Borrar y reconstruir collaborators ------------------------------
-- 0 filas → migración trivial. La nueva post_collaborators apunta a
-- authors, no a una tabla separada.
drop table if exists public.post_collaborators;
drop table if exists public.collaborators;

-- 3) Junctions nuevas (mirror book_authors / post_authors) -----------

-- books × authors por rol
create table if not exists public.book_collaborators (
  book_id    uuid not null references public.books(id)   on delete cascade,
  author_id  uuid not null references public.authors(id) on delete cascade,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  primary key (book_id, author_id)
);
create index if not exists book_collaborators_book_sort_idx on public.book_collaborators (book_id, sort_order);
create index if not exists book_collaborators_author_idx on public.book_collaborators (author_id);

create table if not exists public.book_translators (
  book_id    uuid not null references public.books(id)   on delete cascade,
  author_id  uuid not null references public.authors(id) on delete cascade,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  primary key (book_id, author_id)
);
create index if not exists book_translators_book_sort_idx on public.book_translators (book_id, sort_order);
create index if not exists book_translators_author_idx on public.book_translators (author_id);

create table if not exists public.book_prologuists (
  book_id    uuid not null references public.books(id)   on delete cascade,
  author_id  uuid not null references public.authors(id) on delete cascade,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  primary key (book_id, author_id)
);
create index if not exists book_prologuists_book_sort_idx on public.book_prologuists (book_id, sort_order);
create index if not exists book_prologuists_author_idx on public.book_prologuists (author_id);

-- posts × authors por rol
create table if not exists public.post_collaborators (
  post_id    uuid not null references public.posts(id)   on delete cascade,
  author_id  uuid not null references public.authors(id) on delete cascade,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  primary key (post_id, author_id)
);
create index if not exists post_collaborators_post_sort_idx on public.post_collaborators (post_id, sort_order);
create index if not exists post_collaborators_author_idx on public.post_collaborators (author_id);

create table if not exists public.post_translators (
  post_id    uuid not null references public.posts(id)   on delete cascade,
  author_id  uuid not null references public.authors(id) on delete cascade,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  primary key (post_id, author_id)
);
create index if not exists post_translators_post_sort_idx on public.post_translators (post_id, sort_order);
create index if not exists post_translators_author_idx on public.post_translators (author_id);

create table if not exists public.post_prologuists (
  post_id    uuid not null references public.posts(id)   on delete cascade,
  author_id  uuid not null references public.authors(id) on delete cascade,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  primary key (post_id, author_id)
);
create index if not exists post_prologuists_post_sort_idx on public.post_prologuists (post_id, sort_order);
create index if not exists post_prologuists_author_idx on public.post_prologuists (author_id);

-- 4) RLS (mirror book_authors / post_authors) ------------------------

alter table public.book_collaborators enable row level security;
alter table public.book_translators   enable row level security;
alter table public.book_prologuists   enable row level security;
alter table public.post_collaborators enable row level security;
alter table public.post_translators   enable row level security;
alter table public.post_prologuists   enable row level security;

-- book_collaborators
drop policy if exists book_collaborators_anon_select on public.book_collaborators;
create policy book_collaborators_anon_select on public.book_collaborators
  for select to anon
  using (exists (select 1 from public.books b where b.id = book_collaborators.book_id and b.status = 'published'));
drop policy if exists book_collaborators_authed_select on public.book_collaborators;
create policy book_collaborators_authed_select on public.book_collaborators
  for select to authenticated using (true);
drop policy if exists book_collaborators_admin_all on public.book_collaborators;
create policy book_collaborators_admin_all on public.book_collaborators
  for all to authenticated
  using (public.has_permission((select auth.uid()), 'books', 'edit'))
  with check (public.has_permission((select auth.uid()), 'books', 'edit'));

-- book_translators
drop policy if exists book_translators_anon_select on public.book_translators;
create policy book_translators_anon_select on public.book_translators
  for select to anon
  using (exists (select 1 from public.books b where b.id = book_translators.book_id and b.status = 'published'));
drop policy if exists book_translators_authed_select on public.book_translators;
create policy book_translators_authed_select on public.book_translators
  for select to authenticated using (true);
drop policy if exists book_translators_admin_all on public.book_translators;
create policy book_translators_admin_all on public.book_translators
  for all to authenticated
  using (public.has_permission((select auth.uid()), 'books', 'edit'))
  with check (public.has_permission((select auth.uid()), 'books', 'edit'));

-- book_prologuists
drop policy if exists book_prologuists_anon_select on public.book_prologuists;
create policy book_prologuists_anon_select on public.book_prologuists
  for select to anon
  using (exists (select 1 from public.books b where b.id = book_prologuists.book_id and b.status = 'published'));
drop policy if exists book_prologuists_authed_select on public.book_prologuists;
create policy book_prologuists_authed_select on public.book_prologuists
  for select to authenticated using (true);
drop policy if exists book_prologuists_admin_all on public.book_prologuists;
create policy book_prologuists_admin_all on public.book_prologuists
  for all to authenticated
  using (public.has_permission((select auth.uid()), 'books', 'edit'))
  with check (public.has_permission((select auth.uid()), 'books', 'edit'));

-- post_collaborators
drop policy if exists post_collaborators_anon_select on public.post_collaborators;
create policy post_collaborators_anon_select on public.post_collaborators
  for select to anon
  using (exists (select 1 from public.posts p where p.id = post_collaborators.post_id and p.status = 'published'));
drop policy if exists post_collaborators_authed_select on public.post_collaborators;
create policy post_collaborators_authed_select on public.post_collaborators
  for select to authenticated using (true);
drop policy if exists post_collaborators_admin_all on public.post_collaborators;
create policy post_collaborators_admin_all on public.post_collaborators
  for all to authenticated
  using (public.has_permission((select auth.uid()), 'posts', 'edit'))
  with check (public.has_permission((select auth.uid()), 'posts', 'edit'));

-- post_translators
drop policy if exists post_translators_anon_select on public.post_translators;
create policy post_translators_anon_select on public.post_translators
  for select to anon
  using (exists (select 1 from public.posts p where p.id = post_translators.post_id and p.status = 'published'));
drop policy if exists post_translators_authed_select on public.post_translators;
create policy post_translators_authed_select on public.post_translators
  for select to authenticated using (true);
drop policy if exists post_translators_admin_all on public.post_translators;
create policy post_translators_admin_all on public.post_translators
  for all to authenticated
  using (public.has_permission((select auth.uid()), 'posts', 'edit'))
  with check (public.has_permission((select auth.uid()), 'posts', 'edit'));

-- post_prologuists
drop policy if exists post_prologuists_anon_select on public.post_prologuists;
create policy post_prologuists_anon_select on public.post_prologuists
  for select to anon
  using (exists (select 1 from public.posts p where p.id = post_prologuists.post_id and p.status = 'published'));
drop policy if exists post_prologuists_authed_select on public.post_prologuists;
create policy post_prologuists_authed_select on public.post_prologuists
  for select to authenticated using (true);
drop policy if exists post_prologuists_admin_all on public.post_prologuists;
create policy post_prologuists_admin_all on public.post_prologuists
  for all to authenticated
  using (public.has_permission((select auth.uid()), 'posts', 'edit'))
  with check (public.has_permission((select auth.uid()), 'posts', 'edit'));

-- 5) Triggers de rebuild — SECURITY DEFINER (mirror 0039) ------------
-- Una sola función reutilizable parametrizada por parent_table.

create or replace function public.trigger_rebuild_junction_book()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  is_published boolean;
  target_book uuid;
begin
  target_book := coalesce(new.book_id, old.book_id);
  select (status = 'published') into is_published from public.books where id = target_book;
  if is_published then
    perform public.queue_rebuild();
  end if;
  return null;
end;
$$;

create or replace function public.trigger_rebuild_junction_post()
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

drop trigger if exists book_collaborators_rebuild on public.book_collaborators;
create trigger book_collaborators_rebuild
  after insert or update or delete on public.book_collaborators
  for each row execute function public.trigger_rebuild_junction_book();

drop trigger if exists book_translators_rebuild on public.book_translators;
create trigger book_translators_rebuild
  after insert or update or delete on public.book_translators
  for each row execute function public.trigger_rebuild_junction_book();

drop trigger if exists book_prologuists_rebuild on public.book_prologuists;
create trigger book_prologuists_rebuild
  after insert or update or delete on public.book_prologuists
  for each row execute function public.trigger_rebuild_junction_book();

drop trigger if exists post_collaborators_rebuild on public.post_collaborators;
create trigger post_collaborators_rebuild
  after insert or update or delete on public.post_collaborators
  for each row execute function public.trigger_rebuild_junction_post();

drop trigger if exists post_translators_rebuild on public.post_translators;
create trigger post_translators_rebuild
  after insert or update or delete on public.post_translators
  for each row execute function public.trigger_rebuild_junction_post();

drop trigger if exists post_prologuists_rebuild on public.post_prologuists;
create trigger post_prologuists_rebuild
  after insert or update or delete on public.post_prologuists
  for each row execute function public.trigger_rebuild_junction_post();

-- 6) admin_permissions: extender resource CHECK ----------------------
alter table public.admin_permissions
  drop constraint if exists admin_permissions_resource_check;
alter table public.admin_permissions
  add constraint admin_permissions_resource_check
  check (resource in (
    'posts','books','authors','collaborators','categories','site','orders',
    'subscribers','admins','staff','collections','translators','prologuists'
  ));

-- 7) Seed permisos para los recursos nuevos --------------------------
-- Translators y prologuists usan el mismo nivel que collaborators
-- (que ya está sembrado): editor/admin tienen 'edit' por default.
insert into public.admin_permissions (profile_id, resource, level)
select p.id, 'translators', 'edit'
from public.profiles p
where p.role in ('admin', 'editor', 'owner')
on conflict (profile_id, resource) do nothing;

insert into public.admin_permissions (profile_id, resource, level)
select p.id, 'prologuists', 'edit'
from public.profiles p
where p.role in ('admin', 'editor', 'owner')
on conflict (profile_id, resource) do nothing;
