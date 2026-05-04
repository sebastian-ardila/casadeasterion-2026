import type { APIContext } from "astro";
import { getSupabaseServerClient } from "./supabase-server";

export type AdminUser = NonNullable<App.Locals["user"]>;

/**
 * Read the current session and load the profile. Returns null if no session
 * or profile not found.
 */
export async function loadCurrentUser(ctx: APIContext): Promise<App.Locals["user"]> {
  const supabase = getSupabaseServerClient(ctx.request, ctx.cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;
  return profile as AdminUser;
}

/**
 * Use in page frontmatter to require an authenticated admin.
 * Returns either the user (continue) or a Response (redirect).
 */
export async function requireAdmin(ctx: APIContext): Promise<AdminUser | Response> {
  const user = await loadCurrentUser(ctx);
  if (!user) {
    return ctx.redirect(`/login?next=${encodeURIComponent(ctx.url.pathname)}`);
  }
  if (user.role !== "admin") {
    return ctx.redirect("/login?error=not_admin");
  }
  return user;
}
