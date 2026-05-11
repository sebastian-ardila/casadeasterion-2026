-- SEO seed: populate keywords, image alts, tags and global defaults
-- so search engines have meaningful signals on every page.
--
-- All target columns existed since 0005/0025; this migration only
-- writes data, never schema. Safe to re-run (each statement is an
-- explicit update over current rows; new rows added later are
-- managed manually from the CMS).

-- 1) Site-wide default keywords. Merged into the <meta name="keywords">
-- on every page along with the page-specific keywords. Tuned for the
-- editorial's primary positioning: filosofía + poesía from a Colombian
-- independent publisher.
update public.site_configuration
set value = jsonb_build_array(
  'Casa de Asterión Ediciones',
  'Casa de Asterión',
  'casadeasterionediciones.com',
  'editorial filosofía',
  'editorial poesía',
  'editorial independiente Colombia',
  'ediciones independientes',
  'libros de filosofía',
  'libros de poesía',
  'filosofía contemporánea',
  'poesía contemporánea',
  'filosofía latinoamericana',
  'poesía latinoamericana',
  'poesía colombiana',
  'ensayos filosóficos',
  'literatura colombiana',
  'filosofía y poesía'
)
where key = 'default_keywords';

-- 2) Books: cover_image_alt, tags, keywords derived from each book's
-- category, author and title. Only touches published rows; drafts
-- stay untouched so editors can preview their own fills.
with src as (
  select b.id,
         b.title,
         b.isbn,
         a.name as author_name,
         c.kind as cat_kind
  from public.books b
  left join public.authors a on a.id = b.author_id
  left join public.categories c on c.id = b.category_id
  where b.status = 'published'
)
update public.books b
set
  cover_image_alt = case
    when src.author_name is not null
      then 'Portada de ' || src.title || ' — ' || src.author_name
    else 'Portada de ' || src.title
  end,
  tags = case src.cat_kind
    when 'philosophy' then array['filosofía','ensayo']
    when 'poetry'     then array['poesía']
    when 'other'      then array['literatura']
    else                   array['libro']
  end,
  keywords = (
    select array_agg(distinct k order by k)
    from unnest(
      array[src.title, 'Casa de Asterión Ediciones', 'editorial independiente']
      || coalesce(array[src.author_name], array[]::text[])
      || case when src.isbn is not null then array['ISBN ' || src.isbn] else array[]::text[] end
      || case src.cat_kind
           when 'philosophy' then array['filosofía','filosofía contemporánea','ensayo filosófico','filosofía latinoamericana','libros de filosofía']
           when 'poetry'     then array['poesía','poesía contemporánea','poesía latinoamericana','poesía colombiana','libros de poesía']
           when 'other'      then array['narrativa','literatura latinoamericana','libros']
           else                   array[]::text[]
         end
    ) as t(k)
    where k is not null and trim(k) <> ''
  )
from src
where src.id = b.id;

-- 3) Authors: keywords derived from the author's name plus the
-- categories they've published in. Helps the /autores/<slug> pages
-- surface for "filósofo + topic" searches.
with src as (
  select a.id,
         a.name,
         array_agg(distinct c.kind) filter (where c.kind is not null) as kinds
  from public.authors a
  left join public.books b on b.author_id = a.id and b.status = 'published'
  left join public.categories c on c.id = b.category_id
  group by a.id, a.name
)
update public.authors a
set keywords = (
  select array_agg(distinct k order by k)
  from unnest(
    array[src.name, 'Casa de Asterión Ediciones', 'autor Casa de Asterión']
    || case when 'philosophy' = any(coalesce(src.kinds, array[]::text[]))
            then array['filósofo','filosofía','filosofía contemporánea','ensayo filosófico'] else array[]::text[] end
    || case when 'poetry' = any(coalesce(src.kinds, array[]::text[]))
            then array['poeta','poesía','poesía contemporánea','poesía latinoamericana'] else array[]::text[] end
    || case when 'other' = any(coalesce(src.kinds, array[]::text[]))
            then array['narrador','narrativa','literatura'] else array[]::text[] end
  ) as t(k)
  where k is not null and trim(k) <> ''
)
from src
where src.id = a.id;
