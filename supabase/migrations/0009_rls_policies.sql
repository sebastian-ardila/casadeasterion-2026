alter table public.profiles            enable row level security;
alter table public.admin_emails        enable row level security;
alter table public.authors             enable row level security;
alter table public.categories          enable row level security;
alter table public.posts               enable row level security;
alter table public.books               enable row level security;
alter table public.subscribers         enable row level security;
alter table public.site_configuration  enable row level security;
alter table public.rate_limits         enable row level security;

-- These are the initial RLS policies. They are superseded by 0010b_rls_perf_fixes
-- which splits FOR ALL policies and uses (select auth.uid()) for performance.

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "profiles admin write" on public.profiles;
create policy "profiles admin write"
  on public.profiles for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "admin_emails admin only" on public.admin_emails;
create policy "admin_emails admin only"
  on public.admin_emails for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "authors read all" on public.authors;
create policy "authors read all"
  on public.authors for select to anon, authenticated using (true);

drop policy if exists "authors admin write" on public.authors;
create policy "authors admin write"
  on public.authors for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "categories read all" on public.categories;
create policy "categories read all"
  on public.categories for select to anon, authenticated using (true);

drop policy if exists "categories admin write" on public.categories;
create policy "categories admin write"
  on public.categories for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "posts read published" on public.posts;
create policy "posts read published"
  on public.posts for select to anon
  using (status = 'published');

drop policy if exists "posts read auth" on public.posts;
create policy "posts read auth"
  on public.posts for select to authenticated
  using (status = 'published' or public.is_admin(auth.uid()));

drop policy if exists "posts admin write" on public.posts;
create policy "posts admin write"
  on public.posts for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "books read published" on public.books;
create policy "books read published"
  on public.books for select to anon
  using (status = 'published');

drop policy if exists "books read auth" on public.books;
create policy "books read auth"
  on public.books for select to authenticated
  using (status = 'published' or public.is_admin(auth.uid()));

drop policy if exists "books admin write" on public.books;
create policy "books admin write"
  on public.books for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "subscribers admin only" on public.subscribers;
create policy "subscribers admin only"
  on public.subscribers for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "site_config read all" on public.site_configuration;
create policy "site_config read all"
  on public.site_configuration for select to anon, authenticated using (true);

drop policy if exists "site_config admin write" on public.site_configuration;
create policy "site_config admin write"
  on public.site_configuration for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
