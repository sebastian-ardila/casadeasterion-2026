// POST /functions/v1/subscribe
// Body: { email, source?, website (honeypot), turnstile_token }
//
// Validates anti-bot layers, then upserts a subscriber with a fresh
// confirmation_token. Email sending is deferred until a provider is set up.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  checkHoneypot,
  checkRateLimit,
  corsHeaders,
  getRemoteIp,
  jsonResponse,
  rateLimitKey,
  validateOrigin,
  validEmail,
  verifyTurnstile,
} from "./anti_bot.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return jsonResponse(
      { error: "method_not_allowed" },
      { status: 405, origin },
    );
  }

  const originCheck = validateOrigin(req);
  if (!originCheck.ok) {
    return jsonResponse({ error: originCheck.error }, { status: originCheck.status, origin });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, { status: 400, origin });
  }

  const honeypot = checkHoneypot(body.website);
  if (!honeypot.ok) {
    // Pretend success — never let bots learn they were caught.
    return jsonResponse({ ok: true }, { status: 200, origin });
  }

  if (!validEmail(body.email)) {
    return jsonResponse({ error: "invalid_email" }, { status: 400, origin });
  }
  const email = (body.email as string).toLowerCase().trim();
  const source = typeof body.source === "string" ? body.source.slice(0, 64) : null;

  const ip = getRemoteIp(req);

  const turnstile = await verifyTurnstile(
    typeof body.turnstile_token === "string" ? body.turnstile_token : undefined,
    ip,
  );
  if (!turnstile.ok) {
    return jsonResponse({ error: turnstile.error }, { status: turnstile.status, origin });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Rate-limit per IP: 5 requests / 60 seconds on this endpoint.
  const rlKey = await rateLimitKey(ip, "subscribe");
  const rl = await checkRateLimit(admin, rlKey, 5, 60);
  if (!rl.ok) {
    return jsonResponse({ error: rl.error }, { status: rl.status, origin });
  }

  // Hash IP for storage (we don't store raw IPs).
  const ipHashEnc = new TextEncoder().encode(`${ip}|${email}`);
  const ipHashBuf = await crypto.subtle.digest("SHA-256", ipHashEnc);
  const ipHash = [...new Uint8Array(ipHashBuf)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Upsert by email — re-subscribing returns the same row but resets the token
  // when the subscriber had unsubscribed previously.
  const { data: existing } = await admin
    .from("subscribers")
    .select("id, confirmed_at, unsubscribed_at, confirmation_token")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    if (existing.confirmed_at && !existing.unsubscribed_at) {
      // Already confirmed: silent success (no email).
      return jsonResponse({ ok: true, status: "already_confirmed" }, { origin });
    }
    // Re-issue token + clear unsubscribed_at if it was set.
    await admin
      .from("subscribers")
      .update({
        confirmation_token: crypto.randomUUID(),
        unsubscribed_at: null,
        ip_hash: ipHash,
        source,
      })
      .eq("id", existing.id);
  } else {
    const { error: insertErr } = await admin.from("subscribers").insert({
      email,
      source,
      ip_hash: ipHash,
    });
    if (insertErr) {
      console.error("[subscribe] insert error:", insertErr);
      return jsonResponse({ error: "insert_failed" }, { status: 500, origin });
    }
  }

  // TODO(phase2): send confirmation email via Resend with the token.

  return jsonResponse({ ok: true, status: "pending_confirmation" }, { origin });
});
