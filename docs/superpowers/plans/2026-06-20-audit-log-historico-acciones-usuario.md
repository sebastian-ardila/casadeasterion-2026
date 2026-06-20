# Histórico de acciones por usuario (audit log) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar y mostrar, en la ficha de cada usuario del CMS, un histórico legible de las acciones que ese usuario ha hecho (crear/editar/borrar contenido y cambios de permisos/usuarios), visible solo para quien tenga el permiso `activity: view`.

**Architecture:** Captura híbrida — triggers en Postgres escriben en una tabla inmutable `public.audit_log` (datos estructurados), con regla anti-ruido que ignora escrituras sin `auth.uid()`. El CMS (Astro SSR) lee `audit_log` filtrado por `actor_id` bajo RLS y arma el texto legible en `src/lib/audit.ts`. La visibilidad la decide un nuevo recurso de permiso `activity`.

**Tech Stack:** Postgres 17 (Supabase, triggers PL/pgSQL `SECURITY DEFINER`), migraciones vía Supabase MCP, Astro 5 SSR + TypeScript, `@supabase/ssr`, vitest (nuevo, solo para la función pura de formateo).

## Global Constraints

- **Dos repos:** la DB y las migraciones viven en `casadeasterion-2026` (este repo); la UI vive en `casadeasterion-2026-cms` (repo hermano, ruta `../casadeasterion-2026-cms`).
- **Sincronizar tipos siempre:** tras cualquier cambio de schema, regenerar `supabase/types/database.types.ts` y copiarlo a `../casadeasterion-2026-cms/src/types/database.types.ts`. Commit + push en ambos repos. (CLAUDE.md)
- **El sitio público (`apps/web`) NO se toca** y debe seguir `output: "static"`.
- **Patrón de triggers existente:** `SECURITY DEFINER`, `set search_path`, capturar excepciones con `raise warning` y nunca abortar la operación principal (como `trigger_amplify_rebuild`).
- **Migraciones:** numeración secuencial de 4 dígitos. La última es `0045_unified_people_roles`; la nueva es `0046_audit_log`.
- **Recurso lógico ≠ tabla:** las personas (autores/colaboradores/traductores/prologuistas) están todas en la tabla `authors`; se auditan como resource `authors`.
- **`auth.uid()` en Supabase** lee `current_setting('request.jwt.claims', true)::jsonb ->> 'sub'`. Para tests SQL se simula con `set_config('request.jwt.claims', '{"sub":"<uuid>"}', true)` dentro de una transacción.
- **Niveles de permiso para `activity`:** solo `none` y `view` (nunca `edit`).
- **Idioma de la UI y los textos:** español, con acentos correctos.
- **Commits:** terminar el mensaje con `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

**Repo `casadeasterion-2026` (DB):**
- Create: `supabase/migrations/0046_audit_log.sql` — tabla `audit_log`, función genérica + triggers de contenido, triggers especializados (permisos/usuarios), recurso `activity` en el check, RLS.
- Modify: `supabase/types/database.types.ts` — regenerado (incluye `audit_log`).

**Repo `casadeasterion-2026-cms` (UI):**
- Modify: `src/types/database.types.ts` — copia del regenerado.
- Modify: `src/lib/auth.ts` — añadir recurso `activity` (tipo, listas, etiquetas, defaults, mapa inicial).
- Create: `src/lib/audit.ts` — tipos `AuditEntry`/`AuditDetails` + `describeAuditEntry()` (función pura de formateo legible).
- Create: `src/lib/audit.test.ts` — tests unitarios de `describeAuditEntry()`.
- Modify: `package.json` — devDependency `vitest` + script `test`.
- Modify: `src/pages/admins/[id].astro` — `activity` en el grid de permisos (mapa `perms`, `RESOURCE_ICON`, opciones del dropdown) + bloque "Historial de actividad".
- Create: `src/pages/api/admins/audit.ts` — endpoint GET paginado para "Ver más".

---

## Task 1: Migración `0046_audit_log` (tabla, triggers, permiso, RLS)

**Files:**
- Create: `supabase/migrations/0046_audit_log.sql` (repo `casadeasterion-2026`)

**Interfaces:**
- Produces (consumido por Task 2 y por el CMS):
  - Tabla `public.audit_log(id bigint, actor_id uuid, action text, resource text, table_name text, record_id text, record_label text, details jsonb, created_at timestamptz)`.
  - Recurso `'activity'` válido en `admin_permissions.resource`.
  - Política RLS de SELECT en `audit_log` basada en `public.has_permission(auth.uid(), 'activity', 'view')`.

- [ ] **Step 1: Escribir el archivo de migración**

Crear `supabase/migrations/0046_audit_log.sql` con exactamente este contenido:

```sql
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
```

- [ ] **Step 2: Aplicar la migración vía Supabase MCP**

Llamar a `mcp__plugin_supabase_supabase__apply_migration` con:
- `name`: `0046_audit_log`
- `query`: el contenido completo del archivo del Step 1.

Expected: éxito sin error. (El `project_id` es `ebseegzxfrvblpwhpmhr`.)

- [ ] **Step 3: Verificar estructura (catálogos)**

Ejecutar con `mcp__plugin_supabase_supabase__execute_sql` (project_id `ebseegzxfrvblpwhpmhr`):

```sql
select
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='audit_log') as has_table,
  (select count(*) from pg_trigger
     where tgrelid in ('public.books'::regclass,'public.admin_permissions'::regclass,'public.admin_emails'::regclass)
       and tgname in ('books_audit','admin_permissions_audit','admin_emails_audit')) as has_triggers,
  (select count(*) from pg_policies
     where schemaname='public' and tablename='audit_log') as has_policy,
  (select pg_get_constraintdef(oid) from pg_constraint
     where conname='admin_permissions_resource_check') as resource_check;
