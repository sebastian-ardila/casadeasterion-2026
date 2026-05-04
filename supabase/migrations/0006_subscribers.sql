create table public.subscribers (
  id                   uuid primary key default gen_random_uuid(),
  email                citext not null unique,
  confirmation_token   uuid not null default gen_random_uuid(),
  confirmed_at         timestamptz,
  unsubscribed_at      timestamptz,
  source               text,
  ip_hash              text,
  created_at           timestamptz not null default now()
);

create index subscribers_confirmed_idx on public.subscribers (confirmed_at)
  where confirmed_at is not null and unsubscribed_at is null;
create unique index subscribers_token_idx on public.subscribers (confirmation_token);
