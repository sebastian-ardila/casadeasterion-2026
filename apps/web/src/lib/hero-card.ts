// Hero card rendering helpers. The CMS persists a JSONB blob shaped like
// HeroCardConfig in site_configuration; the public site reads it at build
// time, resolves the content based on content_source, and emits CSS that
// applies per-platform (desktop vs. mobile) styling.

import type { HeroCardConfig, HeroCardLayout } from "./site-config";

// Available fonts for the hero card's eyebrow / title / body / cta.
// Keep in sync with the CMS FONT_OPTIONS list (HeroCardPlatformControls)
// and the Google Fonts <link> in apps/web/src/layouts/Layout.astro. Any
// value not in this map falls back to Cormorant Garamond.
export const HERO_CARD_FONTS: Record<string, string> = {
  // --- Serifs (editorial) ---
  serif: '"Cormorant Garamond", Georgia, serif',
  "eb-garamond": '"EB Garamond", Georgia, serif',
  playfair: '"Playfair Display", Georgia, serif',
  lora: '"Lora", Georgia, serif',
  "libre-baskerville": '"Libre Baskerville", Georgia, serif',
  crimson: '"Crimson Pro", Georgia, serif',
  fraunces: '"Fraunces", Georgia, serif',
  spectral: '"Spectral", Georgia, serif',
  // --- Sans (modern) ---
  sans: '"Inter", system-ui, -apple-system, sans-serif',
  "dm-sans": '"DM Sans", "Inter", sans-serif',
  "space-grotesk": '"Space Grotesk", "Inter", sans-serif',
  manrope: '"Manrope", "Inter", sans-serif',
  "work-sans": '"Work Sans", "Inter", sans-serif',
  "plus-jakarta": '"Plus Jakarta Sans", "Inter", sans-serif',
  outfit: '"Outfit", "Inter", sans-serif',
  // --- Display ---
  marcellus: '"Marcellus", "Cormorant Garamond", serif',
};

export type ResolvedHeroContent = {
  eyebrow: string;
  title: string;
  body: string;
  cta_label: string;
  cta_href: string;
};

export function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace("#", "").trim();
  if (cleaned.length !== 3 && cleaned.length !== 6) {
    return `rgba(26,23,21,${alpha})`;
  }
  const full = cleaned.length === 3
    ? cleaned.split("").map((c) => c + c).join("")
    : cleaned;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return `rgba(26,23,21,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

function layoutRules(l: HeroCardLayout, platform: "desktop" | "mobile"): string {
  const bg = hexToRgba(l.bg_color, l.bg_alpha);
  const bgRule = l.bg_image_url
    ? `background: linear-gradient(${bg}, ${bg}), url('${l.bg_image_url}') center/cover no-repeat;`
    : `background: ${bg};`;
  const widthRule = l.width > 0
    ? `width: ${l.width}px; max-width: 100%;`
    : `width: auto;`;
  const radius =
    `${l.border_radius_tl}px ${l.border_radius_tr}px ${l.border_radius_br}px ${l.border_radius_bl}px`;
  const shadow = l.shadow
    ? `box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);`
    : `box-shadow: none;`;
  const blur = l.bg_blur > 0 ? `backdrop-filter: blur(${l.bg_blur}px);` : "";
  const titleFont   = HERO_CARD_FONTS[l.title_font]   ?? HERO_CARD_FONTS.serif;
  const eyebrowFont = HERO_CARD_FONTS[l.eyebrow_font] ?? HERO_CARD_FONTS.sans;
  const bodyFont    = HERO_CARD_FONTS[l.body_font]    ?? HERO_CARD_FONTS.sans;
  const ctaFont     = HERO_CARD_FONTS[l.cta_font]     ?? HERO_CARD_FONTS.sans;
  // On mobile we mirror offset_x to the right so the card stays
  // visually centered. On desktop the card intentionally extends past
  // the 50% divider so the right edge is flush.
  const marginRight = platform === "mobile" ? `${l.offset_x}px` : "0";
  return `
    ${bgRule}
    color: ${l.text_color};
    border-radius: ${radius};
    padding: ${l.padding}px;
    ${widthRule}
    min-height: ${l.height}px;
    margin-left: ${l.offset_x}px;
    margin-top: ${l.offset_y}px;
    margin-right: ${marginRight};
    margin-bottom: 0;
    ${blur}
    ${shadow}
    --hcc-title-font: ${titleFont};
    --hcc-eyebrow-font: ${eyebrowFont};
    --hcc-body-font: ${bodyFont};
    --hcc-cta-font: ${ctaFont};
  `.replace(/\n\s+/g, " ").trim();
}

// Cross-platform fallback: if only one of desktop/mobile has a
// bg_image_url set, the other side reuses it. The CMS UI nudges
// editors toward setting only one image when they don't care about
// per-platform variants.
function withSharedBgImage(cfg: HeroCardConfig): HeroCardConfig {
  const dImg = (cfg.desktop.bg_image_url || "").trim();
  const mImg = (cfg.mobile.bg_image_url || "").trim();
  const merged = dImg || mImg;
  return {
    ...cfg,
    desktop: { ...cfg.desktop, bg_image_url: dImg || merged },
    mobile: { ...cfg.mobile, bg_image_url: mImg || merged },
  };
}

export function buildHeroCardCss(cfg: HeroCardConfig): string {
  const merged = withSharedBgImage(cfg);
  return `
    .hero-card-cms { ${layoutRules(merged.desktop, "desktop")} }
    .hero-card-cms .hcc-title   { font-family: var(--hcc-title-font); }
    .hero-card-cms .hcc-eyebrow { font-family: var(--hcc-eyebrow-font); }
    .hero-card-cms .hcc-body    { font-family: var(--hcc-body-font); }
    .hero-card-cms .hcc-cta     { font-family: var(--hcc-cta-font); }
    @media (max-width: 767px) {
      .hero-card-cms { ${layoutRules(merged.mobile, "mobile")} }
    }
  `;
}

type ResolveCtx = {
  lead: {
    slug: string;
    title: string;
    excerpt: string | null;
    content_md?: string | null;
    category_id: string | null;
  } | null | undefined;
  featuredBook: {
    slug: string;
    title: string;
    subtitle: string | null;
    description_md?: string | null;
    author_id: string | null;
  } | null | undefined;
  authorMap: Map<string, { name: string }>;
  categoryMap: Map<string, { name: string }>;
  editorialDescription: string;
};

// Strip a small subset of markdown syntax to plain text and trim
// to a sensible body length so the hero card's line-clamp has
// real text to clamp instead of e.g. "*emphasis*" with raw stars.
// Truncates at the last word before `max` so we don't cut mid-word.
export function markdownToTeaser(md: string | null | undefined, max = 280): string {
  if (!md) return "";
  const stripped = md
    .replace(/`{3}[\s\S]*?`{3}/g, " ")          // fenced code blocks
    .replace(/`([^`]+)`/g, "$1")                  // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")         // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")      // links → keep label
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")           // ATX headings
    .replace(/^\s{0,3}>\s?/gm, "")                // blockquotes
    .replace(/^\s*[-*+]\s+/gm, "")                // unordered lists
    .replace(/^\s*\d+\.\s+/gm, "")                // ordered lists
    .replace(/(\*\*|__)(.*?)\1/g, "$2")           // bold
    .replace(/(\*|_)(.*?)\1/g, "$2")              // italic
    .replace(/~~(.*?)~~/g, "$1")                  // strike
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= max) return stripped;
  const cut = stripped.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

