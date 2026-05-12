-- 0041_admin_permissions_extend_resources.sql
--
-- The original CHECK constraint on admin_permissions.resource (migration
-- 0013) only allowed: posts, books, authors, categories, site.
--
-- The CMS has since added the "collaborators" resource (migration 0040
-- created the table) and now we want admins/owners to be able to grant
-- per-user permissions on "orders" and "subscribers" too — instead of
-- treating those as role-derived owner-only flags.
--
-- This migration:
--   1. Drops the old CHECK and replaces it with one that accepts the
--      extended set.
--   2. Backfills default permissions for existing admin/editor profiles
--      so the new resources behave sensibly without manual setup:
--        - admins   → orders=edit, subscribers=edit, collaborators=edit
--        - editors  → orders=none, subscribers=none, collaborators=edit
--   3. Owners do not need rows (they read as full-edit unconditionally
--      from auth.ts), so we don't backfill them.

-- 1) Replace the CHECK constraint.
alter table public.admin_permissions
  drop constraint if exists admin_permissions_resource_check;

alter table public.admin_permissions
  add constraint admin_permissions_resource_check
  check (resource in (
    'posts', 'books', 'authors', 'collaborators',
    'categories', 'site', 'orders', 'subscribers', 'admins'
  ));

-- 2) Backfill defaults for existing profiles. We use ON CONFLICT DO NOTHING
--    so we never overwrite an explicit setting an admin already configured.

-- Admins: full edit on the new resources.
insert into public.admin_permissions (profile_id, resource, level)
select p.id, r.resource, 'edit'::text
from public.profiles p
cross join (values
  ('collaborators'),
  ('orders'),
  ('subscribers')
) as r(resource)
where p.role = 'admin'
on conflict (profile_id, resource) do nothing;

-- Editors: collaborators=edit (mirror of authors), orders/subscribers=none.
insert into public.admin_permissions (profile_id, resource, level)
select p.id, 'collaborators', 'edit'
from public.profiles p
where p.role = 'editor'
on conflict (profile_id, resource) do nothing;

insert into public.admin_permissions (profile_id, resource, level)
select p.id, r.resource, 'none'::text
from public.profiles p
cross join (values
  ('orders'),
  ('subscribers')
) as r(resource)
where p.role = 'editor'
on conflict (profile_id, resource) do nothing;
