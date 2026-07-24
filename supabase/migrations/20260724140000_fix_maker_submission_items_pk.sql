-- maker_submission_items の主キーを (submission_id, card_id) から
-- (submission_id, group_key, position) へ変更する。
--
-- 背景:
--   upsert_select_maker_submission で同一 card_id を異なる source_key（収録版）で
--   複数 position に登録しようとすると、旧 PK (submission_id, card_id) が
--   2行目以降で duplicate key エラーを起こす。
--   (submission_id, group_key, position) は既に UNIQUE 制約が存在し、
--   全ての既存データがこの制約を満たしている。
--
-- 影響範囲:
--   - アプリコードは submission_id + position で SELECT するのみ。PK 変更の影響なし。
--   - FK (card_id → cards, submission_id → maker_submissions) は PK を参照していない。影響なし。
--   - 既存データは (submission_id, group_key, position) が既に UNIQUE なので互換。

begin;

-- 旧 PK を廃止
alter table public.maker_submission_items
  drop constraint maker_submission_items_pkey;

-- 既存の UNIQUE 制約を廃止し（PK に昇格させるため）
alter table public.maker_submission_items
  drop constraint maker_submission_items_submission_id_group_key_position_key;

-- 新 PK を (submission_id, group_key, position) として設定
alter table public.maker_submission_items
  add constraint maker_submission_items_pkey
  primary key (submission_id, group_key, position);

commit;
