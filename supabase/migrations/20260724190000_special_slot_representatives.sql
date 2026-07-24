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
--   - dormageddon: cards.card_type = '最終禁断フィールド'
--     「FORBIDDEN STAR ～世界最後の日～／終焉の禁断 ドルマゲドンX」ツインパクトの
--     表面タイプ。cards.normalized_name はユニーク制約があるため、再録があっても
--     同一cards.idに集約される＝この条件だけで一意に絞り込める。
--   - zeroryu: cards.card_type = '零龍クリーチャー'
--     「零龍」単独カタログ登録カードの表面タイプ。"○○の儀"系ツインパクト
--     （零龍の儀／零龍星雲が表面タイプ）は、零龍表記が card_faces 側の裏面にしか
--     存在せず cards.card_type 自体は零龍クリーチャーにならないため、この条件では
--     対象外になる（cards.card_type を直接見ることで裏面重複を意図的に除外している）。
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

  select id into strict v_zeroryu_id
    from cards
   where card_type = '零龍クリーチャー'
     and deck_zone_class = 'special'
     and is_active;

  insert into special_slot_representatives (key, label, card_id) values
    ('dormageddon', 'ドルマゲドン', v_dormageddon_id),
    ('zeroryu', '零龍', v_zeroryu_id)
  on conflict (key) do update set card_id = excluded.card_id, updated_at = now();
exception
  when no_data_found then
    raise exception 'special_slot_representatives: 代表カードの候補が0件でした。cards.card_type が ''最終禁断フィールド'' または ''零龍クリーチャー'' で、is_active=true かつ deck_zone_class=''special'' の行が存在するか確認してください。';
  when too_many_rows then
    raise exception 'special_slot_representatives: 代表カードの候補が複数件ヒットしました。cards.card_type = ''最終禁断フィールド'' または ''零龍クリーチャー'' に一致する行を1件に絞り込めるよう、識別条件を見直すか special_slot_representatives へ手動で登録してください。';
end
$$;
