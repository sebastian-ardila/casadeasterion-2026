-- Bug fix layered on top of 0038: trigger_rebuild_book_authors and
-- trigger_rebuild_post_authors were created as SECURITY INVOKER (the
-- default), which means they ran with the privileges of the current
-- user — `authenticated` in the CMS flow. queue_rebuild() does NOT
-- grant EXECUTE to authenticated, so the PERFORM inside our wrapper
-- raised "permission denied for function queue_rebuild" every time a
-- row was inserted into book_authors / post_authors for a published
-- parent. The whole INSERT then rolled back, and PostgREST surfaced
-- the error as a generic permission-denied to the CMS — masking the
-- multi-author save with a misleading "no permissions" banner.
--
-- The original trigger_amplify_rebuild function we modeled these
-- wrappers after IS already SECURITY DEFINER (owned by postgres),
-- which is the pattern that lets a regular user fire a build hook.
-- Mirror that here.

CREATE OR REPLACE FUNCTION public.trigger_rebuild_book_authors()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
SECURITY DEFINER
SET search_path = public, pg_temp
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
