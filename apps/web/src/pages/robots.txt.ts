import type { APIRoute } from "astro";
import { loadSiteConfig } from "~/lib/site-config";

export const GET: APIRoute = async ({ site }) => {
  const config = await loadSiteConfig();
  const blocked = config.robots_block_ai ?? [];

  const lines: string[] = [];
  for (const ua of blocked) {
    lines.push(`User-agent: ${ua}`);
    lines.push("Disallow: /");
    lines.push("");
  }
  lines.push("User-agent: *");
  lines.push("Allow: /");
  if (site) {
    lines.push("");
    lines.push(`Sitemap: ${site}sitemap.xml`);
  }

  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
