import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: false,
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
