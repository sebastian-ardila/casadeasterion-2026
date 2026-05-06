-- Debounce Amplify rebuild webhooks: a burst of N saves within a short window
-- now produces a single build instead of N. Saves time/cost on Amplify minutes
-- and avoids the queue piling up during a typical editing session.
--
-- Mechanism:
-- 1. Triggers (still per-table) call queue_rebuild() instead of net.http_post.
--    queue_rebuild() upserts a singleton row in public.pending_rebuild with
--    the current timestamp.
-- 2. A pg_cron job runs every 15s and calls dispatch_rebuild_if_due(), which
--    fires the real webhook only when:
--      - there is a pending request, and
--      - the most recent request was at least 20s ago (debounce window), and
--      - we haven't already dispatched a build covering it.
-- 3. After dispatching, last_dispatched_at >= requested_at until a new save
--    bumps requested_at.
--
-- Worst-case latency from final save to build start: 20s (debounce) + ~15s
-- (cron tick) ≈ 35s. The banner UI handles "pending" gracefully.

create table if not exists public.pending_rebuild (
  id                  int  primary key check (id = 1),
  requested_at        timestamptz not null default now(),
  last_dispatched_at  timestamptz
);

-- Seed the singleton row so upserts have something to update.
insert into public.pending_rebuild (id) values (1)
on conflict (id) do nothing;

alter table public.pending_rebuild enable row level security;
-- No policies => only postgres / service_role can touch it.

create or replace function public.queue_rebuild()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.pending_rebuild (id, requested_at) values (1, now())
  on conflict (id) do update set requested_at = now();
end;
$$;
revoke all on function public.queue_rebuild() from public, anon, authenticated;

create or replace function public.dispatch_rebuild_if_due()
returns void language plpgsql security definer set search_path = public, net, vault as $$
declare
  row       public.pending_rebuild%rowtype;
  hook_url  text;
begin
  select * into row from public.pending_rebuild where id = 1;
  if not found then return; end if;

  -- Already covered by the last dispatch.
  if row.last_dispatched_at is not null and row.last_dispatched_at >= row.requested_at then
    return;
  end if;

  -- Debounce: wait until 20s of quiet have elapsed since the last save.
  if now() - row.requested_at < interval '20 seconds' then
    return;
  end if;

  select decrypted_secret into hook_url
    from vault.decrypted_secrets
   where name = 'amplify_build_hook_url'
   limit 1;
  if hook_url is null or hook_url = '' then return; end if;

  perform net.http_post(
    url := hook_url,
    headers := jsonb_build_object('content-type', 'application/json'),
    body := jsonb_build_object('source', 'supabase-debounced', 'at', now())
  );

  update public.pending_rebuild
     set last_dispatched_at = now()
   where id = 1;
exception when others then
  raise warning 'dispatch_rebuild_if_due failed: % (sqlstate=%)', sqlerrm, sqlstate;
end;
$$;
revoke all on function public.dispatch_rebuild_if_due() from public, anon, authenticated;

-- Replace the per-trigger function so it just queues instead of firing the
-- webhook directly. The triggers themselves (from 0012) keep their per-table
-- WHEN clauses so we don't queue for unimportant changes (e.g. draft saves).
create or replace function public.trigger_amplify_rebuild()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.queue_rebuild();
  return null;
end;
$$;
revoke all on function public.trigger_amplify_rebuild() from public, anon, authenticated;

-- Cron tick: every 15 seconds, check whether a debounced dispatch is due.
-- If a job with the same name already exists, replace it.
do $$
declare
  existing_jobid bigint;
begin
  select jobid into existing_jobid from cron.job where jobname = 'debounced-rebuild';
  if existing_jobid is not null then
    perform cron.unschedule(existing_jobid);
  end if;
  perform cron.schedule(
    'debounced-rebuild',
    '15 seconds',
    'select public.dispatch_rebuild_if_due();'
  );
end $$;
