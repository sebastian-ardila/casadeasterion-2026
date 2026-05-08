// POST /functions/v1/subscribe-with-auth
// Headers: Authorization: Bearer <jwt-from-google-oauth>
// Body:    { source?: string }
//
// The JWT proves the user is authenticated through Google. We extract the
// verified email from the token, mark them as confirmed (no double opt-in
// needed — Google already verified ownership), and return success.
//
// This is the only public subscription path. The legacy /functions/v1/subscribe
// is kept for backwards compatibility but should not be called.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://casadeasterionediciones.com,https://www.casadeasterionediciones.com,http://localhost:4321,http://localhost:4322")
  .split(",")
  .map((s) => s.trim());

function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

function jsonResponse(
  body: unknown,
  init: ResponseInit & { origin?: string | null } = {},
): Response {
  const { origin, headers, ...rest } = init;
  return new Response(JSON.stringify(body), {
    ...rest,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(origin ?? null),
      ...(headers ?? {}),
    },
  });
}

function getRemoteIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "0.0.0.0"
  );
}

async function rateLimitKey(ip: string, endpoint: string): Promise<string> {
  const enc = new TextEncoder().encode(`${ip}|${endpoint}`);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(hash)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, { status: 405, origin });
  }

  // Origin allowlist — first line of defense against CSRF + random callers.
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return jsonResponse({ error: "origin_not_allowed" }, { status: 403, origin });
  }

  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!token) {
    return jsonResponse({ error: "missing_auth" }, { status: 401, origin });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1. Validate the JWT with the Auth API. supabase-js does this for us.
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userResult, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResult?.user) {
    return jsonResponse({ error: "invalid_token" }, { status: 401, origin });
  }
  const user = userResult.user;
  const email = user.email?.toLowerCase().trim();
  if (!email) {
    return jsonResponse({ error: "no_email_in_token" }, { status: 400, origin });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // body is optional
  }
  const source = typeof body.source === "string" ? body.source.slice(0, 64) : null;
  const ip = getRemoteIp(req);

  // 2. Light rate-limit per IP — even with auth, we don't want abuse.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const rlKey = await rateLimitKey(ip, "subscribe-auth");
  const { data: allowed, error: rlErr } = await admin.rpc("check_rate_limit", {
    p_key: rlKey,
    p_max: 10,
    p_window_seconds: 60,
  });
  if (rlErr) {
    console.error("[subscribe-with-auth] rate-limit error:", rlErr);
    return jsonResponse({ error: "rate_limit_error" }, { status: 500, origin });
  }
  if (allowed === false) {
    return jsonResponse({ error: "too_many_requests" }, { status: 429, origin });
  }

  // 3. Hash IP for storage (never raw).
  const ipHashEnc = new TextEncoder().encode(`${ip}|${email}`);
  const ipHashBuf = await crypto.subtle.digest("SHA-256", ipHashEnc);
  const ipHash = [...new Uint8Array(ipHashBuf)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // 4. Upsert the subscriber. Confirmed at insert time — Google verified them.
  const { data: existing } = await admin
    .from("subscribers")
    .select("id, unsubscribed_at")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    if (!existing.unsubscribed_at) {
      // Already an active subscriber — idempotent success.
      return jsonResponse({ ok: true, status: "already_subscribed", email }, { origin });
    }
    // Re-subscribing after an unsubscribe.
    const { error: updErr } = await admin
      .from("subscribers")
      .update({
        unsubscribed_at: null,
        confirmed_at: new Date().toISOString(),
        ip_hash: ipHash,
        source,
      })
      .eq("id", existing.id);
    if (updErr) {
      console.error("[subscribe-with-auth] re-subscribe error:", updErr);
      return jsonResponse({ error: "update_failed" }, { status: 500, origin });
    }
    return jsonResponse({ ok: true, status: "resubscribed", email }, { origin });
  }

  const { error: insErr } = await admin.from("subscribers").insert({
    email,
    source,
    ip_hash: ipHash,
    // confirmed_at defaults to now() in the schema.
  });
  if (insErr) {
    console.error("[subscribe-with-auth] insert error:", insErr);
    return jsonResponse({ error: "insert_failed" }, { status: 500, origin });
  }

  return jsonResponse({ ok: true, status: "subscribed", email }, { origin });
});
