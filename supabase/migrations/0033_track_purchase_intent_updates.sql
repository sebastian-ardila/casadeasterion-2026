-- Track who last edited a purchase_intent row. Mirrors 0031 for
-- posts/books/authors/categories. The CMS uses this to surface
-- "Estado cambiado por X · hace 2 h" in the orders list so an admin
-- can see at a glance who followed up on which lead.
--
-- The shared `set_updated_by` trigger function from 0031 already
-- reads auth.uid(), so we only need to attach it to the new column.

alter table public.purchase_intents
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

drop trigger if exists purchase_intents_set_updated_by on public.purchase_intents;
create trigger purchase_intents_set_updated_by
  before insert or update on public.purchase_intents
  for each row execute procedure public.set_updated_by();
