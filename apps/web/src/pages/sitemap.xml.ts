import type { APIRoute } from "astro";
import { supabase } from "~/lib/supabase";

const STATIC_PATHS = [
  { path: "/", priority: 1.0, changefreq: "daily" },
  { path: "/articulos", priority: 0.8, changefreq: "daily" },
  { path: "/catalogo", priority: 0.9, changefreq: "weekly" },
  { path: "/autores", priority: 0.7, changefreq: "weekly" },
  { path: "/poesia", priority: 0.7, changefreq: "weekly" },
  { path: "/filosofia", priority: 0.7, changefreq: "weekly" },
];

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

  const [postsRes, booksRes, authorsRes] = await Promise.all([
    supabase.from("posts").select("slug, updated_at, published_at").eq("status", "published"),
    supabase.from("books").select("slug, updated_at, publication_date").eq("status", "published"),
    supabase.from("authors").select("slug, updated_at"),
  ]);

  type Entry = { url: string; lastmod?: string; priority: number; changefreq: string };
  const entries: Entry[] = [];

  for (const p of STATIC_PATHS) {
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
