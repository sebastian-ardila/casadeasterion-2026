// Public-site cart, persisted in localStorage. Vanilla JS so it
// stays small (~2KB minified) and survives full page reloads.
//
// State shape: an array of items, each with a snapshot of the book's
// public-facing fields so the cart can render even when the network
// is slow on a fresh tab. The server (submit-order edge function)
// re-reads price/title/etc from the DB at checkout — these snapshots
// are display-only.
//
// Subscribers receive the updated array on every mutation, so the
// header badge, drawer and buttons stay in sync without a framework.

const STORAGE_KEY = "cda-cart";
const MAX_ITEMS = 50;
const MAX_QTY = 99;

export type CartItem = {
  slug: string;
  title: string;
  cover_image_url: string | null;
  price_amount: number | null;
  price_currency: string;
  quantity: number;
};

type Listener = (items: CartItem[]) => void;
const listeners = new Set<Listener>();

function safeParse(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (it): it is CartItem =>
        !!it &&
        typeof it.slug === "string" &&
        typeof it.title === "string" &&
        typeof it.quantity === "number" &&
        it.quantity > 0,
    );
  } catch {
    return [];
  }
}

function readRaw(): CartItem[] {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

function writeRaw(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    // Cross-tab sync: the "storage" event fires in *other* tabs, so we
    // also dispatch a synthetic local event for same-tab listeners.
    window.dispatchEvent(new CustomEvent("cda:cart-change", { detail: items }));
  } catch {
    // localStorage might be full or disabled — fail soft.
  }
}

export function getCart(): CartItem[] {
  return readRaw();
}

export function getCartCount(): number {
  return readRaw().reduce((s, it) => s + it.quantity, 0);
}

export function getCartTotal(): { amount: number; currency: string } {
  const items = readRaw();
  let amount = 0;
  let currency = "COP";
  for (const it of items) {
    if (it.price_amount != null) amount += it.price_amount * it.quantity;
    if (it.price_currency) currency = it.price_currency;
  }
  return { amount, currency };
}

export function addToCart(input: Omit<CartItem, "quantity"> & { quantity?: number }): CartItem[] {
  const items = readRaw();
  const qty = Math.max(1, Math.min(MAX_QTY, input.quantity ?? 1));
  const existing = items.find((it) => it.slug === input.slug);
  if (existing) {
    existing.quantity = Math.min(MAX_QTY, existing.quantity + qty);
  } else {
    if (items.length >= MAX_ITEMS) return items;
    items.push({
      slug: input.slug,
      title: input.title,
      cover_image_url: input.cover_image_url ?? null,
      price_amount: input.price_amount ?? null,
      price_currency: input.price_currency ?? "COP",
      quantity: qty,
    });
  }
  writeRaw(items);
  return items;
}

export function removeFromCart(slug: string): CartItem[] {
  const items = readRaw().filter((it) => it.slug !== slug);
  writeRaw(items);
  return items;
}

export function setQuantity(slug: string, quantity: number): CartItem[] {
  const items = readRaw();
  const it = items.find((i) => i.slug === slug);
  if (!it) return items;
  const q = Math.max(0, Math.min(MAX_QTY, Math.floor(quantity)));
  if (q === 0) return removeFromCart(slug);
  it.quantity = q;
  writeRaw(items);
  return items;
}

export function clearCart(): CartItem[] {
  writeRaw([]);
  return [];
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  // Listen to "storage" for cross-tab updates, and our custom event
  // for same-tab updates. Keep the listener registry as the source of
  // truth — the window events are just triggers.
  if (typeof window !== "undefined" && listeners.size === 1) {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const items = safeParse(e.newValue);
        listeners.forEach((l) => l(items));
      }
    };
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent<CartItem[]>).detail;
      const items = Array.isArray(detail) ? detail : readRaw();
      listeners.forEach((l) => l(items));
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("cda:cart-change", onLocal);
    // Stash so we can rip them out on the last unsubscribe.
    (subscribe as any).__handlers = { onStorage, onLocal };
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      const h = (subscribe as any).__handlers;
      if (h) {
        window.removeEventListener("storage", h.onStorage);
        window.removeEventListener("cda:cart-change", h.onLocal);
        (subscribe as any).__handlers = null;
      }
    }
  };
}

/** Format a price in the project's locale ("$ 35.000" for COP). */
export function formatPrice(amount: number | null, currency = "COP"): string {
  if (amount == null) return "Consultar precio";
  if (currency === "COP") {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return new Intl.NumberFormat("es-CO", { style: "currency", currency }).format(amount);
}
