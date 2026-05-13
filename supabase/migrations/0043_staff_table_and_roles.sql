-- 0043_staff_table_and_roles.sql
--
-- Adds the "Personal" section: organizational profiles of the Casa de
-- Asterión Ediciones team, distinct from `authors` (book authors) and
-- `collaborators` (publication contributors).
--
-- Two new tables:
--   1. staff_roles — small lookup of allowed job titles (CEO, Editor,
--      Diseño, …). Editors can add new ones from the CMS. Kept as a
--      separate table instead of an enum so it's mutable at runtime.
--   2. staff — actual team members. `role` is a free-text column
--      (filled from staff_roles via the CMS dropdown) so we keep the
--      schema flexible: roles are a *suggested* list, not a hard FK.
--
-- Same RLS / trigger conventions as collaborators (0040).

-- 1) staff_roles -----------------------------------------------------
create table if not exists public.staff_roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.staff_roles enable row level security;

drop policy if exists "staff_roles select all" on public.staff_roles;
create policy "staff_roles select all" on public.staff_roles
  for select to anon, authenticated using (true);

-- Only users with staff:edit can add/edit/remove roles.
drop policy if exists "staff_roles insert" on public.staff_roles;
create policy "staff_roles insert" on public.staff_roles
  for insert to authenticated
  with check ((select public.has_permission((select auth.uid()), 'staff', 'edit')));

drop policy if exists "staff_roles update" on public.staff_roles;
create policy "staff_roles update" on public.staff_roles
  for update to authenticated
  using ((select public.has_permission((select auth.uid()), 'staff', 'edit')))
  with check ((select public.has_permission((select auth.uid()), 'staff', 'edit')));

drop policy if exists "staff_roles delete" on public.staff_roles;
create policy "staff_roles delete" on public.staff_roles
  for delete to authenticated
  using ((select public.has_permission((select auth.uid()), 'staff', 'edit')));

-- Default catalogue. Lower sort_order = listed first in the CMS dropdown.
insert into public.staff_roles (name, sort_order) values
  ('CEO', 0),
  ('Director editorial', 10),
  ('Editor', 20),
  ('Editor asociado', 30),
  ('Diseño', 40),
  ('Corrección', 50),
  ('Comunicaciones', 60),
  ('Desarrollo', 70)
on conflict (name) do nothing;

-- 2) staff -----------------------------------------------------------
create table if not exists public.staff (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  role        text not null,
  bio_md      text,
  photo_url   text,
  email       text,
  links       jsonb not null default '{}'::jsonb,
  sort_order  smallint not null default 0,
  status      text not null default 'published' check (status in ('published','draft')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id)
);

create index if not exists staff_sort_idx on public.staff (sort_order, name);
create index if not exists staff_status_idx on public.staff (status);

alter table public.staff enable row level security;

-- Anonymous visitors only see published rows (mirror of authors/posts/books).
drop policy if exists "staff anon select published" on public.staff;
create policy "staff anon select published" on public.staff
  for select to anon
  using (status = 'published');

drop policy if exists "staff authed select all" on public.staff;
create policy "staff authed select all" on public.staff
  for select to authenticated using (true);

drop policy if exists "staff insert" on public.staff;
create policy "staff insert" on public.staff
  for insert to authenticated
  with check ((select public.has_permission((select auth.uid()), 'staff', 'edit')));

drop policy if exists "staff update" on public.staff;
create policy "staff update" on public.staff
  for update to authenticated
  using ((select public.has_permission((select auth.uid()), 'staff', 'edit')))
  with check ((select public.has_permission((select auth.uid()), 'staff', 'edit')));

drop policy if exists "staff delete" on public.staff;
create policy "staff delete" on public.staff
  for delete to authenticated
  using ((select public.has_permission((select auth.uid()), 'staff', 'edit')));

-- House-keeping triggers (mirror of authors/collaborators).
drop trigger if exists staff_set_updated_at on public.staff;
create trigger staff_set_updated_at
  before update on public.staff
  for each row execute function extensions.moddatetime('updated_at');

drop trigger if exists staff_set_updated_by on public.staff;
create trigger staff_set_updated_by
  before insert or update on public.staff
  for each row execute function public.set_updated_by();

-- Rebuild the public site whenever a staff row changes — /nosotros
-- is statically generated from these rows.
drop trigger if exists staff_rebuild on public.staff;
create trigger staff_rebuild
  after insert or update or delete on public.staff
  for each statement execute procedure public.trigger_amplify_rebuild();

-- 3) admin_permissions: extend resource check to include 'staff' ----
-- Mirrors 0041: any user with admin/editor role gets staff=edit by default,
-- but the row is only seeded for explicit profiles. Owners read as
-- full-edit unconditionally from auth.ts so no row is needed for them.

alter table public.admin_permissions
  drop constraint if exists admin_permissions_resource_check;

alter table public.admin_permissions
  add constraint admin_permissions_resource_check
  check (resource in (
    'posts', 'books', 'authors', 'collaborators',
    'categories', 'site', 'orders', 'subscribers', 'admins',
    'staff'
  ));

insert into public.admin_permissions (profile_id, resource, level)
select p.id, 'staff', 'edit'
from public.profiles p
where p.role in ('admin', 'editor')
on conflict (profile_id, resource) do nothing;

-- 4) Seed Alfredo Abad as the first staff member (CEO) --------------
-- Copies name, photo, bio from the author row. Idempotent: ON CONFLICT
-- skip so re-running the migration in dev doesn't duplicate the seed.
insert into public.staff (slug, name, role, bio_md, photo_url, sort_order, status)
select
  a.slug,
  a.name,
  'CEO',
  a.bio_md,
  a.photo_url,
  0,
  'published'
from public.authors a
where lower(a.name) = 'alfredo abad'
limit 1
on conflict (slug) do nothing;
