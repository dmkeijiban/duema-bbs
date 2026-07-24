-- 特殊枠（アドバンス用「なし／ドルマゲドン／零龍」）の代表カードを、
-- id昇順などDBの並び順や将来のカード追加に依存せず固定するためのマッピング表。
--
-- これまでの実装は cards.deck_zone_class = 'special' なカードを cardType ごとに
-- id昇順で1件選ぶ方式だったが、これは以下の理由で不安定：
--   - 将来UUIDがより小さい同cardTypeのカードが追加されると代表が黙って変わる
--   - 既存の保存済み deck_submissions.special_card_id が指す値と食い違う恐れがある
-- そこで「key -> cards.id」を明示的に固定するテーブルを用意し、この表にある
-- 行だけを唯一の正とする。key は 'dormageddon' / 'zeroryu' の2つで固定。
create table if not exists special_slot_representatives (
  key text primary key check (key in ('dormageddon', 'zeroryu')),
  label text not null,
  card_id uuid not null references cards(id) on delete restrict,
  updated_at timestamptz not null default now()
);

comment on table special_slot_representatives is
  '特殊枠の代表カード固定マッピング（key: dormageddon/zeroryu -> cards.id）。id昇順等の並び順に依存させないための唯一の正。';

-- 実カタログから代表カードを自動特定して登録する。手動INSERTは不要。
--
-- 識別条件（src/lib/special-slot-representative-rules.ts の
-- SPECIAL_SLOT_REPRESENTATIVE_RULES と完全に一致させること）:
--
--   - dormageddon: cards.card_type = '最終禁断フィールド'
--     「FORBIDDEN STAR ～世界最後の日～／終焉の禁断 ドルマゲドンX」ツインパクトの
--     表面タイプ。本番の /api/cards/search を通じた読み取り専用確認
--     （2026-07-24実施）で、この条件に一致するのは cards.id
--     c87706ba-a6a1-49da-923f-68bb7c8e681c の1件のみであることを確認済み。
--
--   - zeroryu: cards.card_type = '零龍の儀' かつ 対応する card_printings の
--     source_key = 'dmbd22-001'。
--     当初は cards.card_type = '零龍クリーチャー' で絞り込める想定だったが、
--     同じ本番確認で **この条件に一致する行は0件** であることが判明した。
--     「零龍」は"○○の儀"系ツインパクト5種（dmbd22-001〜005）の裏面としてのみ
--     存在し、cards自身のcard_typeは表面の零龍の儀／零龍星雲のままで、5件とも
--     対等な別の論理カード（別cards.id）。スキーマだけからは一意に決定できない
--     ため、担当者に候補5件を提示して確認した結果、最初のリリースである
--     dmbd22-001「滅亡の起源 零無」（card_id
--     d0dab9d1-8c2a-49e0-8837-33d33953e973）を代表として採用することが
--     確定した。このため zeroryu だけは card_printings.source_key でも絞り込む。
--
-- select ... into strict は PL/pgSQL の標準機能で、0件なら no_data_found、
-- 2件以上なら too_many_rows を自動的に送出する。複数件ヒットした場合に
-- 無言で先頭を選ぶことは絶対にしない：どちらの例外も明示的な RAISE EXCEPTION に
-- 変換し、マイグレーション自体を失敗させる。
do $$
declare
  v_dormageddon_id uuid;
  v_zeroryu_id uuid;
begin
  select id into strict v_dormageddon_id
    from cards
   where card_type = '最終禁断フィールド'
     and deck_zone_class = 'special'
     and is_active;

  select c.id into strict v_zeroryu_id
    from card_printings p
    join cards c on c.id = p.card_id
   where p.source_key = 'dmbd22-001'
     and c.card_type = '零龍の儀'
     and c.deck_zone_class = 'special'
     and c.is_active;

  insert into special_slot_representatives (key, label, card_id) values
    ('dormageddon', 'ドルマゲドン', v_dormageddon_id),
    ('zeroryu', '零龍', v_zeroryu_id)
  on conflict (key) do update set card_id = excluded.card_id, updated_at = now();
exception
  when no_data_found then
    raise exception 'special_slot_representatives: 代表カードの候補が0件でした。cards.card_type=''最終禁断フィールド'' の行、または card_printings.source_key=''dmbd22-001'' に対応する cards.card_type=''零龍の儀'' の行が、is_active=true かつ deck_zone_class=''special''で存在するか確認してください。';
  when too_many_rows then
    raise exception 'special_slot_representatives: 代表カードの候補が複数件ヒットしました。識別条件を見直すか special_slot_representatives へ手動で登録してください。';
end
$$;
