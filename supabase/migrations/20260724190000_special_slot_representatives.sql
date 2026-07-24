-- 特殊枠（アドバンス用「なし／ドルマゲドン相当／零龍相当」）の代表カードを、
-- id昇順などDBの並び順や将来のカード追加に依存せず固定するためのマッピング表。
--
-- これまでの実装は cards.deck_zone_class = 'special' なカードを cardType ごとに
-- id昇順で1件選ぶ方式だったが、これは以下の理由で不安定：
--   - 将来UUIDがより小さい同cardTypeのカードが追加されると代表が黙って変わる
--   - 既存の保存済み deck_submissions.special_card_id が指す値と食い違う恐れがある
-- そこで「key -> cards.id」を明示的に固定するテーブルを用意し、この表にある
-- 行だけを唯一の正とする。key は 'dormageddon' / 'zeroryu' の2つで固定。
--
-- 注意: このマイグレーションは行を追加しない（空のまま作成）。実際の
-- ドルマゲドン／零龍に対応する cards.id は本番DBを確認できる担当者が
-- 手動で INSERT する必要がある（後続の手動データ投入が必須）。
create table if not exists special_slot_representatives (
  key text primary key check (key in ('dormageddon', 'zeroryu')),
  label text not null,
  card_id uuid not null references cards(id) on delete restrict,
  updated_at timestamptz not null default now()
);

comment on table special_slot_representatives is
  '特殊枠の代表カード固定マッピング（key: dormageddon/zeroryu -> cards.id）。id昇順等の並び順に依存させないための唯一の正。手動でメンテナンスする。';