```

Expected: `has_table=1`, `has_triggers=3`, `has_policy=1`, y `resource_check` contiene `'activity'`.

- [ ] **Step 4: Verificar captura con actor simulado (debe registrar)**

Ejecutar en un solo `execute_sql` (transacción que se revierte, no ensucia datos):

```sql
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from public.profiles limit 1))::text, true);
insert into public.categories (slug, name, kind)
  values ('audit-test-xyz', 'Audit Test XYZ', 'book');
select action, resource, table_name, record_label, (actor_id is not null) as has_actor
  from public.audit_log
  where table_name='categories' and record_label='Audit Test XYZ';
rollback;
```

Expected: una fila con `action='create'`, `resource='categories'`, `record_label='Audit Test XYZ'`, `has_actor=true`.

- [ ] **Step 5: Verificar regla anti-ruido (sin actor NO registra)**

```sql
begin;
select set_config('request.jwt.claims', '', true);
insert into public.categories (slug, name, kind)
  values ('audit-test-noauth', 'NoAuth Test', 'book');
select count(*) as should_be_zero
  from public.audit_log where record_label='NoAuth Test';
rollback;
```

Expected: `should_be_zero = 0`.

- [ ] **Step 6: Verificar captura de cambio de permiso**

```sql
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from public.profiles where role='owner' limit 1))::text, true);
-- tomamos un profile editor/admin existente como objetivo
insert into public.admin_permissions (profile_id, resource, level)
  values ((select id from public.profiles where role <> 'owner' limit 1), 'posts', 'view')
  on conflict (profile_id, resource) do update set level = excluded.level;
select action, resource, details->>'kind' as kind,
       details->>'perm_resource' as perm_resource, details->>'new_level' as new_level
  from public.audit_log
  where table_name='admin_permissions'
  order by id desc limit 1;
rollback;
```

Expected: fila con `resource='admins'`, `kind='permission'`, `perm_resource='posts'`, `new_level='view'`.

- [ ] **Step 7: Commit de la migración**

```bash
cd /Users/dila/Docs/Code/casadeasterion-2026
git add supabase/migrations/0046_audit_log.sql
git commit -m "feat(db): audit_log con triggers de captura y permiso activity

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Regenerar y sincronizar tipos TypeScript

**Files:**
- Modify: `supabase/types/database.types.ts` (repo `casadeasterion-2026`)
- Modify: `../casadeasterion-2026-cms/src/types/database.types.ts` (repo hermano)

**Interfaces:**
- Produces: tipo `Database` con la tabla `audit_log` (filas `Row`/`Insert`/`Update`), consumido por el CMS.

- [ ] **Step 1: Regenerar tipos vía MCP**

Llamar a `mcp__plugin_supabase_supabase__generate_typescript_types` (project_id `ebseegzxfrvblpwhpmhr`). Guardar el contenido devuelto en `supabase/types/database.types.ts` (sobrescribir).

