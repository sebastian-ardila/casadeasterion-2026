import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "~/lib/supabase-server";

export const GET: APIRoute = async (ctx) => {
  const code = ctx.url.searchParams.get("code");
  const next = ctx.url.searchParams.get("next") ?? "/";

  if (!code) {
    return ctx.redirect("/login?error=oauth_failed");
  }

  const supabase = getSupabaseServerClient(ctx.request, ctx.cookies);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchange failed:", error.message);
    return ctx.redirect("/login?error=oauth_failed");
  }

  return ctx.redirect(next);
};
