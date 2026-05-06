-- ISBN uniqueness for books.
-- An ISBN identifies a specific edition globally; if two rows have the same
-- ISBN they're either duplicates or a data-entry error.
-- Partial index (where isbn is not null and isbn <> '') so books in the
-- catalog without an ISBN yet are still allowed.
--
-- ISBN background:
--   ISBN-10: legacy format (pre-2007), 9 digits + 1 check digit (0-9 or 'X')
--   ISBN-13: current format, 13 digits, prefixed with 978 or 979
--   Each ISBN identifies one edition: paperback / hardcover / ebook are
--   distinct ISBNs even for the same title.
-- We store the user-entered string verbatim (with or without dashes); the
-- index makes the *exact* string unique. The CMS layer normalizes input
-- (strip non-alphanumerics, uppercase) before saving, so '978-3-16-148410-0'
-- and '9783161484100' end up the same row.

create unique index if not exists books_isbn_unique
  on public.books (isbn)
  where isbn is not null and isbn <> '';
