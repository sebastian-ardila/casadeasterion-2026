// Shared anti-bot helpers for edge functions: Turnstile, honeypot,
// rate-limit, origin validation, and basic input checks.
//
// All functions return either { ok: true } or { ok: false, status, error }
// so the calling edge function can short-circuit with a Response.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export type Result<T = void> =
  | ({ ok: true } & T)
  | { ok: false; status: number; error: string };

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://casadeasterionediciones.com,https://www.casadeasterionediciones.com,http://localhost:4321,http://localhost:4322")
  .split(",")
  .map((s) => s.trim());

export function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

export function validateOrigin(req: Request): Result {
  const origin = req.headers.get("origin");
  if (!origin) {
    return { ok: false, status: 403, error: "Missing Origin header." };
  }
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return { ok: false, status: 403, error: "Origin not allowed." };
  }
  return { ok: true };
}

export function checkHoneypot(value: unknown): Result {
  if (typeof value === "string" && value.trim().length > 0) {
    // Bot filled the honeypot. Pretend success but caller decides.
    return { ok: false, status: 200, error: "honeypot_triggered" };
  }
  return { ok: true };
}

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
  token: string | undefined,
  remoteIp: string | undefined,
): Promise<Result> {
  if (!token) {
    return { ok: false, status: 403, error: "Missing captcha token." };
  }

  // The PostgREST API only exposes the `public` schema, so we can't read
  // vault.decrypted_secrets directly. We call the public.get_secret() RPC
  // (SECURITY DEFINER, granted to service_role only).
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: secret, error } = await admin.rpc("get_secret", {
    p_name: "turnstile_secret",
  });

  if (error || !secret) {
    return { ok: false, status: 500, error: "Captcha not configured." };
  }

  const form = new URLSearchParams();
  form.set("secret", secret as string);
  form.set("response", token);
  if (remoteIp) form.set("remoteip", remoteIp);

  const res = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    body: form,
  });
  const json = (await res.json()) as { success?: boolean };

  if (!json.success) {
    return { ok: false, status: 403, error: "Captcha failed." };
  }
  return { ok: true };
}

/** Hashes IP+endpoint to use as a rate-limit key. Hex sha256, 16 chars. */
export async function rateLimitKey(
  ip: string,
  endpoint: string,
): Promise<string> {
  const enc = new TextEncoder().encode(`${ip}|${endpoint}`);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(hash)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function checkRateLimit(
  serviceClient: ReturnType<typeof createClient>,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<Result> {
  const { data, error } = await serviceClient.rpc("check_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    return { ok: false, status: 500, error: "rate_limit_error" };
  }
  if (data === false) {
    return { ok: false, status: 429, error: "Too many requests." };
  }
  return { ok: true };
}

const EMAIL_RE =
  /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export function validEmail(email: unknown): email is string {
  return typeof email === "string" && email.length <= 254 && EMAIL_RE.test(email);
}

export function getRemoteIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "0.0.0.0"
  );
}

export function jsonResponse(
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
