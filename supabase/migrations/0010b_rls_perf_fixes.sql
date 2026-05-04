-- Fix two perf advisor warnings:
-- 1. auth_rls_initplan: wrap auth.uid() / is_admin(...) in (select ...) so they're
--    evaluated once per query, not once per row.
-- 2. multiple_permissive_policies: split FOR ALL admin policies into
--    INSERT/UPDATE/DELETE so they don't pile up with public-read SELECT policies.

drop policy if exists "profiles self read" on public.profiles;
drop policy if exists "profiles admin write" on public.profiles;

create policy "profiles select"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_admin((select auth.uid())))
  );

create policy "profiles insert admin"
  on public.profiles for insert to authenticated
  with check ((select public.is_admin((select auth.uid()))));

create policy "profiles update admin"
  on public.profiles for update to authenticated
  using ((select public.is_admin((select auth.uid()))))
  with check ((select public.is_admin((select auth.uid()))));

create policy "profiles delete admin"
  on public.profiles for delete to authenticated
  using ((select public.is_admin((select auth.uid()))));

drop policy if exists "admin_emails admin only" on public.admin_emails;

create policy "admin_emails select admin"
  on public.admin_emails for select to authenticated
  using ((select public.is_admin((select auth.uid()))));

create policy "admin_emails insert admin"
  on public.admin_emails for insert to authenticated
  with check ((select public.is_admin((select auth.uid()))));

create policy "admin_emails update admin"
  on public.admin_emails for update to authenticated
  using ((select public.is_admin((select auth.uid()))))
  with check ((select public.is_admin((select auth.uid()))));

create policy "admin_emails delete admin"
  on public.admin_emails for delete to authenticated
  using ((select public.is_admin((select auth.uid()))));

drop policy if exists "authors read all" on public.authors;
drop policy if exists "authors admin write" on public.authors;

create policy "authors select all"
  on public.authors for select to anon, authenticated using (true);

create policy "authors insert admin"
  on public.authors for insert to authenticated
  with check ((select public.is_admin((select auth.uid()))));

create policy "authors update admin"
  on public.authors for update to authenticated
  using ((select public.is_admin((select auth.uid()))))
  with check ((select public.is_admin((select auth.uid()))));

create policy "authors delete admin"
  on public.authors for delete to authenticated
  using ((select public.is_admin((select auth.uid()))));

drop policy if exists "categories read all" on public.categories;
drop policy if exists "categories admin write" on public.categories;

create policy "categories select all"
  on public.categories for select to anon, authenticated using (true);

create policy "categories insert admin"
  on public.categories for insert to authenticated
  with check ((select public.is_admin((select auth.uid()))));

create policy "categories update admin"
  on public.categories for update to authenticated
  using ((select public.is_admin((select auth.uid()))))
  with check ((select public.is_admin((select auth.uid()))));

create policy "categories delete admin"
  on public.categories for delete to authenticated
  using ((select public.is_admin((select auth.uid()))));

drop policy if exists "posts read published" on public.posts;
drop policy if exists "posts read auth" on public.posts;
drop policy if exists "posts admin write" on public.posts;

create policy "posts select anon"
  on public.posts for select to anon
  using (status = 'published');

create policy "posts select auth"
  on public.posts for select to authenticated
  using (
    status = 'published'
    or (select public.is_admin((select auth.uid())))
  );

create policy "posts insert admin"
  on public.posts for insert to authenticated
  with check ((select public.is_admin((select auth.uid()))));

create policy "posts update admin"
  on public.posts for update to authenticated
  using ((select public.is_admin((select auth.uid()))))
  with check ((select public.is_admin((select auth.uid()))));

create policy "posts delete admin"
  on public.posts for delete to authenticated
  using ((select public.is_admin((select auth.uid()))));

drop policy if exists "books read published" on public.books;
drop policy if exists "books read auth" on public.books;
drop policy if exists "books admin write" on public.books;

create policy "books select anon"
  on public.books for select to anon
  using (status = 'published');

create policy "books select auth"
  on public.books for select to authenticated
  using (
    status = 'published'
    or (select public.is_admin((select auth.uid())))
  );

create policy "books insert admin"
  on public.books for insert to authenticated
  with check ((select public.is_admin((select auth.uid()))));

create policy "books update admin"
  on public.books for update to authenticated
  using ((select public.is_admin((select auth.uid()))))
  with check ((select public.is_admin((select auth.uid()))));

create policy "books delete admin"
  on public.books for delete to authenticated
  using ((select public.is_admin((select auth.uid()))));

drop policy if exists "subscribers admin only" on public.subscribers;

create policy "subscribers select admin"
  on public.subscribers for select to authenticated
  using ((select public.is_admin((select auth.uid()))));

create policy "subscribers insert admin"
  on public.subscribers for insert to authenticated
  with check ((select public.is_admin((select auth.uid()))));

create policy "subscribers update admin"
  on public.subscribers for update to authenticated
  using ((select public.is_admin((select auth.uid()))))
  with check ((select public.is_admin((select auth.uid()))));

create policy "subscribers delete admin"
  on public.subscribers for delete to authenticated
  using ((select public.is_admin((select auth.uid()))));

drop policy if exists "site_config read all" on public.site_configuration;
drop policy if exists "site_config admin write" on public.site_configuration;

create policy "site_config select all"
  on public.site_configuration for select to anon, authenticated using (true);

create policy "site_config insert admin"
  on public.site_configuration for insert to authenticated
  with check ((select public.is_admin((select auth.uid()))));

create policy "site_config update admin"
  on public.site_configuration for update to authenticated
  using ((select public.is_admin((select auth.uid()))))
  with check ((select public.is_admin((select auth.uid()))));

create policy "site_config delete admin"
  on public.site_configuration for delete to authenticated
  using ((select public.is_admin((select auth.uid()))));

drop policy if exists "admin write covers" on storage.objects;
drop policy if exists "admin update covers" on storage.objects;
drop policy if exists "admin delete covers" on storage.objects;

create policy "admin write covers"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('covers','content','authors')
    and (select public.is_admin((select auth.uid())))
  );

create policy "admin update covers"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('covers','content','authors')
    and (select public.is_admin((select auth.uid())))
  )
  with check (
    bucket_id in ('covers','content','authors')
    and (select public.is_admin((select auth.uid())))
  );

create policy "admin delete covers"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('covers','content','authors')
    and (select public.is_admin((select auth.uid())))
  );

create index if not exists admin_emails_added_by_idx
  on public.admin_emails (added_by);
create index if not exists site_configuration_updated_by_idx
  on public.site_configuration (updated_by);
