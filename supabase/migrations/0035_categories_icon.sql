-- Add an optional icon column to categories. Stores a lucide icon
-- name like "feather" or "scroll-text" (without the "lucide:" prefix
-- because that's what the iconify JSON keys use).
--
-- Rendered everywhere the category surfaces: CMS list panel, the
-- category dropdown in posts/books, and the public catálogo/artículos
-- filter chips.

alter table public.categories
  add column if not exists icon text;

-- Seed the four existing categories with sensible defaults so they
-- already look polished without an editor having to touch them.
update public.categories set icon = 'feather'      where slug = 'poesia';
update public.categories set icon = 'scroll-text'  where slug = 'filosofia';
update public.categories set icon = 'book-marked'  where slug = 'narrativa';
update public.categories set icon = 'newspaper'    where slug = 'editorial';
