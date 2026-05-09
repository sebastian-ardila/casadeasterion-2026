// Hero card rendering helpers. The CMS persists a JSONB blob shaped like
// HeroCardConfig in site_configuration; the public site reads it at build
// time, resolves the content based on content_source, and emits CSS that
// applies per-platform (desktop vs. mobile) styling.

import type { HeroCardConfig, HeroCardLayout } from "./site-config";

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
  const titleFont = l.title_font === "serif"
    ? "var(--font-serif)"
    : "var(--font-sans)";
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
  `.replace(/\n\s+/g, " ").trim();
}

export function buildHeroCardCss(cfg: HeroCardConfig): string {
  return `
    .hero-card-cms { ${layoutRules(cfg.desktop, "desktop")} }
    .hero-card-cms .hcc-title { font-family: var(--hcc-title-font); }
    @media (max-width: 767px) {
      .hero-card-cms { ${layoutRules(cfg.mobile, "mobile")} }
    }
  `;
}

type ResolveCtx = {
  lead: { slug: string; title: string; excerpt: string | null; category_id: string | null } | null | undefined;
  featuredBook: { slug: string; title: string; subtitle: string | null; author_id: string | null } | null | undefined;
  authorMap: Map<string, { name: string }>;
  categoryMap: Map<string, { name: string }>;
  editorialDescription: string;
};

export function resolveHeroContent(
  cfg: HeroCardConfig,
  ctx: ResolveCtx,
): ResolvedHeroContent {
  if (cfg.content_source === "latest_post" && ctx.lead) {
    return {
      eyebrow: ctx.categoryMap.get(ctx.lead.category_id ?? "")?.name ?? "Editorial",
      title: ctx.lead.title,
      body: ctx.lead.excerpt ?? "",
      cta_label: "Leer artículo",
      cta_href: `/articulos/${ctx.lead.slug}`,
    };
  }
  if (cfg.content_source === "latest_book" && ctx.featuredBook) {
    const a = ctx.authorMap.get(ctx.featuredBook.author_id ?? "");
    return {
      eyebrow: a?.name ?? "Catálogo",
      title: ctx.featuredBook.title,
      body: ctx.featuredBook.subtitle ?? "",
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
  return {
    eyebrow: "Editorial",
    title: "Casa de Asterión Ediciones",
    body: ctx.editorialDescription,
    cta_label: "Explorar el catálogo",
    cta_href: "/catalogo",
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
