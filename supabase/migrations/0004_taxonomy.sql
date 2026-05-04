-- authors
create table public.authors (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  bio_md      text,
  photo_url   text,
  links       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger authors_set_updated_at
before update on public.authors
for each row execute procedure extensions.moddatetime(updated_at);

create index authors_name_trgm_idx on public.authors using gin (name gin_trgm_ops);

-- categories
create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  kind         text not null check (kind in ('philosophy','poetry','book','other')),
  description  text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger categories_set_updated_at
before update on public.categories
for each row execute procedure extensions.moddatetime(updated_at);

create index categories_kind_idx on public.categories (kind, sort_order);
