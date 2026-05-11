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

/** Strip markdown formatting and collapse whitespace. Useful for
 *  building meta-description snippets where raw markdown like
 *  "**bold**" or "[text](url)" would look broken to a search engine. */
export function mdToPlainText(md: string | null | undefined): string {
  if (!md) return "";
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Truncate at a sensible word boundary close to the target length.
 *  Adds an ellipsis when truncation happens. */
export function clampText(text: string, max: number): string {
  if (!text) return "";
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.6 ? lastSpace : max;
  return text.slice(0, cut).replace(/[\s,;.:—–-]+$/, "") + "…";
}

export function estimateReadingTime(md: string | null | undefined): number {
  if (!md) return 1;
  const words = md.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}
