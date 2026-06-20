# Histórico de acciones por usuario (audit log) — Diseño

**Fecha:** 2026-06-20
**Repos afectados:** `casadeasterion-2026` (DB/migraciones) y `casadeasterion-2026-cms` (UI)

## Objetivo

En el CMS, dentro de la ficha de cada usuario (`/admins/[id]`), debajo del panel de
"permisos por sección", mostrar una lista cronológica de las últimas acciones que ese
usuario ha realizado: crear/editar/borrar contenido en cualquier sección, y cambios de
permisos o de usuarios del CMS. El bloque solo es visible para usuarios que tengan el
permiso correspondiente (`activity: view`); el Owner siempre lo ve.

## Decisiones tomadas (brainstorming)

1. **Nivel de detalle:** resumen legible por acción (no diff campo-a-campo).
   Ej.: «Editó el libro «El Aleph»», «Eliminó la categoría «Poesía»»,
   «Cambió permisos de Juan: Suscriptores → Editar».
2. **Visibilidad:** estricta por permiso. Sin el permiso `activity: view` no se ve ningún
   histórico (ni el propio). El Owner siempre puede.
3. **Mecanismo de captura:** híbrido — triggers en la base de datos capturan todo
   automáticamente (datos estructurados); el CMS arma el texto legible al renderizar.
4. **Junctions y reordenamientos** (asignar/quitar autores de un libro, cambios de
   `sort_order`): **fuera de la v1** para evitar ruido. Posible extensión futura.
5. **Retención:** sin borrado automático en la v1. La tabla crece lento; una limpieza de
   logs antiguos (>1–2 años) se puede añadir más adelante.

## Arquitectura

```
Usuario CMS hace acción (auth.uid() presente)
        │
        ▼
INSERT/UPDATE/DELETE en tabla de contenido
        │  (trigger AFTER … FOR EACH ROW, SECURITY DEFINER)
        ▼
log_audit_event()  ──inserta──▶  public.audit_log
                                      │  (RLS: SELECT solo con has_permission(uid,'activity','view'))
                                      ▼
CMS /admins/[id]  ──lee actor_id = id, orden desc, limit 50──▶  describeAuditEntry() ▶ timeline UI
```

## 1. Base de datos (repo `casadeasterion-2026`, migración `0046_audit_log.sql`)

### 1.1 Tabla `public.audit_log` (inmutable: solo INSERT)

```sql
create table public.audit_log (
  id            bigint generated always as identity primary key,
  actor_id      uuid references public.profiles(id) on delete set null,
  action        text not null check (action in ('create','update','delete')),
  resource      text not null,   -- sección lógica del CMS
  table_name    text not null,   -- tabla física (trazabilidad/debug)
  record_id     text,            -- id del registro afectado (text: ids heterogéneos)
  record_label  text,            -- etiqueta legible capturada en el momento
  details       jsonb,           -- contexto extra (cambios de permisos/usuarios)
  created_at    timestamptz not null default now()
);

create index audit_log_actor_created_idx
  on public.audit_log (actor_id, created_at desc);
```

- `record_id` es `text` porque las PKs son heterogéneas (uuid en la mayoría, `key` en
  `site_configuration`, `email` en `admin_emails`).
- No se crean triggers de `updated_at`: la tabla es inmutable.

### 1.2 Función genérica de captura

```sql
create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_resource  text := tg_argv[0];   -- recurso lógico
  v_label_col text := tg_argv[1];   -- columna que sirve de etiqueta
  v_action    text;
  v_row       jsonb;
  v_id        text;
  v_label     text;
begin
  -- Solo registrar acciones de usuarios reales del CMS.
  -- auth.uid() es null en escrituras de sistema (edge functions, seeds, service role).
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

  -- 'id' en la mayoría de tablas; fallback a la columna-etiqueta cuando la PK no es 'id'
  -- (p. ej. site_configuration usa 'key').
  v_id    := coalesce(v_row ->> 'id', v_row ->> v_label_col);
  v_label := v_row ->> v_label_col;

  insert into public.audit_log(actor_id, action, resource, table_name, record_id, record_label)
  values (auth.uid(), v_action, v_resource, tg_table_name, v_id, v_label);

  return null;
exception when others then
  -- Nunca bloquear la operación principal por un fallo de auditoría.
  raise warning 'audit log failed: % (sqlstate=%)', sqlerrm, sqlstate;
  return null;
end;
$$;

revoke all on function public.log_audit_event() from public, anon, authenticated;
```

