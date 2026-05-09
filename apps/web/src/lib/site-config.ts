import { supabase } from "./supabase";

export type ContentSource = "editorial" | "manual" | "latest_post" | "latest_book";

export type HeroCardLayout = {
  bg_color: string;
  bg_alpha: number;
  bg_image_url: string;
  bg_blur: number;
  text_color: string;
  title_font: string;
  eyebrow_font: string;
  body_font: string;
  cta_font: string;
  border_radius_tl: number;
  border_radius_tr: number;
  border_radius_br: number;
  border_radius_bl: number;
  width: number;
  height: number;
  padding: number;
  offset_x: number;
  offset_y: number;
  shadow: boolean;
};

export type HeroCardConfig = {
  content_source: ContentSource;
  manual: {
    eyebrow: string;
    title: string;
    body: string;
    cta_label: string;
    cta_href: string;
  };
  desktop: HeroCardLayout;
  mobile: HeroCardLayout;
};

export type ContactEmail = { email: string; label?: string };
export type ContactPhone = { phone: string; label?: string; whatsapp?: boolean };
export type ContactAddress = { address: string; label?: string };
export type SocialAccount = { platform: string; url: string; label?: string };

export type SiteConfigMap = {
  hero_quote: string;
  hero_quote_author: string;
  editorial_description: string;
  footer_legal: string;
  social_links: { facebook: string; instagram: string; twitter: string };
  /** Extra social profiles beyond the three primary ones above. */
  social_accounts: SocialAccount[];
  whatsapp_phone: string;
  whatsapp_message_template: string;
  /** Primary contact email — kept for backward compat. The contact page
   *  joins this with `contact_emails_extra` to render the full list. */
  contact_email: string;
  contact_emails_extra: ContactEmail[];
  contact_address: string;
  contact_addresses_extra: ContactAddress[];
  /** Phones beyond the commerce WhatsApp number. */
  contact_phones: ContactPhone[];
  contact_hours: string;
  robots_block_ai: string[];
  /** Master switch for the newsletter subscription form + links. */
  subscribe_enabled: boolean;
  default_keywords: string[];
  twitter_handle: string;
  og_image_default: string;
  organization_logo_url: string;
  hero_image_url: string;
  /** Page background visible behind the hero card (the area around the
   *  card and the right-half image). Empty means "use --bg-alt". */
  hero_bg_color: string;
  hero_card_config: HeroCardConfig;
  [key: string]: unknown;
};

export const DEFAULT_HERO_CARD_CONFIG: HeroCardConfig = {
  content_source: "editorial",
  manual: {
    eyebrow: "Editorial",
    title: "Casa de Asterión Ediciones",
    body: "",
    cta_label: "Explorar el catálogo",
    cta_href: "/catalogo",
  },
  desktop: {
    bg_color: "#1a1715",
    bg_alpha: 1,
    bg_image_url: "",
    bg_blur: 0,
    text_color: "#f5f1ea",
    title_font: "serif",
    eyebrow_font: "sans",
    body_font: "sans",
    cta_font: "sans",
    border_radius_tl: 0,
    border_radius_tr: 0,
    border_radius_br: 0,
    border_radius_bl: 0,
    width: 760,
    height: 520,
    padding: 56,
    offset_x: 96,
    offset_y: 0,
    shadow: true,
  },
  mobile: {
    bg_color: "#1a1715",
    bg_alpha: 1,
    bg_image_url: "",
    bg_blur: 0,
    text_color: "#f5f1ea",
    title_font: "serif",
    eyebrow_font: "sans",
    body_font: "sans",
    cta_font: "sans",
    border_radius_tl: 0,
    border_radius_tr: 0,
    border_radius_br: 0,
    border_radius_bl: 0,
    width: 0,
    height: 280,
    padding: 24,
    offset_x: 16,
    offset_y: 32,
    shadow: true,
  },
};

const DEFAULTS: SiteConfigMap = {
  hero_quote:
    '"La belleza está en los espacios vacíos, en lo que no se dice, en lo que apenas se sugiere."',
  hero_quote_author: "Isabel Allende",
  editorial_description:
    "Editorial independiente dedicada a publicar obras que desafían, inspiran y transforman.",
  footer_legal: "© Casa de Asterión. Todos los derechos reservados.",
  social_links: { facebook: "", instagram: "", twitter: "" },
  whatsapp_phone: "+573117462759",
  whatsapp_message_template:
    'Hola, me interesa el libro "{{title}}" de {{author}}. ¿Está disponible?',
  contact_email: "",
  contact_emails_extra: [],
  contact_address: "",
  contact_addresses_extra: [],
  contact_phones: [],
  contact_hours: "",
  social_accounts: [],
  robots_block_ai: [],
  subscribe_enabled: true,
  default_keywords: [],
  twitter_handle: "",
  og_image_default: "",
  organization_logo_url: "",
  hero_image_url: "",
  hero_bg_color: "",
  hero_card_config: DEFAULT_HERO_CARD_CONFIG,
};

let cache: SiteConfigMap | null = null;

export async function loadSiteConfig(): Promise<SiteConfigMap> {
  if (cache) return cache;

  const { data, error } = await supabase
    .from("site_configuration")
    .select("key,value");

  if (error) {
    console.warn("[site-config] could not load from Supabase:", error.message);
    return DEFAULTS;
  }

  const out: Record<string, unknown> = { ...DEFAULTS };
  for (const row of data ?? []) {
    out[row.key] = row.value;
  }
  cache = out as SiteConfigMap;
  return cache;
}

export function buildWhatsappUrl(
  phone: string,
  template: string,
  vars: Record<string, string>,
): string {
  const text = template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
  const cleanPhone = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}
