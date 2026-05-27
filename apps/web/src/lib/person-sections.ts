import type { SupabaseClient } from "@supabase/supabase-js";
import type { Author, Book, Post, Category } from "~/lib/supabase";

// Secciones del detalle de una persona (autor / traductor / prologuista
// / colaborador). Se cargan los 4 roles aunque la persona no figure en
// alguno: si no hay rows, el grupo se filtra antes de devolverse.
//
// El "rol primario" determina el orden:
//   - Desde /autores       → primary="author"      → Obras primero.
//   - Desde /traductores   → primary="translator"  → Traducciones primero.
//   - Desde /prologuistas  → primary="prologuist"  → Prólogos primero.
//   - Desde /colaboradores → primary="collaborator"→ Colaboraciones primero.
// Los otros 3 roles aparecen después en el orden canónico (author →
// translator → prologuist → collaborator), saltando el primary que
// ya se mostró.

export type PersonRole = "author" | "translator" | "prologuist" | "collaborator";

const BOOK_TITLES: Record<PersonRole, string> = {
  author:       "Obras",
  translator:   "Libros que ha traducido",
  prologuist:   "Libros con su prólogo",
  collaborator: "Libros donde colabora",
};
const POST_TITLES: Record<PersonRole, string> = {
  author:       "Publicaciones",
  translator:   "Publicaciones que ha traducido",
  prologuist:   "Publicaciones con su prólogo",
  collaborator: "Publicaciones donde colabora",
};

export interface PersonSection {
  role: PersonRole;
  /** Título a mostrar para los libros de esta sección (singular/plural fijo). */
  booksTitle: string;
  /** Título a mostrar para las publicaciones de esta sección. */
  postsTitle: string;
  books: Book[];
  /** Post + autor primario para PostCard. */
  posts: (Post & { _firstAuthor: Author | null })[];
}

export interface PersonSectionsResult {
  sections: PersonSection[];
  /** Map id → category para que el caller pase la cat a PostCard. */
  categoryMap: Map<string, Category>;
}

const ROLE_ORDER: PersonRole[] = ["author", "translator", "prologuist", "collaborator"];

function firstPostAuthor(p: any): Author | null {
  const rows = (p.post_authors ?? []) as { sort_order: number; author: Author | null }[];
  const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);
  return sorted[0]?.author ?? null;
}

export async function loadPersonSections(
  supabase: SupabaseClient,
  authorId: string,
  primary: PersonRole,
): Promise<PersonSectionsResult> {
  // 1. IDs de cada role × books/posts en paralelo (8 queries livianas).
  const [bA, bT, bP, bC, pA, pT, pP, pC] = await Promise.all([
    supabase.from("book_authors").select("book_id").eq("author_id", authorId),
    supabase.from("book_translators").select("book_id").eq("author_id", authorId),
    supabase.from("book_prologuists").select("book_id").eq("author_id", authorId),
    supabase.from("book_collaborators").select("book_id").eq("author_id", authorId),
    supabase.from("post_authors").select("post_id").eq("author_id", authorId),
    supabase.from("post_translators").select("post_id").eq("author_id", authorId),
    supabase.from("post_prologuists").select("post_id").eq("author_id", authorId),
    supabase.from("post_collaborators").select("post_id").eq("author_id", authorId),
  ]);

  const bookIdsBy: Record<PersonRole, string[]> = {
    author:       ((bA.data ?? []) as { book_id: string }[]).map((r) => r.book_id),
    translator:   ((bT.data ?? []) as { book_id: string }[]).map((r) => r.book_id),
    prologuist:   ((bP.data ?? []) as { book_id: string }[]).map((r) => r.book_id),
    collaborator: ((bC.data ?? []) as { book_id: string }[]).map((r) => r.book_id),
  };
  const postIdsBy: Record<PersonRole, string[]> = {
    author:       ((pA.data ?? []) as { post_id: string }[]).map((r) => r.post_id),
    translator:   ((pT.data ?? []) as { post_id: string }[]).map((r) => r.post_id),
    prologuist:   ((pP.data ?? []) as { post_id: string }[]).map((r) => r.post_id),
    collaborator: ((pC.data ?? []) as { post_id: string }[]).map((r) => r.post_id),
  };

  const allBookIds = Array.from(new Set([
    ...bookIdsBy.author, ...bookIdsBy.translator,
    ...bookIdsBy.prologuist, ...bookIdsBy.collaborator,
  ]));
  const allPostIds = Array.from(new Set([
    ...postIdsBy.author, ...postIdsBy.translator,
    ...postIdsBy.prologuist, ...postIdsBy.collaborator,
  ]));

  // 2. Books + posts + categorías en paralelo. Solo emitimos las
  //    queries si hay IDs.
  const [booksRes, postsRes] = await Promise.all([
    allBookIds.length > 0
      ? supabase
          .from("books")
          .select("*")
          .eq("status", "published")
          .in("id", allBookIds)
          .order("publication_date", { ascending: false })
      : Promise.resolve({ data: [] as Book[] }),
    allPostIds.length > 0
      ? supabase
          .from("posts")
          .select("*, post_authors(sort_order, author:authors(*))")
          .eq("status", "published")
          .in("id", allPostIds)
          .order("published_at", { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const allBooks = (booksRes.data ?? []) as Book[];
  const allPostsRaw = (postsRes.data ?? []) as any[];
  const allPosts = allPostsRaw.map((p) => ({ ...p, _firstAuthor: firstPostAuthor(p) }));

  // 3. Categorías de los posts (para PostCard).
  const catIds = Array.from(new Set(
    allPostsRaw.map((p) => p.category_id).filter(Boolean) as string[],
  ));
  const { data: cats } = catIds.length > 0
    ? await supabase.from("categories").select("*").in("id", catIds)
    : { data: [] as Category[] };
  const categoryMap = new Map(((cats ?? []) as Category[]).map((c) => [c.id, c]));

  // 4. Agrupar por rol respetando el orden de publicación que ya viene
  //    de las queries.
  const bookSetFor = (ids: string[]) => new Set(ids);
  const filterBooks = (ids: string[]) => {
    const set = bookSetFor(ids);
    return allBooks.filter((b) => set.has(b.id));
  };
  const filterPosts = (ids: string[]) => {
    const set = bookSetFor(ids);
    return allPosts.filter((p) => set.has(p.id));
  };

  const orderedRoles: PersonRole[] = [
    primary,
    ...ROLE_ORDER.filter((r) => r !== primary),
  ];

  const sections: PersonSection[] = orderedRoles
    .map((role) => ({
      role,
      booksTitle: BOOK_TITLES[role],
      postsTitle: POST_TITLES[role],
      books: filterBooks(bookIdsBy[role]),
      posts: filterPosts(postIdsBy[role]),
    }))
    .filter((g) => g.books.length > 0 || g.posts.length > 0);

  return { sections, categoryMap };
}
