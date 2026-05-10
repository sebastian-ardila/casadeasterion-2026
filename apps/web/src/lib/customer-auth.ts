// Customer auth (Google OAuth) for the public site's checkout flow.
//
// Independent storage from the newsletter subscribe client so the two
// flows don't step on each other's session. Used by:
//   - The cart drawer's "Confirmar pedido" button (kicks off OAuth).
//   - /checkout (reads the session, posts to submit-order, signs out
//     after the WhatsApp redirect).

import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getCustomerClient(): SupabaseClient {
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
      // Distinct from the subscribe storage key so the two flows are
      // isolated — a logged-out customer can still subscribe, etc.
      storageKey: "cda-customer-session",
    },
  });
  return cached;
}

/** Returns the active session, or null if there isn't one yet. */
export async function getCustomerSession(): Promise<Session | null> {
  const supabase = getCustomerClient();
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

/** Kicks off the Google OAuth flow. After consent, Google redirects to
 *  Supabase, which redirects back to redirectTo with a `code` query
 *  param. The destination page must call detectSessionInUrl (it's on
 *  by default) to complete the exchange. */
export async function signInWithGoogle(redirectTo: string): Promise<void> {
  const supabase = getCustomerClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) {
    console.error("[customer-auth] OAuth error:", error);
    throw error;
  }
}

/** Sign the customer out and clear local storage. Called after the
 *  WhatsApp redirect so we don't leave a dangling session on the
 *  public site. */
export async function signOutCustomer(): Promise<void> {
  const supabase = getCustomerClient();
  await supabase.auth.signOut();
}