- [ ] **Step 2: Verificar que aparece `audit_log`**

Run: `grep -c "audit_log:" /Users/dila/Docs/Code/casadeasterion-2026/supabase/types/database.types.ts`
Expected: ≥ 1.

- [ ] **Step 3: Copiar al repo hermano**

```bash
cp /Users/dila/Docs/Code/casadeasterion-2026/supabase/types/database.types.ts \
   /Users/dila/Docs/Code/casadeasterion-2026-cms/src/types/database.types.ts
```

- [ ] **Step 4: Commit en ambos repos**

```bash
cd /Users/dila/Docs/Code/casadeasterion-2026
git add supabase/types/database.types.ts
git commit -m "chore(types): regenerar tipos con audit_log

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"

cd /Users/dila/Docs/Code/casadeasterion-2026-cms
git add src/types/database.types.ts
git commit -m "chore(types): sync tipos con audit_log desde repo backend

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

(Si el CMS está en `main`, crear antes una rama: `git checkout -b feat/audit-log-historico-acciones`.)

---

## Task 3: Añadir el recurso `activity` a `src/lib/auth.ts`

**Files:**
- Modify: `../casadeasterion-2026-cms/src/lib/auth.ts`

**Interfaces:**
- Produces: `Resource` incluye `"activity"`; `RESOURCES`, `CONFIGURABLE_RESOURCES`, `RESOURCE_LABEL`, `EDITOR_DEFAULT_PERMISSIONS`, `ADMIN_DEFAULT_PERMISSIONS` y el mapa inicial de `getAllPermissions` incluyen `activity`. Consumido por Task 5 (grid) y por el guard del bloque de historial.

- [ ] **Step 1: Añadir `"activity"` al tipo `Resource`**

En `src/lib/auth.ts`, modificar el tipo (termina en `| "admins";`) para añadir `activity`:

```ts
export type Resource =
  | "posts"
  | "books"
  | "authors"
  | "collaborators"
  | "translators"
  | "prologuists"
  | "staff"
  | "collections"
  | "categories"
  | "site"
  | "orders"
  | "subscribers"
  | "activity"
  | "admins";
```

- [ ] **Step 2: Añadir `activity` a `RESOURCES` y `CONFIGURABLE_RESOURCES`**

En `RESOURCES`, añadir `"activity",` antes de `"admins",`. En `CONFIGURABLE_RESOURCES`, añadir `"activity",` al final de la lista (después de `"subscribers",`).

- [ ] **Step 3: Añadir etiqueta y defaults**

En `RESOURCE_LABEL` añadir `activity: "Auditoría",` (antes de `admins`). En `EDITOR_DEFAULT_PERMISSIONS` y `ADMIN_DEFAULT_PERMISSIONS` añadir `activity: "none",` (la auditoría no se concede por defecto a nadie salvo el owner).

- [ ] **Step 4: Añadir `activity` al mapa inicial de `getAllPermissions`**

En el objeto `out` dentro de `getAllPermissions` (el que inicializa todos los recursos en `"none"`), añadir `activity: "none",`:

```ts
  const out: Record<Resource, Level> = {
    posts: "none", books: "none", authors: "none", collaborators: "none",
    translators: "none", prologuists: "none",
    staff: "none", collections: "none", categories: "none", site: "none",
    orders: "none", subscribers: "none", activity: "none", admins: "none",
  };
```

- [ ] **Step 5: Verificar tipos**

```bash
cd /Users/dila/Docs/Code/casadeasterion-2026-cms
pnpm typecheck
```

Expected: sin errores. (Si `Record<Resource, Level>` faltara una clave en cualquier mapa, `astro check` lo reporta — esa es la red de seguridad.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat(auth): recurso de permiso 'activity' para auditoría

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `src/lib/audit.ts` — formateo legible (TDD con vitest)

**Files:**
- Modify: `../casadeasterion-2026-cms/package.json`
- Create: `../casadeasterion-2026-cms/src/lib/audit.ts`
- Test: `../casadeasterion-2026-cms/src/lib/audit.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type AuditDetails =
    | { kind: "permission"; perm_resource: string; old_level: string | null; new_level: string | null }
    | { kind: "admin_user"; role: string | null };
  export type AuditEntry = {
    id: number;
    action: "create" | "update" | "delete";
    resource: string;
    record_label: string | null;
    details: AuditDetails | null;
    created_at: string;
  };
  export function describeAuditEntry(e: AuditEntry): { icon: string; text: string };
  export const AUDIT_ICONS: string[]; // nombres lucide únicos, para plantillas SSR
  ```
  Consumido por Task 5 (render server-side + plantillas de iconos) y Task 6 (endpoint).
- `audit.ts` es **autocontenido**: no importa de `auth.ts` (que arrastra dependencias de Astro y rompería vitest). Sus mapas de etiquetas viven en el propio archivo.

- [ ] **Step 1: Añadir vitest al CMS**

```bash
cd /Users/dila/Docs/Code/casadeasterion-2026-cms
pnpm add -D vitest
```

Luego, en `package.json`, añadir al bloque `"scripts"` la línea:

```json
    "test": "vitest run",
