// Curated list of lucide icons offered when creating/editing a
// category. Names are stored in the DB without the "lucide:" prefix
// (e.g. "feather", "scroll-text") because that's what the iconify
// JSON keys use. The "lucide:" prefix is only added at render time
// when calling the <Icon> component from astro-icon.

// @ts-expect-error — JSON import resolved by Astro/Vite at build time.
import lucideIcons from "@iconify-json/lucide/icons.json";

export const CATEGORY_ICONS: string[] = [
  // Books & reading
  "book", "book-open", "book-marked", "book-text", "book-headphones",
  "book-plus", "book-down", "book-up", "book-key", "book-lock",
  "book-image", "book-x", "book-check", "book-copy", "book-heart",
  "library", "library-big", "library-square", "bookmark",
  "bookmark-plus", "bookmark-check", "bookmark-minus", "bookmark-x",

  // Writing & pens
  "feather", "pen", "pen-line", "pen-tool", "pencil", "pencil-line",
  "pencil-ruler", "edit", "edit-2", "edit-3", "type", "signature",
  "ruler", "square-pen", "highlighter", "eraser",

  // Documents
  "file", "file-text", "file-pen", "file-image", "file-heart",
  "file-check", "file-x", "file-plus", "file-stack", "file-question",
  "file-search", "file-symlink", "file-lock", "file-code", "files",
  "folder", "folder-open", "folder-closed", "folder-tree",
  "folder-plus", "folder-archive", "folder-heart", "folder-cog",
  "scroll", "scroll-text", "newspaper", "notepad-text", "notepad-text-dashed",
  "sticky-note", "clipboard", "clipboard-list", "clipboard-check",
  "clipboard-pen", "clipboard-type",

  // Communication & messaging
  "mail", "mail-open", "mail-plus", "mail-check", "mail-warning",
  "send", "send-horizontal", "inbox", "message-circle",
  "message-square", "message-square-quote", "message-square-text",
  "message-square-heart", "message-circle-question", "messages-square",
  "quote", "megaphone", "megaphone-off", "speech", "phone", "phone-call",
  "voicemail", "rss",

  // Knowledge / thought
  "brain", "brain-circuit", "lightbulb", "lightbulb-off", "sparkles",
  "eye", "eye-off", "glasses", "graduation-cap", "school", "atom",
  "microscope", "telescope", "compass", "infinity", "puzzle", "key-round",

  // Math & symbols
  "hash", "asterisk", "percent", "plus", "minus", "equal",
  "divide", "slash", "ampersand", "at-sign", "sigma", "pi",
  "function-square", "braces", "brackets", "parentheses",

  // Music & sound
  "music", "music-2", "music-3", "music-4", "mic", "mic-2",
  "headphones", "audio-lines", "audio-waveform", "drum", "guitar",
  "piano", "radio", "speaker", "volume-2", "disc-3",

  // Nature, sky & seasons
  "leaf", "leafy-green", "flower", "flower-2", "sun", "sun-medium",
  "sun-dim", "moon", "moon-star", "sunrise", "sunset", "sun-moon",
  "star", "stars", "sparkle", "mountain", "mountain-snow",
  "tree-pine", "tree-deciduous", "tree-palm", "sprout", "shovel",
  "cherry", "apple", "grape", "citrus", "wheat", "sun-snow",

  // Weather
  "cloud", "cloud-rain", "cloud-snow", "cloud-sun", "cloud-moon",
  "cloud-drizzle", "cloud-lightning", "cloud-hail", "cloudy",
  "rainbow", "snowflake", "droplets", "droplet", "wind", "tornado",
  "umbrella",

  // Time
  "clock", "hourglass", "history", "calendar", "calendar-days",
  "calendar-clock", "calendar-check", "alarm-clock", "timer", "watch",

  // Tags & structure
  "tag", "tags", "list", "list-ordered", "list-checks", "list-tree",
  "layers", "boxes", "package", "package-2", "archive",

  // Geography & travel
  "globe", "globe-2", "globe-lock", "map", "map-pin", "map-pinned",
  "navigation", "navigation-2", "route", "locate", "locate-fixed",
  "ship", "plane", "train", "bus", "car", "bike", "footprints",

  // Buildings / places
  "home", "building", "building-2", "church", "warehouse", "hospital",
  "hotel", "store", "factory", "mailbox", "tent",

  // Art, photo & video
  "palette", "paintbrush", "paintbrush-2", "paint-bucket",
  "paint-roller", "brush", "image", "images", "image-up", "image-plus",
  "image-down", "image-off", "video", "video-off", "film",
  "clapperboard", "camera", "camera-off", "frame", "aperture", "scan",

  // Crafts & tools
  "scissors", "hammer", "screwdriver", "wrench", "axe",

  // Devices & computing
  "laptop", "monitor", "smartphone", "tablet", "keyboard",
  "mouse-pointer", "mouse", "printer", "tv", "code", "code-2",
  "code-xml", "terminal", "terminal-square", "cpu", "server",
  "database", "hard-drive", "wifi", "bluetooth",

  // People & hands
  "user", "users", "users-round", "user-plus", "user-check", "user-x",
  "baby", "person-standing", "contact", "contact-round",
  "heart-handshake", "hand", "hand-heart", "hand-helping", "handshake",
  "thumbs-up", "thumbs-down",

  // Hearts & spirit
  "heart", "heart-pulse", "heart-off", "heart-crack",

  // Decorative & honors
  "gem", "diamond", "crown", "award", "trophy", "medal", "ribbon",
  "rosette",

  // Locks & shields
  "anchor", "key", "lock", "lock-open", "lock-keyhole", "unlock",
  "shield", "shield-check", "shield-alert", "shield-x", "shield-off",

  // Symbols & cosmos
  "scale", "scale-3d", "dna", "target", "rocket", "satellite",
  "orbit", "moon-star",

  // Energy / flora
  "flame", "zap", "candle", "lamp", "lamp-desk", "lamp-floor",

  // Food / drink (mild)
  "coffee", "glass-water", "wine", "croissant", "ice-cream", "donut",
  "popcorn", "cookie",

  // Misc useful
  "shapes", "circle", "square", "triangle", "octagon", "hexagon",
  "bell", "bell-ring", "bell-off", "umbrella", "sun-snow", "snowflake",
];

