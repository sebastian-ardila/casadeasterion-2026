-- 0048_site_config_audit_per_statement.sql
-- site_configuration es key-value: un guardado del panel "home" hace un upsert
-- batch de ~28 filas, que con un trigger FOR EACH ROW generaba ~28 entradas de
-- audit para una sola acción. Lo cambiamos a un trigger FOR EACH STATEMENT que
-- registra una entrada por guardado ("Editó la configuración del sitio").
-- record_id/label quedan null (describeAuditEntry ya rinde el texto genérico).
-- NOTA: refinado en 0048b para colapsar el doble disparo de ON CONFLICT.

create or replace function public.log_site_config_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if pg_trigger_depth() > 1 then return null; end if;
  if auth.uid() is null then return null; end if;

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

revoke all on function public.log_site_config_event() from public, anon, authenticated;

drop trigger if exists site_configuration_audit on public.site_configuration;
create trigger site_configuration_audit
  after insert or update or delete on public.site_configuration
  for each statement execute function public.log_site_config_event();
