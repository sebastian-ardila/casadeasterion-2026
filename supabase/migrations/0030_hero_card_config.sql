-- Hero card config: a single JSONB blob in site_configuration that drives
-- the homepage hero card. Per-platform style overrides (desktop, mobile)
-- and a content_source selector that the public site reads at build time
-- to pick what to show inside the card.

insert into public.site_configuration (key, value)
values (
  'hero_card_config',
  jsonb_build_object(
    'content_source', 'editorial',
    'manual', jsonb_build_object(
      'eyebrow', 'Editorial',
      'title', 'Casa de Asterión Ediciones',
      'body', '',
      'cta_label', 'Explorar el catálogo',
      'cta_href', '/catalogo'
    ),
    'desktop', jsonb_build_object(
      'bg_color', '#1a1715',
      'bg_alpha', 1,
      'bg_image_url', '',
      'bg_blur', 0,
      'text_color', '#f5f1ea',
      'title_font', 'serif',
      'border_radius_tl', 0,
      'border_radius_tr', 0,
      'border_radius_br', 0,
      'border_radius_bl', 0,
      'width', 760,
      'height', 520,
      'padding', 56,
      'offset_x', 96,
      'offset_y', 0,
      'shadow', true
    ),
    'mobile', jsonb_build_object(
      'bg_color', '#1a1715',
      'bg_alpha', 1,
      'bg_image_url', '',
      'bg_blur', 0,
      'text_color', '#f5f1ea',
      'title_font', 'serif',
      'border_radius_tl', 0,
      'border_radius_tr', 0,
      'border_radius_br', 0,
      'border_radius_bl', 0,
      'width', 0,
      'height', 280,
      'padding', 24,
      'offset_x', 16,
      'offset_y', 32,
      'shadow', true
    )
  )
)
on conflict (key) do nothing;
