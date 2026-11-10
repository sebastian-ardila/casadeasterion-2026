// Configuración por dispositivo de la imagen del hero de la home.
//
// Se guarda en site_configuration.hero_image_config (JSONB). La imagen
// principal (Web) sigue viviendo en hero_image_url para no romper
// filas antiguas; Tablet y Móvil la heredan salvo que tengan su propia
// imagen (`inherit_image: false` + `image_url`).
//
// El CMS (repo hermano) tiene una copia de esta normalización en
// src/lib/hero-image.ts — mantener ambas en sync.

export type HeroImageFit = "cover" | "contain" | "fill" | "none";
export type HeroImageDevice = "web" | "tablet" | "mobile";
export type HeroMobileRatio = "1/1" | "4/5" | "4/3" | "16/9";

export interface HeroImageDeviceConfig {
  /** Solo Tablet/Móvil: true = usa la imagen de Web. */
  inherit_image: boolean;
  /** Solo Tablet/Móvil: imagen propia cuando inherit_image = false. */
  image_url: string;
  fit: HeroImageFit;
  /** Posición del foco, 0–100 (%). */
  x: number;
  y: number;
  /** Escala de la imagen dentro de su espacio, 50–300 (%). */
  zoom: number;
  /** Solo Móvil: proporción del espacio de la foto. */
  ratio: HeroMobileRatio;
}

export type HeroImageConfig = Record<HeroImageDevice, HeroImageDeviceConfig>;

const FITS: readonly HeroImageFit[] = ["cover", "contain", "fill", "none"];
const RATIOS: readonly HeroMobileRatio[] = ["1/1", "4/5", "4/3", "16/9"];

export const DEFAULT_HERO_IMAGE_DEVICE: HeroImageDeviceConfig = {
  inherit_image: true,
  image_url: "",
  fit: "cover",
  x: 50,
  y: 50,
  zoom: 100,
  ratio: "4/3",
};

const clamp = (v: unknown, min: number, max: number, dflt: number) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, Math.round(n)));
};

function normalizeDevice(raw: unknown): HeroImageDeviceConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_HERO_IMAGE_DEVICE;
  return {
    inherit_image: r.inherit_image === false ? false : true,
    image_url: typeof r.image_url === "string" ? r.image_url.trim() : "",
    fit: FITS.includes(r.fit as HeroImageFit) ? (r.fit as HeroImageFit) : d.fit,
    x: clamp(r.x, 0, 100, d.x),
    y: clamp(r.y, 0, 100, d.y),
    zoom: clamp(r.zoom, 50, 300, d.zoom),
    ratio: RATIOS.includes(r.ratio as HeroMobileRatio) ? (r.ratio as HeroMobileRatio) : d.ratio,
  };
}

export function normalizeHeroImageConfig(raw: unknown): HeroImageConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    web: { ...normalizeDevice(r.web), inherit_image: false, image_url: "" },
    tablet: normalizeDevice(r.tablet),
    mobile: normalizeDevice(r.mobile),
  };
}

/** URL efectiva de un dispositivo, con herencia desde Web. */
export function resolveHeroImageUrl(
  cfg: HeroImageConfig,
  device: HeroImageDevice,
  webUrl: string,
): string {
  const c = cfg[device];
  if (device !== "web" && !c.inherit_image && c.image_url) return c.image_url;
  return webUrl;
}

/** Estilos inline para el <img> dentro de su contenedor (overflow hidden). */
export function heroImageStyle(c: HeroImageDeviceConfig): string {
  const parts = [
    `object-fit: ${c.fit}`,
    `object-position: ${c.x}% ${c.y}%`,
  ];
  if (c.zoom !== 100) {
    parts.push(`transform: scale(${c.zoom / 100})`, `transform-origin: ${c.x}% ${c.y}%`);
  }
  return parts.join("; ");
}
