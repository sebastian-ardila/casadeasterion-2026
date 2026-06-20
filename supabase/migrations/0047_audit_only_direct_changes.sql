-- 0047_audit_only_direct_changes.sql
-- Fix: el audit log registraba UPDATEs en cascada disparados por OTROS triggers
-- (sync_book_primary_author / sync_post_primary_author propagan author_id al
-- sincronizar autores), generando varias entradas para una sola acción del
-- usuario. Solución: registrar únicamente cambios directos del cliente —
-- pg_trigger_depth() = 1. Los UPDATEs causados por otro trigger corren a
-- profundidad >= 2 y se ignoran.

create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_resource  text := tg_argv[0];
  v_label_col text := tg_argv[1];
  v_action    text;
  v_row       jsonb;
  v_id        text;
  v_label     text;
begin
  -- Solo cambios directos del usuario, no cascadas de otros triggers
  -- (sync_*_primary_author, etc., que corren a profundidad >= 2).
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  if auth.uid() is null then
    return null;
  end if;

  if tg_op = 'INSERT' then
    v_action := 'create'; v_row := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_action := 'update'; v_row := to_jsonb(new);
  else
    v_action := 'delete'; v_row := to_jsonb(old);
  end if;

  v_id    := coalesce(v_row ->> 'id', v_row ->> v_label_col);
  v_label := v_row ->> v_label_col;

  insert into public.audit_log(actor_id, action, resource, table_name, record_id, record_label)
  values (auth.uid(), v_action, v_resource, tg_table_name, v_id, v_label);

  return null;
exception when others then
  raise warning 'audit log failed: % (sqlstate=%)', sqlerrm, sqlstate;
  return null;
end;
$$;

revoke all on function public.log_audit_event() from public, anon, authenticated;
