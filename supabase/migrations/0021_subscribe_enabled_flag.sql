-- Feature flag controlling whether the public site shows the newsletter
-- subscription form and its links. Default true so existing behavior is
-- preserved; the owner can toggle it from /subscribers in the CMS.

insert into public.site_configuration (key, value)
values ('subscribe_enabled', 'true'::jsonb)
on conflict (key) do nothing;
