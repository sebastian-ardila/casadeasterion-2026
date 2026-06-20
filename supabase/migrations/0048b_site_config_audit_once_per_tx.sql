-- 0048b_site_config_audit_once_per_tx.sql
-- Un upsert ON CONFLICT dispara el trigger statement DOS veces (evento INSERT y
-- evento UPDATE del mismo comando), y un panel puede tocar la tabla en varios
-- statements dentro del mismo guardado. Usamos un flag transaccional para
-- registrar UNA sola entrada por transacción de guardado de site_configuration.

create or replace function public.log_site_config_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if pg_trigger_depth() > 1 then return null; end if;
  if auth.uid() is null then return null; end if;

  -- Ya registrado en esta transacción → no duplicar.
  if current_setting('cas.site_config_audited', true) = '1' then
    return null;
  end if;
  perform set_config('cas.site_config_audited', '1', true);

  insert into public.audit_log(actor_id, action, resource, table_name, record_id, record_label)
  values (
    auth.uid(),
    case when tg_op = 'DELETE' then 'delete' else 'update' end,
    'site', 'site_configuration', null, null
  );
  return null;
exception when others then
  raise warning 'audit site_config failed: % (sqlstate=%)', sqlerrm, sqlstate;
  return null;
end;
$$;
