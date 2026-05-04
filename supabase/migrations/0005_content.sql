create table public.posts (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,
  title                 text not null,
  subtitle              text,
  excerpt               text,
  content_md            text not null,
  cover_image_url       text,
  category_id           uuid references public.categories(id) on delete set null,
  author_id             uuid references public.authors(id) on delete set null,
  status                text not null default 'draft'
                        check (status in ('draft','published')),
  published_at          timestamptz,
  reading_time_minutes  int,
  meta_description      text,
  tags                  text[] not null default '{}'::text[],
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint posts_published_has_date
    check (status <> 'published' or published_at is not null)
);

create trigger posts_set_updated_at
before update on public.posts
for each row execute procedure extensions.moddatetime(updated_at);

create index posts_status_published_idx
  on public.posts (status, published_at desc);
create index posts_category_idx on public.posts (category_id);
create index posts_author_idx on public.posts (author_id);
create index posts_tags_gin_idx on public.posts using gin (tags);
create index posts_title_trgm_idx on public.posts using gin (title gin_trgm_ops);

create table public.books (
  id                          uuid primary key default gen_random_uuid(),
  slug                        text not null unique,
  title                       text not null,
  subtitle                    text,
  description_md              text,
  cover_image_url             text,
  author_id                   uuid references public.authors(id) on delete set null,
  category_id                 uuid references public.categories(id) on delete set null,
  isbn                        text,
  pages                       int check (pages is null or pages > 0),
  format                      text check (format is null or format in ('paperback','hardcover','ebook','other')),
  price_amount                numeric(12,2) check (price_amount is null or price_amount >= 0),
  price_currency              text not null default 'COP',
  whatsapp_message_override   text,
  publication_date            date,
  status                      text not null default 'draft'
                              check (status in ('draft','published')),
  published_at                timestamptz,
  tags                        text[] not null default '{}'::text[],
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint books_published_has_date
    check (status <> 'published' or published_at is not null)
);

create trigger books_set_updated_at
before update on public.books
for each row execute procedure extensions.moddatetime(updated_at);

create index books_status_published_idx
  on public.books (status, published_at desc);
create index books_category_idx on public.books (category_id);
create index books_author_idx on public.books (author_id);
create index books_tags_gin_idx on public.books using gin (tags);
create index books_title_trgm_idx on public.books using gin (title gin_trgm_ops);
create unique index books_isbn_unique on public.books (isbn) where isbn is not null;