```

(Vitest descubre `*.test.ts` sin configuración; el test usa import relativo `./audit`, sin alias.)

- [ ] **Step 2: Escribir el test (debe fallar)**

Crear `src/lib/audit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { describeAuditEntry, type AuditEntry } from "./audit";

const base: Omit<AuditEntry, "action" | "resource" | "record_label" | "details"> = {
  id: 1,
  created_at: "2026-06-20T12:00:00Z",
};

describe("describeAuditEntry", () => {
  it("creación de libro", () => {
    const r = describeAuditEntry({ ...base, action: "create", resource: "books", record_label: "El Aleph", details: null });
    expect(r.text).toBe("Creó el libro «El Aleph»");
    expect(r.icon).toBe("lucide:book-open");
  });

  it("edición de autor", () => {
    const r = describeAuditEntry({ ...base, action: "update", resource: "authors", record_label: "Borges", details: null });
    expect(r.text).toBe("Editó el autor «Borges»");
  });

  it("borrado de categoría", () => {
    const r = describeAuditEntry({ ...base, action: "delete", resource: "categories", record_label: "Poesía", details: null });
    expect(r.text).toBe("Eliminó la categoría «Poesía»");
  });

  it("etiqueta vacía cae a genérico", () => {
    const r = describeAuditEntry({ ...base, action: "update", resource: "site", record_label: null, details: null });
    expect(r.text).toBe("Editó la configuración del sitio");
  });

  it("cambio de permiso", () => {
    const r = describeAuditEntry({
      ...base, action: "update", resource: "admins", record_label: "Juan Pérez",
      details: { kind: "permission", perm_resource: "subscribers", old_level: "none", new_level: "view" },
    });
    expect(r.text).toBe("Cambió permisos de «Juan Pérez»: Suscriptores → Ver");
    expect(r.icon).toBe("lucide:shield");
  });

  it("alta de usuario del CMS", () => {
    const r = describeAuditEntry({
      ...base, action: "create", resource: "admins", record_label: "juan@mail.com",
      details: { kind: "admin_user", role: "editor" },
    });
    expect(r.text).toBe("Agregó al usuario «juan@mail.com» (Editor)");
  });

  it("baja de usuario del CMS", () => {
    const r = describeAuditEntry({
      ...base, action: "delete", resource: "admins", record_label: "juan@mail.com",
      details: { kind: "admin_user", role: "editor" },
    });
    expect(r.text).toBe("Quitó al usuario «juan@mail.com»");
  });

  it("recurso desconocido no rompe", () => {
    const r = describeAuditEntry({ ...base, action: "create", resource: "weird", record_label: "X", details: null });
    expect(r.text).toContain("«X»");
    expect(typeof r.icon).toBe("string");
  });
});
```

- [ ] **Step 3: Ejecutar el test para verificar que falla**

Run: `pnpm test`
Expected: FAIL — `Cannot find module './audit'` o `describeAuditEntry is not a function`.

- [ ] **Step 4: Implementar `src/lib/audit.ts`**

```ts
// Formateo legible de entradas del audit_log. Función pura, autocontenida
// (sin imports de auth.ts) para poder testearla con vitest sin arrastrar
// dependencias de Astro. Las etiquetas se duplican deliberadamente aquí.

export type AuditDetails =
  | { kind: "permission"; perm_resource: string; old_level: string | null; new_level: string | null }
  | { kind: "admin_user"; role: string | null };

export type AuditEntry = {
  id: number;
  action: "create" | "update" | "delete";
  resource: string;
  record_label: string | null;
  details: AuditDetails | null;
  created_at: string;
};