// The iconify icons.json bundle exposes width/height of the source
// grid plus a `body` field per icon — the inner SVG content with
// `<path>` / `<circle>` / etc. Lucide ships every icon on a 24×24
// canvas. We wrap that body in an <svg> with the lucide stroke
// defaults so it renders the same as `<Icon name="lucide:..."/>`.
type IconBody = { body: string };
type IconBundle = { width?: number; height?: number; icons: Record<string, IconBody> };
const bundle = lucideIcons as unknown as IconBundle;
const W = bundle.width ?? 24;
const H = bundle.height ?? 24;

// Deduplicate AND drop any name that isn't actually present in the
// installed lucide bundle. Lucide adds/removes icons across releases,
// so we can't trust a hand-curated list of ~250 names to always be
// 100% valid. Silently filtering missing entries here prevents the
// astro-icon build/runtime error "Unable to locate ..." from killing
// the page when a stale name slipped in.
{
  const seen = new Set<string>();
  const filtered: string[] = [];
  for (const n of CATEGORY_ICONS) {
    if (seen.has(n)) continue;
    if (!bundle.icons[n]) continue;
    seen.add(n);
    filtered.push(n);
  }
  CATEGORY_ICONS.length = 0;
  CATEGORY_ICONS.push(...filtered);
}

export const CATEGORY_ICON_SET: Set<string> = new Set(CATEGORY_ICONS);

const xmlAttr = (v: string) =>
  String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** Resolve "lucide:foo" or "foo" → SVG string, or null if missing.
 *  Useful for places that need to inject an icon into HTML built
 *  client-side (the CMS list panel for categories, /api/list, etc.). */
export function lucideSvg(
  name: string | null | undefined,
  opts: { size?: number; class?: string } = {},
): string | null {
  if (!name) return null;
  const key = name.replace(/^lucide:/, "");
  const icon = bundle.icons[key];
  if (!icon) return null;
  const sz = opts.size ?? 16;
  const cls = opts.class ? ` class="${xmlAttr(opts.class)}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 ${W} ${H}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${cls}>${icon.body}</svg>`;
}

/** Prefix-aware variant: returns the name with the "lucide:" prefix
 *  added if missing. Used when handing the value to <Icon>. */
export function asLucideName(name: string | null | undefined): string | null {
  if (!name) return null;
  return name.startsWith("lucide:") ? name : `lucide:${name}`;
}
