-- Add community discussion categories requested on 2026-05-17.
-- Safe to rerun: existing slugs are updated instead of duplicated.

insert into categories (name, slug, color, description, sort_order)
values
  ('炎上・物議', 'controversy', '#ef4444', '炎上・物議を呼んだ話題', 12),
  ('オリカ', 'custom-card', '#8b5cf6', 'オリジナルカード・自作カード案', 13),
  ('初心者・復帰勢', 'beginner-returning', '#10b981', '初心者・復帰勢向けの質問や相談', 14)
on conflict (slug) do update set
  name = excluded.name,
  color = excluded.color,
  description = excluded.description,
  sort_order = excluded.sort_order;