const VERB: Record<AuditEntry["action"], string> = {
  create: "Creó",
  update: "Editó",
  delete: "Eliminó",
};

// Sustantivo singular con artículo, por recurso lógico del audit_log.
const NOUN: Record<string, string> = {
  posts: "la publicación",
  books: "el libro",
  authors: "el autor",
  categories: "la categoría",
  collections: "la colección",
  staff: "el miembro del equipo",
  site: "la configuración del sitio",
  orders: "el pedido",
  subscribers: "el suscriptor",
};

// Ícono lucide por recurso del audit_log.
const ICON: Record<string, string> = {
  posts: "lucide:newspaper",
  books: "lucide:book-open",
  authors: "lucide:users",
  categories: "lucide:folder-tree",
  collections: "lucide:library",
  staff: "lucide:building",
  site: "lucide:settings",
  orders: "lucide:shopping-bag",
  subscribers: "lucide:mail",
  admins: "lucide:shield",
};
const FALLBACK_ICON = "lucide:activity";

// Etiqueta en español de cada recurso del sistema de permisos (para textos
// de cambios de permiso). Espejo de RESOURCE_LABEL en auth.ts.
const PERM_LABEL: Record<string, string> = {
  posts: "Publicaciones",
  books: "Catálogo",
  authors: "Autores",
  collaborators: "Colaboradores",
  translators: "Traductores",
  prologuists: "Prologuistas",
  staff: "Nosotros",
  collections: "Colecciones",
  categories: "Categorías",
  site: "Webpage",
  orders: "Pedidos",
  subscribers: "Suscriptores",
  activity: "Auditoría",
  admins: "Usuarios",
};

const LEVEL_LABEL: Record<string, string> = {
  none: "Sin acceso",
  view: "Ver",
  edit: "Editar",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  editor: "Editor",
  owner: "Owner",
};

export function describeAuditEntry(e: AuditEntry): { icon: string; text: string } {
  const label = (e.record_label ?? "").trim();

  // Acciones de gestión de usuarios / permisos.
  if (e.resource === "admins" && e.details) {
    if (e.details.kind === "permission") {
      const section = PERM_LABEL[e.details.perm_resource] ?? e.details.perm_resource;
      const lvl = LEVEL_LABEL[e.details.new_level ?? ""] ?? e.details.new_level ?? "—";
      const who = label || "un usuario";
      if (e.action === "delete") {
        return { icon: ICON.admins, text: `Restableció permisos de «${who}» en ${section}` };
      }
      return { icon: ICON.admins, text: `Cambió permisos de «${who}»: ${section} → ${lvl}` };
    }
    if (e.details.kind === "admin_user") {
      const who = label || "un usuario";
      const role = ROLE_LABEL[e.details.role ?? ""] ?? null;
      if (e.action === "create") {
        return { icon: ICON.admins, text: role ? `Agregó al usuario «${who}» (${role})` : `Agregó al usuario «${who}»` };
      }
      if (e.action === "delete") {
        return { icon: ICON.admins, text: `Quitó al usuario «${who}»` };
      }
      return { icon: ICON.admins, text: `Actualizó al usuario «${who}»` };
    }
  }

  // Contenido genérico.
  const verb = VERB[e.action];
  const noun = NOUN[e.resource] ?? `el registro (${e.resource})`;
  const icon = ICON[e.resource] ?? FALLBACK_ICON;
  const text = label ? `${verb} ${noun} «${label}»` : `${verb} ${noun}`;
  return { icon, text };
}

