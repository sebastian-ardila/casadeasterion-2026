import { createClient } from "@supabase/supabase-js";
import type { Database } from "@db/database.types";

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    "Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY. Build needs these to fetch content from Supabase.",
  );
}

export const supabase = createClient<Database>(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type Tables = Database["public"]["Tables"];
export type Post = Tables["posts"]["Row"];
export type Book = Tables["books"]["Row"];
export type Author = Tables["authors"]["Row"];
// Legacy alias: la tabla `collaborators` se eliminó en migration 0045
// (las personas se unificaron en `authors` con role_tags). Mantengo
// el alias para que el código existente que importe `Collaborator`
// siga compilando — son la misma forma de fila.
export type Collaborator = Tables["authors"]["Row"];
export type Category = Tables["categories"]["Row"];
export type SiteConfig = Tables["site_configuration"]["Row"];
