import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { Database } from "@db/database.types";
import type { AstroCookies } from "astro";

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export function getSupabaseServerClient(
  request: Request,
  cookies: AstroCookies,
) {
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("cookie") ?? "")
          .filter((c) => c.value !== undefined)
          .map((c) => ({ name: c.name, value: c.value as string }));
      },
      setAll(toSet) {
        toSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, {
            ...options,
            path: options?.path ?? "/",
          });
        });
      },
    },
  });
}

// (Admin/service-role client removed — every CMS write happens through the
//  authenticated user session, which already maps to role=admin via RLS.)