// Nombres lucide únicos que puede devolver describeAuditEntry. La página los
// pre-renderiza (astro-icon SSR) como plantillas ocultas para que el cliente
// las clone al paginar — iconify no está disponible en runtime.
export const AUDIT_ICONS: string[] = Array.from(new Set([...Object.values(ICON), FALLBACK_ICON]));
```

- [ ] **Step 5: Ejecutar el test para verificar que pasa**

Run: `pnpm test`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/audit.ts src/lib/audit.test.ts
git commit -m "feat(audit): describeAuditEntry + tests (vitest)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Bloque "Historial de actividad" en `/admins/[id].astro`

**Files:**
- Modify: `../casadeasterion-2026-cms/src/pages/admins/[id].astro`

**Interfaces:**
- Consumes: `describeAuditEntry`, `AuditEntry`, `AuditDetails` de `~/lib/audit`; `getAllPermissions` de `~/lib/auth`; `formatAgo` de `~/lib/relative-time`.
- Produces: el bloque de historial visible bajo el grid de permisos. El endpoint de Task 6 reusa la misma forma de consulta (`actor_id`, orden desc, page size 50).

- [ ] **Step 1: Imports y nuevas constantes en el frontmatter**

En el bloque `---` de cabecera de `src/pages/admins/[id].astro`, añadir a los imports:

```ts
import { requirePermission, getAllPermissions, CONFIGURABLE_RESOURCES, RESOURCE_LABEL, invalidateAuthCache, type Resource, type Level } from "~/lib/auth";
import { describeAuditEntry, AUDIT_ICONS, type AuditEntry } from "~/lib/audit";
import { formatAgo } from "~/lib/relative-time";
```

(Es la línea de import de `~/lib/auth` existente más `getAllPermissions`, más dos imports nuevos.)

- [ ] **Step 2: Incluir `activity` en el mapa `perms` y en `RESOURCE_ICON`**

En el objeto `perms` (inicializado en `"none"`), añadir `activity: "none",`. En `RESOURCE_ICON` añadir `activity: "lucide:history",`. Como ambos están tipados por `ConfigurableResource` (que ahora incluye `activity`), `astro check` exige estas claves.

- [ ] **Step 3: Dropdown de `activity` sin opción "Editar"**

En el grid (`CONFIGURABLE_RESOURCES.map((r) => ...`), cambiar el `<Dropdown ... options={LEVELS} ... />` por opciones filtradas para `activity`:

```astro
          <Dropdown
            name={`level_${r}`}
            value={perms[r]}
            options={r === "activity" ? LEVELS.filter((l) => l.value !== "edit") : LEVELS}
            disabled={isOwnerRow || !canEdit}
          />
```

- [ ] **Step 4: Cargar el historial (solo si el usuario logueado tiene permiso)**

Tras el bloque que carga `profile`+`permRows` y comprueba `if (!profile) ...`, añadir:

```ts
// El historial de acciones del usuario de la ficha. Solo se carga si el
// usuario LOGUEADO tiene permiso de auditoría (owner siempre lo tiene).
const viewerPerms = await getAllPermissions(Astro, owner);
const canViewActivity = viewerPerms.activity === "view" || viewerPerms.activity === "edit";

let auditEntries: AuditEntry[] = [];
if (canViewActivity) {
  const { data: auditRows } = await supabase
    .from("audit_log")
    .select("id, action, resource, record_label, details, created_at")
    .eq("actor_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  auditEntries = (auditRows ?? []) as unknown as AuditEntry[];
}
```

- [ ] **Step 5: Renderizar el bloque bajo el form de permisos**

Inmediatamente después del `</form>` del editor de permisos (la etiqueta de cierre en la línea ~210, antes del comentario "Danger zone"), insertar:

```astro
  {canViewActivity && (
    <section class="card max-w-3xl mb-12" data-audit-feed data-profile-id={profile.id}>
      <div class="mb-5">
        <h2 class="card-section-title">Historial de actividad</h2>
        <p class="card-section-desc">
          Acciones recientes de {profile.full_name ?? profile.email} en el CMS.
        </p>
      </div>

      {auditEntries.length === 0 ? (
        <p class="text-sm text-stone-500 italic">Sin actividad registrada.</p>
      ) : (
        <ul class="flex flex-col gap-3" data-audit-list>
          {auditEntries.map((entry) => {
            const { icon, text } = describeAuditEntry(entry);
            return (
              <li class="flex items-start gap-3">
                <span class="mt-0.5 shrink-0 text-stone-500">
                  <Icon name={icon} class="w-4 h-4" aria-hidden="true" />
                </span>
                <span class="min-w-0">
                  <span class="text-sm text-stone-800">{text}</span>
                  <span class="block text-[11px] italic text-stone-400">{formatAgo(entry.created_at)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Plantillas de iconos pre-renderizadas (ocultas): el script de "Ver más"
          las clona por nombre porque iconify no está disponible en runtime. */}
      <div class="hidden" data-audit-icon-templates aria-hidden="true">
        {AUDIT_ICONS.map((n) => (
          <span data-icon-name={n}><Icon name={n} class="w-4 h-4" /></span>
        ))}
      </div>

      {auditEntries.length === 50 && (
        <div class="mt-5 pt-5 border-t border-stone-100">
          <button type="button" class="btn cursor-pointer" data-audit-more>Ver más</button>
        </div>
      )}
    </section>
  )}
```

- [ ] **Step 6: Verificar tipos**

```bash
cd /Users/dila/Docs/Code/casadeasterion-2026-cms
pnpm typecheck
```

Expected: sin errores.

- [ ] **Step 7: Verificación funcional manual (dev server)**

```bash
pnpm dev
```

Con sesión de owner, abrir `http://localhost:4322/admins/<un-id>`:
- Aparece "Historial de actividad" bajo los permisos.
- El grid muestra "Auditoría" con dropdown de solo "Sin acceso"/"Ver".
- Si el usuario tiene acciones, se listan con texto legible y "hace …".
Crear/editar algo en otra sección con ese mismo usuario y recargar: aparece la nueva entrada.

- [ ] **Step 8: Commit**

```bash
git add src/pages/admins/[id].astro
git commit -m "feat(admins): bloque de historial de actividad por usuario

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Endpoint GET `/api/admins/audit` y "Ver más"

**Files:**
- Create: `../casadeasterion-2026-cms/src/pages/api/admins/audit.ts`
- Modify: `../casadeasterion-2026-cms/src/pages/admins/[id].astro` (script de paginación)

**Interfaces:**
- Consumes: `describeAuditEntry` de `~/lib/audit`; `requirePermission` de `~/lib/auth`.
- Produces: `GET /api/admins/audit?profileId=<uuid>&before=<id>` → JSON `{ entries: { id:number; icon:string; text:string; ago:string }[]; hasMore: boolean }`. El texto se arma server-side (DRY: una sola fuente de formateo).

- [ ] **Step 1: Crear el endpoint**

Crear `src/pages/api/admins/audit.ts`:

```ts
import type { APIRoute } from "astro";
import { requirePermission } from "~/lib/auth";
import { getSupabaseServerClient } from "~/lib/supabase-server";
import { describeAuditEntry, type AuditEntry } from "~/lib/audit";
import { formatAgo } from "~/lib/relative-time";

const PAGE = 50;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "private, no-store" },
  });

export const GET: APIRoute = async (ctx) => {
  const guard = await requirePermission(ctx, "activity", "view");
  if (guard instanceof Response) return json({ error: "unauthorized" }, 401);

  const profileId = ctx.url.searchParams.get("profileId");
  if (!profileId) return json({ error: "invalid_profile_id" }, 400);
  const before = ctx.url.searchParams.get("before");

  const supabase = getSupabaseServerClient(ctx.request, ctx.cookies);
  let q = supabase
    .from("audit_log")
    .select("id, action, resource, record_label, details, created_at")
    .eq("actor_id", profileId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE);
  if (before) q = q.lt("id", Number(before));

  const { data, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const rows = (data ?? []) as unknown as AuditEntry[];
  const entries = rows.map((r) => {
    const { icon, text } = describeAuditEntry(r);
    return { id: r.id, icon, text, ago: formatAgo(r.created_at) };
  });
  return json({ entries, hasMore: entries.length === PAGE });
};
```

- [ ] **Step 2: Añadir el script de "Ver más" en `[id].astro`**

Dentro del `<script is:inline>` existente al final de `src/pages/admins/[id].astro`, añadir una función `wireAudit` y llamarla junto a `wire()`/`wireDelete()`. Insertar esta función antes de la línea `document.addEventListener("astro:page-load", ...)`:

```js
    // "Ver más" del historial de actividad. Pide la siguiente página al
    // endpoint (que ya devuelve el texto formateado) y la añade a la lista.
    const wireAudit = () => {
      const feed = document.querySelector("[data-audit-feed]");
      const btn = document.querySelector("[data-audit-more]");
      if (!feed || !btn || btn.dataset.casWired) return;
      btn.dataset.casWired = "1";
      const profileId = feed.dataset.profileId;
      const list = feed.querySelector("[data-audit-list]");
      const templates = feed.querySelector("[data-audit-icon-templates]");
      const iconSvg = (el, iconName) => {
        // Clonar la plantilla pre-renderizada del icono correcto (por nombre).
        // iconify no está disponible en runtime, por eso usamos plantillas SSR.
        const tmpl = templates?.querySelector(
          `[data-icon-name="${(iconName || "").replace(/"/g, '\\"')}"] svg`,
        );
        if (tmpl) el.appendChild(tmpl.cloneNode(true));
      };
      btn.addEventListener("click", async () => {
        if (!list || !profileId) return;
        const last = list.querySelector("li:last-child");
        const before = last?.dataset.auditId;
        btn.disabled = true;
        btn.textContent = "Cargando…";
        try {
          const url = `/api/admins/audit?profileId=${encodeURIComponent(profileId)}` +
            (before ? `&before=${encodeURIComponent(before)}` : "");
          const res = await fetch(url, { credentials: "same-origin", headers: { accept: "application/json" } });
          if (!res.ok) throw new Error("http_" + res.status);
          const data = await res.json();
          for (const e of data.entries ?? []) {
            const li = document.createElement("li");
            li.className = "flex items-start gap-3";
            li.dataset.auditId = String(e.id);
            const ico = document.createElement("span");
            ico.className = "mt-0.5 shrink-0 text-stone-500";
            iconSvg(ico, e.icon);
            const body = document.createElement("span");
            body.className = "min-w-0";
            const txt = document.createElement("span");
            txt.className = "text-sm text-stone-800";
            txt.textContent = e.text;
            const ago = document.createElement("span");
            ago.className = "block text-[11px] italic text-stone-400";
            ago.textContent = e.ago;
            body.appendChild(txt); body.appendChild(ago);
            li.appendChild(ico); li.appendChild(body);
            list.appendChild(li);
          }
          if (!data.hasMore) btn.remove();
        } catch {
          if (typeof window.casToast === "function") {
            window.casToast({ type: "error", message: "No se pudo cargar más actividad." });
          }
        } finally {
          btn.disabled = false;
          btn.textContent = "Ver más";
        }
      });
    };
```

Y en cada uno de los tres disparadores existentes (`astro:page-load`, `astro:after-swap`, y el bloque `if (document.readyState === "loading") ... else ...`) añadir `wireAudit();` junto a `wire(); wireDelete();`.

- [ ] **Step 3: Añadir `data-audit-id` a los `<li>` server-side**

Para que la paginación tenga cursor, en el render del Step 5 de la Task 5, añadir `data-audit-id={entry.id}` al `<li>` de cada entrada:

```astro
              <li class="flex items-start gap-3" data-audit-id={entry.id}>
```

- [ ] **Step 4: Verificar tipos**

```bash
cd /Users/dila/Docs/Code/casadeasterion-2026-cms
pnpm typecheck
```

Expected: sin errores.

- [ ] **Step 5: Verificación funcional manual**

Con un usuario que tenga más de 50 acciones (o bajar `PAGE` a 2 temporalmente para probar): el botón "Ver más" añade entradas y desaparece cuando `hasMore` es falso. Restaurar `PAGE = 50` si se bajó.

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/admins/audit.ts src/pages/admins/[id].astro
git commit -m "feat(admins): paginación 'Ver más' del historial de actividad

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificación final (todo junto)

- [ ] **DB:** los 4 tests SQL de la Task 1 pasan.
- [ ] **Tipos:** `audit_log` presente en ambos `database.types.ts`; `pnpm typecheck` limpio en el CMS.
- [ ] **Unit:** `pnpm test` verde (8 tests de `describeAuditEntry`).
- [ ] **RLS funcional:** un editor SIN `activity: view` no ve el bloque (ni recibe filas del endpoint → 401); con `activity: view` lo ve; el owner siempre lo ve.
- [ ] **End-to-end:** crear/editar/borrar contenido y cambiar un permiso desde el CMS genera entradas legibles correctas en la ficha del actor.
- [ ] **Anti-ruido:** una suscripción pública (edge function) NO crea fila en `audit_log`.
- [ ] **Deploy:** push de ambas ramas; el CMS despliega su rama; la migración ya está aplicada en la DB compartida.

## Notas / riesgos

- `record_label` es un snapshot: si luego se renombra/borra el registro, el log conserva el nombre del momento (deseable).
- Los triggers nunca abortan la operación principal (capturan excepción → `warning`).
- Volumen despreciable con el tráfico actual; el índice `(actor_id, created_at desc)` mantiene barata la consulta. Revisar retención si la tabla supera cientos de miles de filas.
- Fuera de alcance v1: junctions (autores↔libros), reordenamientos (`sort_order`) y cambios de rol en `profiles`.
```
