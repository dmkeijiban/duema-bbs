# DM26-EX2正式データ移行

- 公式収録版154件、論理カード134種。
- 先行149件はカード番号を主キーに全件1対1照合。曖昧0、先行のみ0。
- 公式のみ5件は `dm26ex2-SPRSEC001`〜`005`。既存5論理カードへ追加する。
- 先行収録版UUIDと親`cards.id`は維持し、`source_key`・公式URL・画像URLを正式値へ昇格する。
- 旧`DM26EX2-PREVIEW-*`は`card_printing_source_aliases`で正式収録版へ解決する。
- `name_kana`は公式詳細HTMLに存在しないため推測せずnullを維持する。
- migrationはトランザクション内で実行し、同一SQLの再実行を許容する。
- 緊急時は`supabase/rollbacks/20260718090000_migrate_dm26_ex2_preview_to_official.rollback.sql`を使用する。物理削除は行わない。

検証成果物は`data/cards/dm26-ex2-*.json`。公式HTMLや秘密情報はGitへ含めない。
