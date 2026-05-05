# Casa de Asterión — Notes for future sessions

This is the **public site + backend** repo. The admin CMS lives in a sister repo. They share one Supabase project.

## Sister repo

Admin CMS (Astro SSR with Google OAuth):
https://github.com/sebastian-ardila/casadeasterion-2026-cms

Local clone (typical setup):
- `~/Docs/Code/casadeasterion-2026/` ← this repo
- `~/Docs/Code/casadeasterion-2026-cms/` ← sister repo

## Architecture

```
┌─ Sister repo (CMS, SSR Astro) ──writes──┐
│                                          │
│                                  Supabase Postgres
│                                          │
│  This repo (apps/web — public, SSG)──reads at build time──┘
│
└─ DB Trigger → Amplify Build Hook → Astro SSG rebuild → casadeasterionediciones.com
```

**Key invariant**: the public site (`apps/web`) is **read-only** of Supabase content tables, fetched at build time only. Never use `supabase-js` at runtime in the browser for content. The CMS (sister repo) is the only writer.

## Stack

- `apps/web` — Astro 5 SSG, Tailwind 4, deployed to AWS Amplify (`casadeasterionediciones.com`)
- `supabase/migrations/` — versioned SQL migrations applied via Supabase MCP
- `supabase/functions/` — Deno edge functions (`subscribe`, `confirm-subscription`, `unsubscribe`)
- `supabase/types/database.types.ts` — generated TypeScript types (source of truth)

## Database types — KEEP SISTER REPO IN SYNC

When DB schema changes:

1. Apply migration (this repo, via Supabase MCP):
   ```
   mcp__plugin_supabase_supabase__apply_migration
   ```
2. Save the SQL to `supabase/migrations/00XX_<name>.sql` for version control.
3. Regenerate TS types:
   ```
   mcp__plugin_supabase_supabase__generate_typescript_types
   ```
   Save output to `supabase/types/database.types.ts`.
4. **Copy to sister repo**:
   ```bash
   cp supabase/types/database.types.ts \
      ../casadeasterion-2026-cms/src/types/database.types.ts
   ```
5. Commit & push **both** repos.

If you only update one, the CMS will fail with "column not found" or RLS-rejection errors. There's no automatic sync; this is a manual hop you must remember.

## Anti-bot stack (public forms)

The newsletter form lives here in `apps/web`. Defense layers:

1. **Cloudflare Turnstile** — site key in `apps/web/.env`, secret in Supabase `vault.secrets` under `turnstile_secret`
2. **Honeypot field** — `<input name="website">` hidden via CSS (not display:none)
3. **Rate limit** — `public.check_rate_limit()` Postgres function, 5/min/IP per endpoint
4. **Origin allowlist** — edge function rejects requests without valid `Origin` header
5. **Email regex** — strict server-side validation
6. **`robots.txt`** — blocks AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.) — list in `site_configuration.robots_block_ai`

The CMS (sister repo) does NOT need any of these — it's behind Google OAuth.

## Build pipeline (content → live)

DB triggers in `supabase/migrations/0011_amplify_rebuild_triggers.sql` (refined in `0012_smarter_rebuild_triggers.sql`) fire `pg_net.http_post` to Amplify's incoming webhook on writes to:
- `posts`, `books` — only when status='published' or transitioning to/from published
- `authors`, `categories`, `site_configuration` — any change

The Build Hook URL lives in Supabase `vault.secrets` under `amplify_build_hook_url`. Function reads from vault on each invocation; if the vault key is missing, the trigger silently no-ops (intentional — for staging environments without a deployed frontend).

## Folder structure

```
apps/web/             ← Astro SSG public site
supabase/
  migrations/         ← SQL migrations (versioned)
  functions/          ← Deno edge functions
    subscribe/
    confirm-subscription/
    unsubscribe/
  types/              ← generated TS types (source of truth, copy to sister)
amplify.yml           ← single-app SSG build config
```

## Common gotchas

- **Adding new content tables**: don't forget to add a rebuild trigger in a new migration mirroring `0012_smarter_rebuild_triggers.sql`'s pattern.
- **RLS**: every public table has RLS on. Public reads (anon) only see `status='published'`. The build-time fetch from Astro uses the anon key, so it sees the same data the public would (which is what we want).
- **`is_admin()` is `SECURITY DEFINER`**: only callable by `authenticated`, never by `anon`. The advisor warns about it being callable; that's intentional and necessary for RLS to use it.
- **Edge function imports**: when modifying `supabase/functions/subscribe/`, the `anti_bot.ts` is colocated as a sibling (not in `_shared/`) because the MCP deploy tool flattens that way. Don't restructure.
- **Astro `output: "static"`**: the public site MUST stay static. Don't introduce `output: "server"` or SSR routes — the architecture depends on full static output.

## Local dev

```bash
pnpm install
cp apps/web/.env.example apps/web/.env  # fill in values from Supabase dashboard
pnpm --filter web dev
# http://localhost:4321
```

## Deployment

- Public site: AWS Amplify Hosting (`casadeasterionediciones.com`). `amplify.yml` at repo root drives the build.
- DNS: Route 53 in same AWS account; Amplify auto-manages records.
- Custom domain SSL: Amplify-managed.
