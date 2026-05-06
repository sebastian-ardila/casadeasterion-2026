-- Multiple-image galleries on posts and books.
-- Stored as text[] (URLs) ordered as the editor specifies.
-- Public site can render them as a slideshow / gallery section in addition
-- to cover_image_url.

alter table public.posts
  add column if not exists gallery_urls text[] not null default '{}';

alter table public.books
  add column if not exists gallery_urls text[] not null default '{}';
