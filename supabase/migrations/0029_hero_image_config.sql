-- New global config: cover image for the home hero. Empty string means
-- the public site falls back to its hardcoded default (Unsplash library
-- photo). Editors set the URL via /site → "Imagen del hero".

insert into public.site_configuration (key, value)
values ('hero_image_url', '""'::jsonb)
on conflict (key) do nothing;
