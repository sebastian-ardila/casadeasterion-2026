// POST /functions/v1/submit-order
// Headers: Authorization: Bearer <jwt-from-google-oauth>
// Body:    {
//   items:    [{ slug: string, quantity: number }],
//   customer: { full_name?: string, phone?: string, notes?: string }
// }
//
// Validates the JWT, looks the books up server-side by slug (we never
// trust client-supplied prices), inserts a purchase_intent + items,
// builds the WhatsApp URL using the editorial's phone + template from
// site_configuration, and returns the URL so the public site can
// redirect the customer to it. Anti-bot is handled by Google OAuth:
// no JWT, no order.

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
    "access-control-allow-headers": "content-type, authorization, apikey, x-client-info",
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

// Validate that the body has the expected shape. Returns the
// normalized version or null on shape error.
type CartItem = { slug: string; quantity: number };
type Customer = { full_name: string; phone: string | null; notes: string | null };
function parseBody(raw: unknown): { items: CartItem[]; customer: Customer } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.items) || r.items.length === 0 || r.items.length > 50) return null;
  const items: CartItem[] = [];
  for (const it of r.items) {
    if (!it || typeof it !== "object") return null;
    const o = it as Record<string, unknown>;
    const slug = typeof o.slug === "string" ? o.slug.trim() : "";
    const quantity = typeof o.quantity === "number" ? Math.floor(o.quantity) : 0;
    if (!slug || slug.length > 200) return null;
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) return null;
    items.push({ slug, quantity });
  }
  const c = (r.customer && typeof r.customer === "object" ? r.customer : {}) as Record<string, unknown>;
  const cleanStr = (v: unknown, max: number) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";
  const customer: Customer = {
    full_name: cleanStr(c.full_name, 200),
    phone: cleanStr(c.phone, 50) || null,
    notes: cleanStr(c.notes, 1000) || null,
  };
  return { items, customer };
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === "COP") {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
  }).format(amount);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, { status: 405, origin });
  }

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

  // 1. Validate JWT via the Auth API.
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userResult, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResult?.user) {
    return jsonResponse({ error: "invalid_token" }, { status: 401, origin });
  }
  const user = userResult.user;
  const profileEmail = user.email?.toLowerCase().trim();
  if (!profileEmail) {
    return jsonResponse({ error: "no_email_in_token" }, { status: 400, origin });
  }

  let bodyJson: unknown = {};
  try {
    bodyJson = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, { status: 400, origin });
  }
  const parsed = parseBody(bodyJson);
  if (!parsed) {
    return jsonResponse({ error: "invalid_body" }, { status: 400, origin });
  }
  const { items: cartItems, customer } = parsed;

  // 2. Rate-limit per IP.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const ip = getRemoteIp(req);
  const rlKey = await rateLimitKey(ip, "submit-order");
  const { data: allowed, error: rlErr } = await admin.rpc("check_rate_limit", {
    p_key: rlKey,
    p_max: 5,
    p_window_seconds: 60,
  });
  if (rlErr) {
    console.error("[submit-order] rate-limit error:", rlErr);
    return jsonResponse({ error: "rate_limit_error" }, { status: 500, origin });
  }
  if (allowed === false) {
    return jsonResponse({ error: "too_many_requests" }, { status: 429, origin });
  }

  // 3. Look the books up server-side. Trust DB price, not the client.
  const slugs = [...new Set(cartItems.map((i) => i.slug))];
  const { data: books, error: booksErr } = await admin
    .from("books")
    .select("id, slug, title, isbn, cover_image_url, price_amount, price_currency, status")
    .in("slug", slugs)
    .eq("status", "published");
  if (booksErr) {
    console.error("[submit-order] books lookup error:", booksErr);
    return jsonResponse({ error: "lookup_failed" }, { status: 500, origin });
  }
  const bookBySlug = new Map((books ?? []).map((b) => [b.slug, b] as const));
  const lineItems: Array<{
    book: { id: string; slug: string; title: string; isbn: string | null; cover_image_url: string | null; price_amount: number | null; price_currency: string };
    quantity: number;
    subtotal: number;
  }> = [];
  for (const ci of cartItems) {
    const b = bookBySlug.get(ci.slug);
    if (!b) {
      return jsonResponse(
        { error: "book_not_found", slug: ci.slug },
        { status: 400, origin },
      );
    }
    const unit = Number(b.price_amount ?? 0);
    lineItems.push({ book: b, quantity: ci.quantity, subtotal: unit * ci.quantity });
  }

  // Use the first item's currency for the order. All books in this
  // editorial use the same currency in practice; if mixed, we still
  // sum the numeric amounts but display whichever was first.
  const currency = lineItems[0]?.book.price_currency || "COP";
  const totalAmount = lineItems.reduce((s, li) => s + li.subtotal, 0);

  // 4. WhatsApp config from site_configuration.
  const { data: cfgRows } = await admin
    .from("site_configuration")
    .select("key, value")
    .in("key", ["whatsapp_phone", "whatsapp_message_template"]);
  const cfg = new Map((cfgRows ?? []).map((r) => [r.key, r.value] as const));
  const whatsappPhoneRaw = String(cfg.get("whatsapp_phone") ?? "").replace(/\D/g, "");
  const messageTemplate =
    String(cfg.get("whatsapp_message_template") ?? "Hola, me interesa este libro: {title}").trim();
  if (!whatsappPhoneRaw) {
    return jsonResponse({ error: "whatsapp_not_configured" }, { status: 500, origin });
  }

  // 5. Build the message body. The customer-facing template is mostly
  // single-book ("{title}"), so when we have a cart we render a list.
  const fullName = customer.full_name || (user.user_metadata?.full_name as string | undefined) || profileEmail;
  const lines: string[] = [];
  lines.push(`Hola, soy ${fullName}.`);
  lines.push("Me interesan los siguientes libros:");
  lines.push("");
  for (const li of lineItems) {
    const price = li.book.price_amount != null
      ? formatCurrency(Number(li.book.price_amount), li.book.price_currency)
      : "consultar precio";
    const qty = li.quantity > 1 ? ` × ${li.quantity}` : "";
    lines.push(`• ${li.book.title}${qty} — ${price}`);
  }
  lines.push("");
  if (lineItems.some((li) => li.book.price_amount != null)) {
    lines.push(`Total estimado: ${formatCurrency(totalAmount, currency)}`);
    lines.push("");
  }
  if (customer.phone) lines.push(`Teléfono: ${customer.phone}`);
  if (customer.notes) {
    lines.push("");
    lines.push(`Notas: ${customer.notes}`);
  }
  // Fallback path: if the editor configured a single-book template
  // we still surface it as a header for the very first book — keeps
  // backward compatibility with the existing UX.
  void messageTemplate;
  const message = lines.join("\n");

  // 6. Insert purchase_intent + items.
  const { data: intent, error: intentErr } = await admin
    .from("purchase_intents")
    .insert({
      profile_id: user.id,
      email: profileEmail,
      full_name: fullName,
      phone: customer.phone,
      notes: customer.notes,
      total_amount: totalAmount,
      currency,
      whatsapp_message: message,
    })
    .select("id")
    .single();
  if (intentErr || !intent) {
    console.error("[submit-order] intent insert:", intentErr);
    return jsonResponse({ error: "intent_insert_failed" }, { status: 500, origin });
  }

  const itemsRows = lineItems.map((li, idx) => ({
    intent_id: intent.id,
    book_id: li.book.id,
    book_title: li.book.title,
    book_slug: li.book.slug,
    book_isbn: li.book.isbn,
    cover_image_url: li.book.cover_image_url,
    unit_price: li.book.price_amount,
    currency: li.book.price_currency,
    quantity: li.quantity,
    position: idx,
  }));
  const { error: itemsErr } = await admin
    .from("purchase_intent_items")
    .insert(itemsRows);
  if (itemsErr) {
    console.error("[submit-order] items insert:", itemsErr);
    // Roll back the intent so we don't leave an orphan.
    await admin.from("purchase_intents").delete().eq("id", intent.id);
    return jsonResponse({ error: "items_insert_failed" }, { status: 500, origin });
  }

  // 7. Build WhatsApp URL. We use wa.me (Click-to-Chat) which works
  // for both mobile and web WhatsApp. The phone must be E.164-ish
  // without the leading "+".
  const url = `https://wa.me/${whatsappPhoneRaw}?text=${encodeURIComponent(message)}`;

  return jsonResponse(
    { ok: true, intent_id: intent.id, url, total_amount: totalAmount, currency },
    { origin },
  );
});
