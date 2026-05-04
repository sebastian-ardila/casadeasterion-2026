import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "~/lib/supabase-server";

export const POST: APIRoute = async (ctx) => {
  const supabase = getSupabaseServerClient(ctx.request, ctx.cookies);
  await supabase.auth.signOut();
  return ctx.redirect("/login");
};
