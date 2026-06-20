-- 0046_audit_log.sql
-- Histórico de acciones por usuario (audit log).
-- Captura híbrida: triggers en DB registran create/update/delete de contenido
-- y cambios de permisos/usuarios. Regla anti-ruido: si auth.uid() es null
-- (edge functions, seeds, service role) NO se registra. Tabla inmutable.

-- # 1. Tabla
create table if not exists public.audit_log (
  id            bigint generated always as identity primary key,
  actor_id      uuid references public.profiles(id) on delete set null,
  action        text not null check (action in ('create','update','delete')),
  resource      text not null,
  table_name    text not null,
  record_id     text,
  record_label  text,
  details       jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists audit_log_actor_created_idx
  on public.audit_log (actor_id, created_at desc);

-- # 2. Función genérica de captura (contenido)
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

  -- 'id' en la mayoría de tablas; fallback a la columna-etiqueta cuando la PK
  -- no es 'id' (p. ej. site_configuration usa 'key').
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

-- # 3. Triggers de contenido
drop trigger if exists posts_audit on public.posts;
create trigger posts_audit after insert or update or delete on public.posts
  for each row execute function public.log_audit_event('posts', 'title');

drop trigger if exists books_audit on public.books;
create trigger books_audit after insert or update or delete on public.books
  for each row execute function public.log_audit_event('books', 'title');

drop trigger if exists authors_audit on public.authors;
create trigger authors_audit after insert or update or delete on public.authors
  for each row execute function public.log_audit_event('authors', 'name');

drop trigger if exists categories_audit on public.categories;
create trigger categories_audit after insert or update or delete on public.categories
  for each row execute function public.log_audit_event('categories', 'name');

drop trigger if exists collections_audit on public.collections;
create trigger collections_audit after insert or update or delete on public.collections
  for each row execute function public.log_audit_event('collections', 'name');

drop trigger if exists staff_audit on public.staff;
create trigger staff_audit after insert or update or delete on public.staff
  for each row execute function public.log_audit_event('staff', 'name');

drop trigger if exists site_configuration_audit on public.site_configuration;
create trigger site_configuration_audit after insert or update or delete on public.site_configuration
  for each row execute function public.log_audit_event('site', 'key');

drop trigger if exists purchase_intents_audit on public.purchase_intents;
create trigger purchase_intents_audit after insert or update or delete on public.purchase_intents
  for each row execute function public.log_audit_event('orders', 'full_name');

drop trigger if exists subscribers_audit on public.subscribers;
create trigger subscribers_audit after insert or update or delete on public.subscribers
  for each row execute function public.log_audit_event('subscribers', 'email');

-- # 4. Trigger especializado: cambios de permisos
create or replace function public.log_permission_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target_name text;
  v_action      text;
  v_profile     uuid;
begin
  if auth.uid() is null then return null; end if;
  v_profile := coalesce(new.profile_id, old.profile_id);
  select coalesce(full_name, email) into v_target_name
    from public.profiles where id = v_profile;

  if tg_op = 'INSERT' then v_action := 'create';
  elsif tg_op = 'UPDATE' then v_action := 'update';
  else v_action := 'delete'; end if;

  insert into public.audit_log(actor_id, action, resource, table_name, record_id, record_label, details)
  values (
    auth.uid(), v_action, 'admins', 'admin_permissions', v_profile::text, v_target_name,
    jsonb_build_object(
      'kind', 'permission',
      'perm_resource', coalesce(new.resource, old.resource),
      'old_level', old.level,
      'new_level', new.level
    )
  );
  return null;
exception when others then
  raise warning 'audit permission log failed: % (sqlstate=%)', sqlerrm, sqlstate;
  return null;
end;
$$;

revoke all on function public.log_permission_change() from public, anon, authenticated;

drop trigger if exists admin_permissions_audit on public.admin_permissions;
create trigger admin_permissions_audit after insert or update or delete on public.admin_permissions
  for each row execute function public.log_permission_change();

-- # 5. Trigger especializado: alta/baja de usuarios del CMS
create or replace function public.log_admin_email_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_action text;
  v_email  text;
begin
  if auth.uid() is null then return null; end if;
  v_email := coalesce(new.email, old.email)::text;

  if tg_op = 'INSERT' then v_action := 'create';
  elsif tg_op = 'UPDATE' then v_action := 'update';
  else v_action := 'delete'; end if;

  insert into public.audit_log(actor_id, action, resource, table_name, record_id, record_label, details)
  values (
    auth.uid(), v_action, 'admins', 'admin_emails', v_email, v_email,
    jsonb_build_object('kind', 'admin_user', 'role', coalesce(new.role, old.role))
  );
  return null;
exception when others then
  raise warning 'audit admin_email log failed: % (sqlstate=%)', sqlerrm, sqlstate;
  return null;
end;
$$;

revoke all on function public.log_admin_email_change() from public, anon, authenticated;

drop trigger if exists admin_emails_audit on public.admin_emails;
create trigger admin_emails_audit after insert or update or delete on public.admin_emails
  for each row execute function public.log_admin_email_change();

-- # 6. Recurso 'activity' en admin_permissions (preservando los 13 existentes)
alter table public.admin_permissions drop constraint admin_permissions_resource_check;
alter table public.admin_permissions add constraint admin_permissions_resource_check
  check (resource in (
    'posts','books','authors','collaborators','categories','site',
    'orders','subscribers','admins','staff','collections','translators',
    'prologuists','activity'
  ));

-- # 7. RLS: SELECT solo con permiso 'activity' view; nadie escribe directo
alter table public.audit_log enable row level security;

drop policy if exists "audit_log select with permission" on public.audit_log;
create policy "audit_log select with permission"
  on public.audit_log for select to authenticated
  using ( public.has_permission(auth.uid(), 'activity', 'view') );

revoke insert, update, delete on public.audit_log from anon, authenticated;
