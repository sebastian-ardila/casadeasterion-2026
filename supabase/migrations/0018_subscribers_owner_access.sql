-- Allow the owner role (not just role='admin') to read/manage subscribers.
-- The default 'subscribers admin only' policy uses is_admin(auth.uid()) which
-- only matches role='admin'. We split into per-action policies so the owner is
-- explicitly included via is_owner().

drop policy if exists "subscribers admin only" on public.subscribers;
drop policy if exists "subscribers cms select" on public.subscribers;
drop policy if exists "subscribers cms insert" on public.subscribers;
drop policy if exists "subscribers cms update" on public.subscribers;
drop policy if exists "subscribers cms delete" on public.subscribers;

create policy "subscribers cms select"
  on public.subscribers for select to authenticated
  using ( public.is_owner((select auth.uid())) or public.is_admin((select auth.uid())) );

create policy "subscribers cms insert"
  on public.subscribers for insert to authenticated
  with check ( public.is_owner((select auth.uid())) or public.is_admin((select auth.uid())) );

create policy "subscribers cms update"
  on public.subscribers for update to authenticated
  using ( public.is_owner((select auth.uid())) or public.is_admin((select auth.uid())) )
  with check ( public.is_owner((select auth.uid())) or public.is_admin((select auth.uid())) );

create policy "subscribers cms delete"
  on public.subscribers for delete to authenticated
  using ( public.is_owner((select auth.uid())) or public.is_admin((select auth.uid())) );
