insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('covers',  'covers',  true, 10485760,  array['image/jpeg','image/png','image/webp','image/avif']),
  ('content', 'content', true, 10485760,  array['image/jpeg','image/png','image/webp','image/avif','image/gif']),
  ('authors', 'authors', true,  5242880,  array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do nothing;

drop policy if exists "public read covers" on storage.objects;
create policy "public read covers"
  on storage.objects for select to anon, authenticated
  using (bucket_id in ('covers','content','authors'));

drop policy if exists "admin write covers" on storage.objects;
create policy "admin write covers"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('covers','content','authors')
    and public.is_admin(auth.uid())
  );

drop policy if exists "admin update covers" on storage.objects;
create policy "admin update covers"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('covers','content','authors')
    and public.is_admin(auth.uid())
  )
  with check (
    bucket_id in ('covers','content','authors')
    and public.is_admin(auth.uid())
  );

drop policy if exists "admin delete covers" on storage.objects;
create policy "admin delete covers"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('covers','content','authors')
    and public.is_admin(auth.uid())
  );
