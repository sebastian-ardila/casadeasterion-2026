import { supabase } from "./supabase";

export type SiteConfigMap = {
  hero_quote: string;
  hero_quote_author: string;
  editorial_description: string;
  footer_legal: string;
  social_links: { facebook: string; instagram: string; twitter: string };
  whatsapp_phone: string;
  whatsapp_message_template: string;
  robots_block_ai: string[];
  /** Master switch for the newsletter subscription form + links. */
  subscribe_enabled: boolean;
  [key: string]: unknown;
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
  robots_block_ai: [],
  subscribe_enabled: true,
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
