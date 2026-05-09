import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: false,
});

// Open external links in a new tab. Internal links (relative paths or
// fragments) keep the default same-tab behaviour so internal nav stays smooth.
marked.use({
  renderer: {
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const isExternal = /^(https?:|mailto:|tel:)/i.test(href ?? "");
      const titleAttr = title ? ` title="${title.replace(/"/g, "&quot;")}"` : "";
      const target = isExternal ? ` target="_blank" rel="noopener noreferrer"` : "";
      return `<a href="${href}"${titleAttr}${target}>${text}</a>`;
    },
  },
});

export function renderMarkdown(md: string | null | undefined): string {
  if (!md) return "";
  return marked.parse(md, { async: false }) as string;
}

export function estimateReadingTime(md: string | null | undefined): number {
  if (!md) return 1;
  const words = md.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}
