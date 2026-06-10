-- ============================================================
-- 図鑑シード: DM-01 基本セット + ボルシャック・ドラゴン
-- ⚠️ DRAFT: 本番DBにはまだ適用しない。20260610_zukan_packs_cards.sql の後に実行する。
-- ============================================================

-- DM-01 パック
insert into public.zukan_packs (slug, code, name, released_year, card_count, description, is_published, sort_order)
values (
  'dm-01',
  'DM-01',
  '基本セット',
  '2002年',
  120,
  'デュエル・マスターズの最初の弾。5つの文明とシンプルな能力で構成された原点のセット。',
  true,
  1
)
on conflict (slug) do nothing;

-- ボルシャック・ドラゴン
insert into public.zukan_cards (
  pack_id, slug, name, card_type, civilization, cost, mana, race, power, rarity,
  illustrator, ability_text, flavor_text, sort_order
)
select
  p.id,
  'bolshack-dragon',
  'ボルシャック・ドラゴン',
  'クリーチャー',
  '火',
  6,
  6,
  'アーマード・ドラゴン',
  '6000+',
  'ベリーレア',
  null,
  'パワーアタッカー＋1000（攻撃中、このクリーチャーのパワーは＋1000される）。W・ブレイカー。このクリーチャーが攻撃する時、自分の墓地にある火のカード1枚につき、このクリーチャーのパワーはそのターン＋1000される。',
  null,
  1
from public.zukan_packs p
where p.slug = 'dm-01'
on conflict (slug) do nothing;
