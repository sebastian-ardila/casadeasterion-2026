-- Tighten RLS to use has_permission() for content tables and is_owner() for
-- privileged tables (admin_emails, profiles writes, subscribers).

-- profiles: owners can read all & manage roles. Admins can read all (needed for
-- admin UI). Self-row always readable. Only owners can write.
drop policy if exists "profiles select" on public.profiles;
drop policy if exists "profiles insert admin" on public.profiles;
drop policy if exists "profiles update admin" on public.profiles;
drop policy if exists "profiles delete admin" on public.profiles;

create policy "profiles select"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_owner((select auth.uid())))
    or (select public.is_admin((select auth.uid())))
  );
create policy "profiles insert owner"
  on public.profiles for insert to authenticated
  with check ((select public.is_owner((select auth.uid()))));
create policy "profiles update owner"
  on public.profiles for update to authenticated
  using ((select public.is_owner((select auth.uid()))))
  with check ((select public.is_owner((select auth.uid()))));
create policy "profiles delete owner"
  on public.profiles for delete to authenticated
  using ((select public.is_owner((select auth.uid()))));

-- admin_emails: only owners
drop policy if exists "admin_emails select admin" on public.admin_emails;
drop policy if exists "admin_emails insert admin" on public.admin_emails;
drop policy if exists "admin_emails update admin" on public.admin_emails;
drop policy if exists "admin_emails delete admin" on public.admin_emails;

create policy "admin_emails select owner"
  on public.admin_emails for select to authenticated
  using ((select public.is_owner((select auth.uid()))));
create policy "admin_emails insert owner"
  on public.admin_emails for insert to authenticated
  with check ((select public.is_owner((select auth.uid()))));
create policy "admin_emails delete owner"
  on public.admin_emails for delete to authenticated
  using ((select public.is_owner((select auth.uid()))));

-- subscribers: only owners
drop policy if exists "subscribers select admin" on public.subscribers;
drop policy if exists "subscribers insert admin" on public.subscribers;
drop policy if exists "subscribers update admin" on public.subscribers;
drop policy if exists "subscribers delete admin" on public.subscribers;

create policy "subscribers select owner"
  on public.subscribers for select to authenticated
  using ((select public.is_owner((select auth.uid()))));
create policy "subscribers insert owner"
  on public.subscribers for insert to authenticated
  with check ((select public.is_owner((select auth.uid()))));
create policy "subscribers update owner"
  on public.subscribers for update to authenticated
  using ((select public.is_owner((select auth.uid()))))
  with check ((select public.is_owner((select auth.uid()))));
create policy "subscribers delete owner"
  on public.subscribers for delete to authenticated
  using ((select public.is_owner((select auth.uid()))));

-- posts: per-resource permissions
drop policy if exists "posts select auth" on public.posts;
drop policy if exists "posts insert admin" on public.posts;
drop policy if exists "posts update admin" on public.posts;
drop policy if exists "posts delete admin" on public.posts;

create policy "posts select auth"
  on public.posts for select to authenticated
  using (
    status = 'published'
    or (select public.has_permission((select auth.uid()), 'posts', 'view'))
  );
create policy "posts insert"
  on public.posts for insert to authenticated
  with check ((select public.has_permission((select auth.uid()), 'posts', 'edit')));
create policy "posts update"
  on public.posts for update to authenticated
  using ((select public.has_permission((select auth.uid()), 'posts', 'edit')))
  with check ((select public.has_permission((select auth.uid()), 'posts', 'edit')));
create policy "posts delete"
  on public.posts for delete to authenticated
  using ((select public.has_permission((select auth.uid()), 'posts', 'edit')));

-- books
drop policy if exists "books select auth" on public.books;
drop policy if exists "books insert admin" on public.books;
drop policy if exists "books update admin" on public.books;
drop policy if exists "books delete admin" on public.books;

create policy "books select auth"
  on public.books for select to authenticated
  using (
    status = 'published'
    or (select public.has_permission((select auth.uid()), 'books', 'view'))
  );
create policy "books insert"
  on public.books for insert to authenticated
  with check ((select public.has_permission((select auth.uid()), 'books', 'edit')));
create policy "books update"
  on public.books for update to authenticated
  using ((select public.has_permission((select auth.uid()), 'books', 'edit')))
  with check ((select public.has_permission((select auth.uid()), 'books', 'edit')));
create policy "books delete"
  on public.books for delete to authenticated
  using ((select public.has_permission((select auth.uid()), 'books', 'edit')));

-- authors (public read stays open)
drop policy if exists "authors insert admin" on public.authors;
drop policy if exists "authors update admin" on public.authors;
drop policy if exists "authors delete admin" on public.authors;

create policy "authors insert"
  on public.authors for insert to authenticated
  with check ((select public.has_permission((select auth.uid()), 'authors', 'edit')));
create policy "authors update"
  on public.authors for update to authenticated
  using ((select public.has_permission((select auth.uid()), 'authors', 'edit')))
  with check ((select public.has_permission((select auth.uid()), 'authors', 'edit')));
create policy "authors delete"
  on public.authors for delete to authenticated
  using ((select public.has_permission((select auth.uid()), 'authors', 'edit')));

-- categories (public read stays open)
drop policy if exists "categories insert admin" on public.categories;
drop policy if exists "categories update admin" on public.categories;
drop policy if exists "categories delete admin" on public.categories;

create policy "categories insert"
  on public.categories for insert to authenticated
  with check ((select public.has_permission((select auth.uid()), 'categories', 'edit')));
create policy "categories update"
  on public.categories for update to authenticated
  using ((select public.has_permission((select auth.uid()), 'categories', 'edit')))
  with check ((select public.has_permission((select auth.uid()), 'categories', 'edit')));
create policy "categories delete"
  on public.categories for delete to authenticated
  using ((select public.has_permission((select auth.uid()), 'categories', 'edit')));

-- site_configuration (public read stays open)
drop policy if exists "site_config insert admin" on public.site_configuration;
drop policy if exists "site_config update admin" on public.site_configuration;
drop policy if exists "site_config delete admin" on public.site_configuration;

create policy "site_config insert"
  on public.site_configuration for insert to authenticated
  with check ((select public.has_permission((select auth.uid()), 'site', 'edit')));
create policy "site_config update"
  on public.site_configuration for update to authenticated
  using ((select public.has_permission((select auth.uid()), 'site', 'edit')))
  with check ((select public.has_permission((select auth.uid()), 'site', 'edit')));
create policy "site_config delete"
  on public.site_configuration for delete to authenticated
  using ((select public.has_permission((select auth.uid()), 'site', 'edit')));

-- storage: any owner OR admin with edit on at least one resource can write
-- (kept simple; per-bucket granularity not worth the complexity yet)
drop policy if exists "admin write covers" on storage.objects;
drop policy if exists "admin update covers" on storage.objects;
drop policy if exists "admin delete covers" on storage.objects;

create policy "admin write covers"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('covers','content','authors')
    and (
      (select public.is_owner((select auth.uid())))
      or (select public.is_admin((select auth.uid())))
    )
  );
create policy "admin update covers"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('covers','content','authors')
    and (
      (select public.is_owner((select auth.uid())))
      or (select public.is_admin((select auth.uid())))
    )
  )
  with check (
    bucket_id in ('covers','content','authors')
    and (
      (select public.is_owner((select auth.uid())))
      or (select public.is_admin((select auth.uid())))
    )
  );
create policy "admin delete covers"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('covers','content','authors')
    and (
      (select public.is_owner((select auth.uid())))
      or (select public.is_admin((select auth.uid())))
    )
  );
