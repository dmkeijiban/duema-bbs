-- Optional production migration draft.
-- Purpose: move existing threads from legacy category IDs to the current
-- consolidated category IDs without deleting legacy category rows.
--
-- Run only after taking the project's required production DB backup.

do $$
declare
  target_id integer;
begin
  insert into categories (name, slug, description, color, sort_order)
  values
    ('雑談', 'chat', '雑談、話題全般', '#607d8b', 1),
    ('新カード・新商品', 'new-products', '新カード、新商品情報', '#e74c3c', 2),
    ('デッキ・ルール相談', 'deck-rules', 'デッキ相談、初心者・復帰勢、ルール・裁定相談', '#3498db', 3),
    ('大会・環境', 'tournament-meta', '大会、CS、環境関係', '#27ae60', 4),
    ('高騰・殿堂関連', 'market-premium', 'カード価格、高騰、下落、殿堂関連', '#f39c12', 5),
    ('デュエプレ・特殊ルール', 'duel-pro-special', 'デュエプレ、デュエパ等の特殊ルール、殿堂関連', '#9b59b6', 6),
    ('思い出・アニメ・漫画', 'memory-anime', '思い出、背景ストーリー、アニメ・漫画', '#795548', 7),
    ('デュエチューバー・炎上', 'youtuber-controversy', 'デュエチューバー、炎上・物議', '#e67e22', 8),
    ('オリカ・創作', 'custom-creation', 'オリカ、創作関連', '#8b5cf6', 9)
  on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    color = excluded.color,
    sort_order = excluded.sort_order;

  select id into target_id from categories where slug = 'new-products';
  update threads
  set category_id = target_id
  where category_id in (select id from categories where slug in ('new-cards', 'new-products'));

  select id into target_id from categories where slug = 'deck-rules';
  update threads
  set category_id = target_id
  where category_id in (select id from categories where slug in ('deck', 'rules', 'beginner-returning', 'deck-rules'));

  select id into target_id from categories where slug = 'tournament-meta';
  update threads
  set category_id = target_id
  where category_id in (select id from categories where slug in ('tournament', 'tournament-meta'));

  select id into target_id from categories where slug = 'market-premium';
  update threads
  set category_id = target_id
  where category_id in (select id from categories where slug in ('price', 'market-premium'));

  select id into target_id from categories where slug = 'duel-pro-special';
  update threads
  set category_id = target_id
  where category_id in (select id from categories where slug in ('duel-pro', 'special-rules', 'pureden', 'duel-pro-special'));

  select id into target_id from categories where slug = 'memory-anime';
  update threads
  set category_id = target_id
  where category_id in (select id from categories where slug in ('classic', 'story', 'anime', 'memory-anime'));

  select id into target_id from categories where slug = 'youtuber-controversy';
  update threads
  set category_id = target_id
  where category_id in (select id from categories where slug in ('youtuber', 'controversy', 'youtuber-controversy'));

  select id into target_id from categories where slug = 'custom-creation';
  update threads
  set category_id = target_id
  where category_id in (select id from categories where slug in ('custom-card', 'custom-creation'));
end $$;