Notas:
- Sigue el patrón de los triggers existentes (`set_updated_by`, `trigger_amplify_rebuild`):
  `SECURITY DEFINER`, `set search_path`, manejo de excepciones que no rompe la escritura.
- Para `site_configuration` la PK es `key`; se pasará `'key'` como columna de id **y** de
  etiqueta. Se manejará leyendo `v_row ->> 'key'` cuando `v_id` sea null (ver 1.4).

### 1.3 Triggers por tabla (contenido)

```sql
create trigger posts_audit            after insert or update or delete on public.posts
  for each row execute function public.log_audit_event('posts', 'title');
create trigger books_audit            after insert or update or delete on public.books
  for each row execute function public.log_audit_event('books', 'title');
create trigger authors_audit          after insert or update or delete on public.authors
  for each row execute function public.log_audit_event('authors', 'name');
create trigger categories_audit       after insert or update or delete on public.categories
  for each row execute function public.log_audit_event('categories', 'name');
create trigger collections_audit      after insert or update or delete on public.collections
  for each row execute function public.log_audit_event('collections', 'name');
create trigger staff_audit            after insert or update or delete on public.staff
  for each row execute function public.log_audit_event('staff', 'name');
create trigger purchase_intents_audit after insert or update or delete on public.purchase_intents
  for each row execute function public.log_audit_event('orders', 'full_name');
create trigger subscribers_audit      after insert or update or delete on public.subscribers
  for each row execute function public.log_audit_event('subscribers', 'email');
```

- `site_configuration`: se engancha con `log_audit_event('site', 'key')`; como su PK es
  `key` (no `id`), la función ya resuelve `record_id` con el `coalesce` definido en 1.2.
- `subscribers`: las altas las hacen visitantes vía edge function (sin `auth.uid()`), por lo
  que solo se registran acciones de admins (p. ej. borrar un suscriptor desde el CMS).

### 1.4 Triggers especializados (resource `admins`)

**Cambios de permisos** (`admin_permissions`):

```sql
create or replace function public.log_permission_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_target_name text;
  v_action text;
  v_profile uuid;
begin
  if auth.uid() is null then return null; end if;
  v_profile := coalesce(new.profile_id, old.profile_id);
  select coalesce(full_name, email) into v_target_name from public.profiles where id = v_profile;

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

create trigger admin_permissions_audit after insert or update or delete on public.admin_permissions
  for each row execute function public.log_permission_change();
```

**Alta/baja de usuarios del CMS** (`admin_emails`):

```sql
create or replace function public.log_admin_email_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_action text; v_email text;
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

create trigger admin_emails_audit after insert or update or delete on public.admin_emails
  for each row execute function public.log_admin_email_change();
```

### 1.5 Permiso `activity` y RLS

```sql
-- 1) Añadir 'activity' al check de resource en admin_permissions
alter table public.admin_permissions drop constraint admin_permissions_resource_check;
alter table public.admin_permissions add constraint admin_permissions_resource_check
  check (resource in (
    'posts','books','authors','collaborators','categories','site',
    'orders','subscribers','admins','staff','collections','activity'
  ));

-- 2) RLS en audit_log
alter table public.audit_log enable row level security;

create policy "audit_log select with permission"
  on public.audit_log for select to authenticated
  using ( public.has_permission(auth.uid(), 'activity', 'view') );

-- Sin policies de INSERT/UPDATE/DELETE: solo los triggers SECURITY DEFINER escriben.
revoke insert, update, delete on public.audit_log from anon, authenticated;
```

- `has_permission` ya devuelve `true` para el Owner, así que el Owner siempre ve el log.
- El filtro por usuario concreto (`actor_id = [id]`) lo aplica la query del CMS; la RLS solo
  decide si la persona logueada puede ver auditoría en general.

### 1.6 Sincronización de tipos (obligatorio, ver CLAUDE.md)

1. Aplicar migración vía `apply_migration`.
2. Guardar SQL en `supabase/migrations/0046_audit_log.sql`.
3. Regenerar `supabase/types/database.types.ts`.
4. Copiar a sister repo: `cp supabase/types/database.types.ts ../casadeasterion-2026-cms/src/types/database.types.ts`.
5. Commit + push en ambos repos.

## 2. CMS (repo `casadeasterion-2026-cms`)

### 2.1 Nuevo recurso `activity` en `src/lib/auth.ts`

