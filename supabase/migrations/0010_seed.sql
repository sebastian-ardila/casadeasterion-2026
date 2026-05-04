insert into public.categories (slug, name, kind, description, sort_order) values
  ('filosofia', 'Filosofía', 'philosophy', 'Ensayos, artículos y reflexiones filosóficas.', 10),
  ('poesia',    'Poesía',    'poetry',     'Poemas, antologías y crítica poética.',          20),
  ('narrativa', 'Narrativa', 'other',      'Cuento, novela y ensayo narrativo.',             30),
  ('editorial', 'Editorial', 'other',      'Notas editoriales de Casa de Asterión.',         40)
on conflict (slug) do nothing;

insert into public.site_configuration (key, value) values
  ('hero_quote', to_jsonb('"La belleza está en los espacios vacíos, en lo que no se dice, en lo que apenas se sugiere."'::text)),
  ('hero_quote_author', to_jsonb('Isabel Allende'::text)),
  ('editorial_description', to_jsonb('Editorial independiente dedicada a publicar obras que desafían, inspiran y transforman. Creemos en el poder de las palabras para cambiar el mundo, una página a la vez.'::text)),
  ('footer_legal', to_jsonb(('© ' || to_char(now(), 'YYYY') || ' Casa de Asterión. Todos los derechos reservados.')::text)),
  ('social_links', '{"facebook": "", "instagram": "", "twitter": ""}'::jsonb),
  ('whatsapp_phone', to_jsonb('+573117462759'::text)),
  ('whatsapp_message_template', to_jsonb('Hola, me interesa el libro "{{title}}" de {{author}}. ¿Está disponible?'::text)),
  ('robots_block_ai', '["GPTBot","ClaudeBot","PerplexityBot","CCBot","Google-Extended","anthropic-ai","cohere-ai"]'::jsonb)
on conflict (key) do nothing;
