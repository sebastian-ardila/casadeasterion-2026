// GET /functions/v1/unsubscribe?token=<uuid>
// Marks subscribers.unsubscribed_at = now() if the token matches.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SITE_URL =
  Deno.env.get("PUBLIC_SITE_URL") ?? "https://casadeasterionediciones.com";

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return redirect(`${SITE_URL}/?unsubscribed=error`);
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return redirect(`${SITE_URL}/?unsubscribed=invalid`);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await admin
    .from("subscribers")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("confirmation_token", token)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return redirect(`${SITE_URL}/?unsubscribed=invalid`);
  }
  return redirect(`${SITE_URL}/?unsubscribed=ok`);
});

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { location } });
}