export function resolveHeroContent(
  cfg: HeroCardConfig,
  ctx: ResolveCtx,
): ResolvedHeroContent {
  if (cfg.content_source === "latest_post" && ctx.lead) {
    // Body falls back from authored excerpt → stripped content_md
    // teaser → empty. Keeps short editor-written excerpts on top
    // when present, otherwise gives the reader real prose.
    const body =
      (ctx.lead.excerpt ?? "").trim() ||
      markdownToTeaser(ctx.lead.content_md);
    return {
      eyebrow: ctx.categoryMap.get(ctx.lead.category_id ?? "")?.name ?? "Editorial",
      title: ctx.lead.title,
      body,
      cta_label: "Leer artículo",
      cta_href: `/articulos/${ctx.lead.slug}`,
    };
  }
  if (cfg.content_source === "latest_book" && ctx.featuredBook) {
    const a = ctx.authorMap.get(ctx.featuredBook.author_id ?? "");
    const body =
      (ctx.featuredBook.subtitle ?? "").trim() ||
      markdownToTeaser(ctx.featuredBook.description_md);
    return {
      eyebrow: a?.name ?? "Catálogo",
      title: ctx.featuredBook.title,
      body,
      cta_label: "Ver libro",
      cta_href: `/catalogo/${ctx.featuredBook.slug}`,
    };
  }
  if (cfg.content_source === "manual") {
    return {
      eyebrow: cfg.manual.eyebrow,
      title: cfg.manual.title,
      body: cfg.manual.body,
      cta_label: cfg.manual.cta_label,
      cta_href: cfg.manual.cta_href || "/",
    };
  }
  // Editorial fallback. Editors can override the CTA's text and
  // destination via cfg.manual.cta_label / cta_href even when
  // they're using the editorial source — the CMS exposes these
  // fields in editorial mode for this exact reason.
  const ctaLabel = (cfg.manual?.cta_label ?? "").trim() || "Explorar el catálogo";
  const ctaHref = (cfg.manual?.cta_href ?? "").trim() || "/catalogo";
  return {
    eyebrow: "Editorial",
    title: "Casa de Asterión Ediciones",
    body: ctx.editorialDescription,
    cta_label: ctaLabel,
    cta_href: ctaHref,
  };
}

export function mergeHeroCardConfig(
  raw: unknown,
  defaults: HeroCardConfig,
): HeroCardConfig {
  if (!raw || typeof raw !== "object") return defaults;
  const r = raw as Partial<HeroCardConfig>;
  return {
    content_source: r.content_source ?? defaults.content_source,
    manual: { ...defaults.manual, ...(r.manual ?? {}) },
    desktop: { ...defaults.desktop, ...(r.desktop ?? {}) },
    mobile: { ...defaults.mobile, ...(r.mobile ?? {}) },
  };
}
