-- 0032 wrote policies for INSERT/SELECT/UPDATE on purchase_intents
-- but forgot DELETE. With RLS enabled, that means *no role* could
-- delete a row — including admins. Worse, the silent failure mode
-- of Postgres RLS is "0 rows affected, no error returned", so the
-- CMS happily redirected to ?saved=1 and the panel showed the row
-- still there. Fix is parallel to the UPDATE policy: admin-only.
-- purchase_intent_items don't need a delete policy because the FK
-- has ON DELETE CASCADE, which runs without checking RLS.

create policy "purchase_intents delete admin"
  on public.purchase_intents for delete
  to authenticated
  using (public.is_admin(auth.uid()));
