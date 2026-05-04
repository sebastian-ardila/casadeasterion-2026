create table public.site_configuration (
  key          text primary key,
  value        jsonb not null,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles(id) on delete set null
);

create trigger site_configuration_set_updated_at
before update on public.site_configuration
for each row execute procedure extensions.moddatetime(updated_at);
