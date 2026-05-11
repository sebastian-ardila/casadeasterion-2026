import type { Author } from "~/lib/supabase";
import { supabase } from "~/lib/supabase";

// Helpers around the book_authors / post_authors junction tables.
//
// The junction is the canonical source of truth for "who wrote this".
// books.author_id and posts.author_id are denormalized pointers to the
// author at sort_order = 0, kept in sync by a Postgres trigger, so most
// listing queries can keep using author_id. These helpers exist for
// detail pages (which must render every author) and for the authors
// listing page (which must surface books/posts where the author is in
// the junction at any position, not just primary).

export interface BookAuthorRow {
  sort_order: number;
  author: Author | null;
}

export interface PostAuthorRow {
  sort_order: number;
  author: Author | null;
}

export function sortJunctionAuthors<T extends { sort_order: number }>(
  rows: T[] | null | undefined,
): T[] {
  return [...(rows ?? [])].sort((a, b) => a.sort_order - b.sort_order);
}

export function extractAuthors(
  rows: { sort_order: number; author: Author | null }[] | null | undefined,
): Author[] {
  return sortJunctionAuthors(rows).map((r) => r.author).filter(Boolean) as Author[];
}

// Format a list of author names with serial-comma semantics in Spanish
// ("Ana", "Ana y Beto", "Ana, Beto y Carlos"). Used by cards and the
// detail-page author row.
export function joinAuthorNames(names: string[]): string {
  const clean = names.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} y ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} y ${clean[clean.length - 1]}`;
}

// Fetch full author rows for every book in `bookIds`, returned as a map
// from book_id to ordered Author[]. Used by listing pages that want to
// show all authors per row without N+1 queries.
export async function fetchAuthorsForBooks(
  bookIds: string[],
): Promise<Map<string, Author[]>> {
  if (bookIds.length === 0) return new Map();
  const { data } = await supabase
    .from("book_authors")
    .select("book_id, sort_order, author:authors(*)")
    .in("book_id", bookIds);
  const map = new Map<string, { sort_order: number; author: Author | null }[]>();
  for (const row of (data ?? []) as unknown as {
    book_id: string;
    sort_order: number;
    author: Author | null;
  }[]) {
    const existing = map.get(row.book_id) ?? [];
    existing.push({ sort_order: row.sort_order, author: row.author });
    map.set(row.book_id, existing);
  }
  const result = new Map<string, Author[]>();
  for (const [bookId, rows] of map.entries()) {
    result.set(bookId, extractAuthors(rows));
  }
  return result;
}

export async function fetchAuthorsForPosts(
  postIds: string[],
): Promise<Map<string, Author[]>> {
  if (postIds.length === 0) return new Map();
  const { data } = await supabase
    .from("post_authors")
    .select("post_id, sort_order, author:authors(*)")
    .in("post_id", postIds);
  const map = new Map<string, { sort_order: number; author: Author | null }[]>();
  for (const row of (data ?? []) as unknown as {
    post_id: string;
    sort_order: number;
    author: Author | null;
  }[]) {
    const existing = map.get(row.post_id) ?? [];
    existing.push({ sort_order: row.sort_order, author: row.author });
    map.set(row.post_id, existing);
  }
  const result = new Map<string, Author[]>();
  for (const [postId, rows] of map.entries()) {
    result.set(postId, extractAuthors(rows));
  }
  return result;
}
