-- Switch the newsletter subscription flow to Google OAuth only.
-- Email-based double opt-in is gone, so:
--   - confirmation_token is no longer needed (the JWT from Google is the
--     proof the email is real and authorized).
--   - confirmed_at defaults to now() because the moment a row is inserted,
--     the user is already authenticated against Google.

alter table public.subscribers drop column if exists confirmation_token;
alter table public.subscribers alter column confirmed_at set default now();

-- Backfill any existing pending rows so they're not stuck in limbo.
update public.subscribers
set confirmed_at = coalesce(confirmed_at, created_at, now())
where confirmed_at is null;
