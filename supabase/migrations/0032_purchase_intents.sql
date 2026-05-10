-- Each purchase_intent is one cart submission from an authenticated
-- (Google OAuth) customer. The same customer can have many — each
-- time they confirm a cart we record a new row, useful both as
-- anti-bot (Google login required) and as marketing/analytics data.
create table public.purchase_intents (
  id              uuid primary key default gen_random_uuid(),
  -- Customer profile. Profiles are created automatically by the
  -- handle_new_user trigger when someone authenticates with Google.
  -- ON DELETE SET NULL preserves history if the customer is removed.
  profile_id      uuid references public.profiles(id) on delete set null,
  -- Snapshots of the customer's identity at the time of submission.
  -- Profiles can be edited or deleted; these stay frozen.
  email           text not null,
  full_name       text not null,
  -- Extra data the customer fills in step 2 (manual).
  phone           text,
  notes           text,
  -- Total computed server-side from book.price (never trust the
  -- client). Stored as numeric for currency safety.
  total_amount    numeric(12,2) not null default 0,
  currency        text not null default 'COP',
  -- Snapshot of the WhatsApp message body that was generated. Lets
  -- the team review later exactly what the customer received.
  whatsapp_message text not null,
  -- Lifecycle: pending → sent (customer reached the WhatsApp link)
  --                  → cancelled (manually voided in CMS)
  --                  → completed (sale closed, set in CMS)
  status          text not null default 'pending'
                  check (status in ('pending','sent','cancelled','completed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Each book in the cart is one row, with all the fields snapshotted
-- so the historical record survives book renames / deletions / price
-- changes.
create table public.purchase_intent_items (
  id              uuid primary key default gen_random_uuid(),
  intent_id       uuid not null references public.purchase_intents(id) on delete cascade,
  -- Soft FK to books — kept for joins on current data, but we don't
  -- depend on it for display because we have snapshots below.
  book_id         uuid references public.books(id) on delete set null,
  book_title      text not null,
  book_slug       text not null,
  book_isbn       text,
  cover_image_url text,
  unit_price      numeric(12,2),
  currency        text not null default 'COP',
  quantity        integer not null default 1 check (quantity > 0),
  -- 0-based position in the cart (preserves the order the customer
  -- added them).
  position        integer not null default 0,
  created_at      timestamptz not null default now()
);

create index purchase_intents_profile_id_idx
  on public.purchase_intents(profile_id);
create index purchase_intents_created_at_idx
  on public.purchase_intents(created_at desc);
create index purchase_intent_items_intent_id_idx
  on public.purchase_intent_items(intent_id);
create index purchase_intent_items_book_id_idx
  on public.purchase_intent_items(book_id);

-- updated_at auto-touch.
drop trigger if exists purchase_intents_set_updated_at on public.purchase_intents;
create trigger purchase_intents_set_updated_at
  before update on public.purchase_intents
  for each row execute procedure extensions.moddatetime(updated_at);

-- RLS
alter table public.purchase_intents enable row level security;
alter table public.purchase_intent_items enable row level security;

-- Customer can create their own intent.
create policy "purchase_intents insert own"
  on public.purchase_intents for insert
  to authenticated
  with check (auth.uid() = profile_id);

-- Customer can attach items to their own intent.
create policy "purchase_intent_items insert own"
  on public.purchase_intent_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.purchase_intents pi
      where pi.id = intent_id and pi.profile_id = auth.uid()
    )
  );

-- Customer reads their own; admins / owners read everything.
create policy "purchase_intents select own or admin"
  on public.purchase_intents for select
  to authenticated
  using (auth.uid() = profile_id or public.is_admin(auth.uid()));

create policy "purchase_intent_items select own or admin"
  on public.purchase_intent_items for select
  to authenticated
  using (
    exists (
      select 1 from public.purchase_intents pi
      where pi.id = intent_id
        and (pi.profile_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

-- Only admins toggle status (pending → sent / cancelled / completed).
-- Customers cannot mutate their intents after submission.
create policy "purchase_intents update admin"
  on public.purchase_intents for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
