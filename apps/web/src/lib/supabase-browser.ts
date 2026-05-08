// Client-side Supabase instance, used only for the newsletter OAuth flow:
//
//   1. SubscribeForm calls signInWithOAuth({ provider: 'google', redirectTo:
//      '/suscripcion-confirmada' }).
//   2. Google → Supabase callback → bounces back to /suscripcion-confirmada
//      with a session.
//   3. That page reads the session, posts the JWT to subscribe-with-auth, and
//      signs out — leaving no persistent session in the public site.
//
// `persistSession: true` is required so step 3 can recover the session that
// step 2 stored in localStorage. We deliberately don't use this client for
// content fetching — that's still build-time only via lib/supabase.ts.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient {
  if (cached) return cached;
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY.");
  }
  cached = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storageKey: "cda-newsletter-session",
    },
  });
  return cached;
}
