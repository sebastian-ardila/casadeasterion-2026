-- The set_updated_by() trigger from 0031 was attached to posts / books /
-- authors / categories but not to site_configuration. As a result every
-- row in site_configuration has updated_by = NULL, so the CMS panel
-- (/site) can never show "Editado por <name>" — only "Última edición
-- hace X días" — even though the column and the FK to profiles exist
-- since 0007.
--
-- This migration attaches the same trigger to site_configuration so
-- future saves auto-populate updated_by from auth.uid(). Existing rows
-- stay NULL (no backfill possible — we don't know who wrote them).

drop trigger if exists site_configuration_set_updated_by on public.site_configuration;
create trigger site_configuration_set_updated_by
  before insert or update on public.site_configuration
  for each row execute procedure public.set_updated_by();
