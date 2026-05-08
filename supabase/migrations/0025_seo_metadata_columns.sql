-- SEO metadata: per-record keywords, canonical URL, og:image alt text.
-- Site-wide defaults live in site_configuration so the public site can
-- fall back when a post/book hasn't filled in the field.

alter table public.posts
  add column if not exists keywords text[] default '{}'::text[],
  add column if not exists canonical_url text,
  add column if not exists cover_image_alt text;

alter table public.books
  add column if not exists keywords text[] default '{}'::text[],
  add column if not exists canonical_url text,
  add column if not exists cover_image_alt text;

alter table public.authors
  add column if not exists keywords text[] default '{}'::text[];

-- Global SEO defaults. JSON-LD Organization needs the logo url so it can
-- be rendered in every page's head; twitter_handle wires up Twitter Card
-- attribution; default_keywords + og_image_default are the fallbacks
-- when a post/book/author leaves those fields empty.
insert into public.site_configuration (key, value)
values
  ('default_keywords', '[]'::jsonb),
  ('twitter_handle', '""'::jsonb),
  ('og_image_default', '""'::jsonb),
  ('organization_logo_url', '""'::jsonb)
on conflict (key) do nothing;