- Añadir `activity` a `RESOURCES` y `CONFIGURABLE_RESOURCES`.
- `RESOURCE_LABEL.activity = "Auditoría"`.
- Ícono: `lucide:history` (en el grid de permisos de `/admins/[id].astro`).
- Niveles aplicables: solo `none` / `view` (no existe `edit` para auditoría). El dropdown de
  ese recurso ofrece únicamente "Sin acceso" y "Ver".

### 2.2 Render del texto legible — `src/lib/audit.ts` (nuevo)

```ts
type AuditEntry = {
  id: number;
  action: "create" | "update" | "delete";
  resource: string;
  record_label: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

// "Creó" | "Editó" | "Eliminó" + sustantivo singular del recurso + «etiqueta»
// Caso resource === "admins" con details.kind === "permission":
//   "Cambió permisos de «Juan»: Suscriptores → Editar"
// Caso details.kind === "admin_user":
//   "Agregó al usuario «juan@…» (Editor)" / "Quitó al usuario «juan@…»"
export function describeAuditEntry(e: AuditEntry): { icon: string; text: string };
```

- Mapa `RESOURCE_SINGULAR` ("el libro", "la categoría", "el autor", …) e ícono por recurso
  (reutiliza el mapa de íconos existente del grid de permisos).
- Para el nivel de permiso en el texto se traduce con las etiquetas existentes
  (`none`→"Sin acceso", `view`→"Ver", `edit`→"Editar").

### 2.3 Bloque de UI en `src/pages/admins/[id].astro`

- Ubicación: justo **debajo** del grid de permisos (después de la línea ~210).
- Guard de visibilidad: renderizar solo si el usuario logueado tiene `activity: view`
  (usar el resultado de `getAllPermissions`/`requirePermission` ya disponible en la página).
- Carga de datos (server-side, con `getSupabaseServerClient` + RLS):
  ```ts
  const { data: entries } = await supabase
    .from("audit_log")
    .select("id, action, resource, record_label, details, created_at")
    .eq("actor_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  ```
- Render: lista/timeline reutilizando el patrón visual de `editorMeta`/`formatAgo`
  (ícono del recurso + texto de `describeAuditEntry` + "hace 2 h" en estilo `.lp-meta-when`).
- Estado vacío: "Sin actividad registrada".
- **"Ver más":** botón que carga las siguientes 50 (paginación incremental por `created_at`
  o por `id < último`). Implementación cliente con un pequeño endpoint
  `GET /api/admins/audit?profile_id=<id>&before=<id>` o re-render server; se decide en el plan.

## 3. Alcance explícito (v1)

**Incluye:** posts, books, authors, categories, collections, staff, site_configuration,
purchase_intents (orders), subscribers, admin_permissions, admin_emails.

**Excluye (v1):** tablas junction (book_authors, post_authors, *_collaborators,
*_translators, *_prologuists), cambios de `sort_order`/reordenamientos, y cambios en
`profiles` (rol). Posibles extensiones futuras.

## 4. Pruebas / verificación

- Tras migrar: ejecutar una acción de cada tipo desde el CMS (crear libro, editar autor,
  borrar categoría, cambiar un permiso) y verificar que aparece la fila correcta en
  `audit_log` con `actor_id`, `resource`, `record_label` y `details` correctos.
- Verificar que una escritura sin sesión (edge function de suscripción) **no** genera fila.
- Verificar RLS: un usuario sin `activity: view` recibe 0 filas; con el permiso, ve el log;
  el Owner siempre lo ve.
- Verificar UI: el bloque no aparece sin permiso; con permiso muestra la timeline ordenada y
  el texto legible es correcto para cada tipo de acción.

## 5. Riesgos / notas

- **Volumen:** cada escritura añade una fila. Con el tráfico actual del CMS es despreciable;
  el índice `(actor_id, created_at desc)` mantiene la consulta barata. Revisar retención si
  la tabla supera cientos de miles de filas.
- **`record_label` es un snapshot**: si luego se renombra/borra el registro, el log conserva
  el nombre que tenía al momento de la acción (deseable para una bitácora).
- **No romper la operación principal:** los triggers capturan excepciones y solo emiten
  `warning`, nunca abortan el INSERT/UPDATE/DELETE original.
- **Mantener `output: "static"`** en el sitio público: esta feature vive solo en el CMS (SSR)
  y la DB; no toca `apps/web`.
