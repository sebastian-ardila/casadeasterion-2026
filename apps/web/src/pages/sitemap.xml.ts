import type { APIRoute } from "astro";
import { supabase } from "~/lib/supabase";
import { loadSiteConfig } from "~/lib/site-config";

const STATIC_PATHS_BASE = [
  { path: "/", priority: 1.0, changefreq: "daily" },
  { path: "/articulos", priority: 0.8, changefreq: "daily" },
  { path: "/catalogo", priority: 0.9, changefreq: "weekly" },
  { path: "/colecciones", priority: 0.7, changefreq: "weekly" },
  { path: "/autores", priority: 0.7, changefreq: "weekly" },
  { path: "/colaboradores", priority: 0.6, changefreq: "weekly" },
  { path: "/traductores", priority: 0.6, changefreq: "weekly" },
  { path: "/prologuistas", priority: 0.6, changefreq: "weekly" },
];
const NOSOTROS_PATH = { path: "/nosotros", priority: 0.6, changefreq: "monthly" };

const escapeXml = (str: string) =>
  str.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;"
      : c === ">" ? "&gt;"
      : c === "&" ? "&amp;"
      : c === "'" ? "&apos;"
      : "&quot;",
  );

export const GET: APIRoute = async ({ site }) => {
  if (!site) {
    return new Response("Site URL not configured.", { status: 500 });
  }

  const cfg = await loadSiteConfig();
  const nosotrosEnabled = cfg.nosotros_enabled !== false;

  const [
    postsRes, booksRes,
    authorsRes, collaboratorsRes, translatorsRes, prologuistsRes,
    staffRes, collectionsRes,
  ] = await Promise.all([
    supabase.from("posts").select("slug, updated_at, published_at").eq("status", "published"),
    supabase.from("books").select("slug, updated_at, publication_date").eq("status", "published"),
    // 4 vistas filtradas de la misma tabla `authors`, una por rol.
    // El mismo slug puede aparecer en varias URLs (autor + traductor,
    // etc.) cuando la persona cumple varios roles — es deseado: cada
    // ficha pública es una vista distinta.
    supabase.from("authors").select("slug, updated_at").contains("role_tags", ["author"]),
    supabase.from("authors").select("slug, updated_at").contains("role_tags", ["collaborator"]),
    supabase.from("authors").select("slug, updated_at").contains("role_tags", ["translator"]),
    supabase.from("authors").select("slug, updated_at").contains("role_tags", ["prologuist"]),
    nosotrosEnabled
      ? supabase.from("staff").select("slug, updated_at").eq("status", "published")
      : Promise.resolve({ data: [] as Array<{ slug: string; updated_at: string | null }> }),
    (supabase.from as any)("collections").select("slug, updated_at").eq("status", "published"),
  ]);

  type Entry = { url: string; lastmod?: string; priority: number; changefreq: string };
  const entries: Entry[] = [];

  const staticPaths = nosotrosEnabled ? [...STATIC_PATHS_BASE, NOSOTROS_PATH] : STATIC_PATHS_BASE;
  for (const p of staticPaths) {
    entries.push({
      url: new URL(p.path, site).href,
      priority: p.priority,
      changefreq: p.changefreq,
    });
  }

  for (const post of postsRes.data ?? []) {
    entries.push({
      url: new URL(`/articulos/${post.slug}`, site).href,
      lastmod: post.updated_at ?? post.published_at ?? undefined,
      priority: 0.7,
      changefreq: "monthly",
    });
  }

  for (const book of booksRes.data ?? []) {
    entries.push({
      url: new URL(`/catalogo/${book.slug}`, site).href,
      lastmod: book.updated_at ?? book.publication_date ?? undefined,
      priority: 0.8,
      changefreq: "monthly",
    });
  }

  for (const author of authorsRes.data ?? []) {
    entries.push({
      url: new URL(`/autores/${author.slug}`, site).href,
      lastmod: author.updated_at ?? undefined,
      priority: 0.5,
      changefreq: "monthly",
    });
  }

  for (const s of staffRes.data ?? []) {
    entries.push({
      url: new URL(`/nosotros/${s.slug}`, site).href,
      lastmod: s.updated_at ?? undefined,
      priority: 0.4,
      changefreq: "monthly",
    });
  }

  for (const col of (collectionsRes.data ?? []) as Array<{ slug: string; updated_at: string | null }>) {
    entries.push({
      url: new URL(`/colecciones/${col.slug}`, site).href,
      lastmod: col.updated_at ?? undefined,
      priority: 0.6,
      changefreq: "monthly",
    });
  }

  for (const c of collaboratorsRes.data ?? []) {
    entries.push({
      url: new URL(`/colaboradores/${c.slug}`, site).href,
      lastmod: c.updated_at ?? undefined,
      priority: 0.4,
      changefreq: "monthly",
    });
  }

  for (const t of translatorsRes.data ?? []) {
    entries.push({
      url: new URL(`/traductores/${t.slug}`, site).href,
      lastmod: t.updated_at ?? undefined,
      priority: 0.4,
      changefreq: "monthly",
    });
  }

  for (const p of prologuistsRes.data ?? []) {
    entries.push({
      url: new URL(`/prologuistas/${p.slug}`, site).href,
      lastmod: p.updated_at ?? undefined,
      priority: 0.4,
      changefreq: "monthly",
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) => `  <url>
    <loc>${escapeXml(e.url)}</loc>${e.lastmod ? `
    <lastmod>${escapeXml(new Date(e.lastmod).toISOString())}</lastmod>` : ""}
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority.toFixed(1)}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
};
