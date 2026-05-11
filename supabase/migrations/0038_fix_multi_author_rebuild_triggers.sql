-- Fix bug in 0037: the wrapper functions trigger_rebuild_book_authors
-- and trigger_rebuild_post_authors were calling trigger_amplify_rebuild()
-- via PERFORM, but trigger_amplify_rebuild is a *trigger* function
-- (returns trigger), which Postgres only allows being invoked through a
-- trigger binding (EXECUTE PROCEDURE). Calling it from PL/pgSQL raised
-- "0A000: trigger functions can only be called as triggers" every time
-- a row was inserted into book_authors / post_authors, which silently
-- rolled back the entire INSERT and prevented the CMS from ever
-- persisting more than one author per book.
--
-- The correct entry point for enqueueing a build from regular PL/pgSQL
-- is queue_rebuild() — a normal function that records the request and
-- lets the cron dispatcher fire the Amplify webhook. That matches the
-- behavior we wanted: write into the junction → rebuild is queued.

CREATE OR REPLACE FUNCTION public.trigger_rebuild_book_authors()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  is_published boolean;
  target_book uuid;
BEGIN
  target_book := COALESCE(NEW.book_id, OLD.book_id);
  SELECT (status = 'published') INTO is_published FROM public.books WHERE id = target_book;
  IF is_published THEN
    PERFORM public.queue_rebuild();
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_rebuild_post_authors()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  is_published boolean;
  target_post uuid;
BEGIN
  target_post := COALESCE(NEW.post_id, OLD.post_id);
  SELECT (status = 'published') INTO is_published FROM public.posts WHERE id = target_post;
  IF is_published THEN
    PERFORM public.queue_rebuild();
  END IF;
  RETURN NULL;
END;
$$;
