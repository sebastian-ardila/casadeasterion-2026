create table public.rate_limits (
  key            text not null,
  window_start   timestamptz not null,
  count          int not null default 0,
  primary key (key, window_start)
);

create index rate_limits_window_idx on public.rate_limits (window_start);

create or replace function public.check_rate_limit(
  p_key text,
  p_max int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_count int;
begin
  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_max;
end;
$$;

revoke all on function public.check_rate_limit(text, int, int) from public;
grant execute on function public.check_rate_limit(text, int, int) to service_role, authenticated, anon;

select cron.schedule(
  'rate_limits_gc',
  '7 * * * *',
  $$ delete from public.rate_limits where window_start < now() - interval '24 hours' $$
);
