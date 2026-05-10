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

/** Returns the active session, or null if there isn't one yet.
 *
 *  When the user has just returned from the Google OAuth flow,
 *  Supabase needs a moment to exchange the URL `?code=...` for a
 *  session. detectSessionInUrl handles this automatically, but the
 *  exchange is async — a `getSession()` call right after page load
 *  can return null before the exchange completes. This helper
 *  detects that case and waits up to 5s for SIGNED_IN to fire. */
export async function getCustomerSession(): Promise<Session | null> {
  const supabase = getCustomerClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  // Only wait if the URL actually carries a callback artifact.
  const hasCallback =
    url.searchParams.has("code") ||
    url.hash.includes("access_token=") ||
    url.hash.includes("error=");
  if (!hasCallback) return null;

  return await new Promise<Session | null>((resolve) => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === "SIGNED_IN" && sess) {
        sub.subscription.unsubscribe();
        clearTimeout(timeout);
        // Strip the OAuth artifacts from the URL so a refresh
        // doesn't try to re-exchange a one-time code.
        const clean = new URL(window.location.href);
        clean.searchParams.delete("code");
        clean.searchParams.delete("state");
        clean.hash = "";
        window.history.replaceState({}, "", clean.toString());
        resolve(sess);
      }
    });
    const timeout = setTimeout(() => {
      sub.subscription.unsubscribe();
      resolve(null);
    }, 5000);
  });
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
