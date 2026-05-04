-- Extensions
create extension if not exists citext;
create extension if not exists moddatetime schema extensions;
create extension if not exists pg_trgm;
create extension if not exists unaccent;
create extension if not exists pg_cron;

-- Generic updated_at trigger function (fallback; we mostly use moddatetime).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
