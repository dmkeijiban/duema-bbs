# PR #551 Supabase migration履歴・本番schema照合報告

調査日: 2026-07-13（JST）

対象: `nodgfukqvuwvgfnlzvnh` / `nodgfukqvuwvgfnlzvnh.supabase.co`

結論: **保留**。本番DDL/DML、`db push`、`migration repair`、履歴テーブル更新、main mergeは実施していない。

## 1. 調査方法と制約

- `supabase db query --linked` の `SELECT` のみで `pg_catalog`、`information_schema`、`pg_policies`、`supabase_migrations.schema_migrations` を照合した。
- 本番のtable/column/index/constraint/function/view/RLS/policy/triggerは変更していない。
- `supabase db dump --linked --schema public` はDocker Desktopがないため実行不能だった。代替として、schema-onlyのカタログ情報（列型、default、nullable、制約定義、index定義、function定義・ACL、view定義・ACL、policy、trigger）を取得した。
- ローカル適用後schemaの再現と自動schema diffも、Docker/Postgresのshadow DBがないため未生成。下記「schema diff概要」はSQLファイルと本番カタログのオブジェクト単位比較である。
- `supabase/migrations/drafts/` はSupabase CLIの通常適用対象外だが、本番履歴との対応を調べるため一覧・分類に含めた。

## 2. 本番migration履歴

| version | name | ローカル対応 |
|---|---|---|
| `20260521122214` | `add_x_post_source_columns` | active migration外の `supabase/add_x_post_source.sql` に近い |
| `20260524105613` | `add_is_protected_to_threads` | active migrationに同versionファイルなし |
| `20260610111649` | `zukan_packs_cards` | `drafts/20260610_zukan_packs_cards.sql` |
| `20260611233908` | `zukan_reviews` | `20260611_zukan_reviews.sql` |
| `20260611235153` | `fix_rating_constraint` | `20260612_fix_rating_constraint.sql` |
| `20260612025342` | `zukan_admin_features` | `20260612_zukan_admin_features.sql` |
| `20260712140652` | `20260711_cards` | `drafts/20260711_cards.sql` |
| `20260712140743` | `20260712_maker_tier` | `drafts/20260712_maker_tier.sql` |

重要な構造上の問題:

- 本番は14桁timestamp version、ローカルactive migrationは8桁日付versionである。
- ローカルには同一versionが複数ある（例: `20260514` が3件、`20260612` が4件、`20260702` が4件、`20260713` が7件）。Supabase履歴では同一versionを個別に安全管理できない。
- 本番記録済み8件のうち2件はactive migrationディレクトリに同versionファイルがない。
- `db push --dry-run` は `Remote migration versions not found in local migrations directory` で停止した。

## 3. 分類基準

- A: 本番履歴に論理的に記録済みで、schemaも一致
- B: 本番履歴には未記録だが、schemaには完全適用済み
- C: 本番履歴には未記録で、schemaに一部だけ適用済み
- D: 本番履歴には未記録で、schemaにも未適用
- E: 本番履歴に記録済みだが、schemaと不一致
- F: data-only、後続変更、または十分な比較材料がなく判定不能

`論理的に記録済み`は、ファイルの8桁versionが本番14桁versionと同一という意味ではない。migration名・対象・本番schemaから対応が明確という意味であり、CLI履歴としては不一致のままである。

## 4. ローカルactive migration全一覧

| ファイル / version | 主な作成・変更対象 | table / column | index | function・view / constraint・policy・trigger | 分類 |
|---|---|---|---|---|---|
| `20260514_x_posts.sql` / `20260514` | X投稿管理基盤 | `x_posts`, `x_post_images`, `x_reply_logs` | PK/uniqueを含むtable定義内index | `update_updated_at_column`; RLS; `deny all anon`; `x_posts_updated_at` | B |
| `20260514_x_posts_v2.sql` / `20260514` | X投稿種別・状態拡張 | `x_posts` | — | `x_posts_post_type_check`, `x_posts_status_check` | B |
| `20260514_x_posts_v3.sql` / `20260514` | X投稿種別再拡張 | `x_posts` | — | `x_posts_post_type_check` | B |
| `20260611_zukan_reviews.sql` / `20260611` | パック/カードレビュー・評価 | `zukan_pack_reviews`, `zukan_card_reviews`, `zukan_card_ratings` | card/created_at系5件 | review/rating SELECT・INSERT policy、RLS | A |
| `20260612_fix_rating_constraint.sql` / `20260612` | 登録/匿名評価のunique分離 | `zukan_card_ratings` | unique constraint付随index | `zukan_card_ratings_user_unique`, `zukan_card_ratings_anon_unique` | A |
| `20260612_profile_avatars.sql` / `20260612` | プロフィール画像 | `profiles.avatar_url`, Storage bucket | — | storage.objectsのread/owner insert/update/delete policy | B |
| `20260612_zukan_admin_features.sql` / `20260612` | 図鑑管理メモ・関連記事 | `zukan_admin_notes`, `zukan_card_memos`, `zukan_related_threads` | unique 3件 | RLS、SELECT policy 3件 | A |
| `20260612_zukan_moderation_and_rate_limit.sql` / `20260612` | レビュー表示名・匿名キー・非表示 | review/rating 3表の `display_name`, `anon_key`, `is_hidden` | anon/user recent 4件 | rating SELECT policy更新 | B |
| `20260617_site_settings_rls_security.sql` / `20260617` | site_settings公開読取のみ | `site_settings` | — | `site_settings_select_public`;旧all policy削除 | B |
| `20260620_campaign_events.sql` / `20260620` | キャンペーン | `campaign_events` | table制約付随 | updated_at function、public SELECT、updated_at trigger | B |
| `20260624_contact_messages_tracking.sql` / `20260624` | 問い合わせ追跡 | `contact_messages.session_id/user_id` | partial 2件 | `contact_insert`; RLS | B |
| `20260624_daily_zukan_thread_logs.sql` / `20260624` | 日次図鑑ログ | `daily_zukan_thread_logs` | posted_date unique、cycle/slug | RLS | B |
| `20260624_report_mutes.sql` / `20260624` | 通報・ミュート | `reports`, `report_mutes` | partial含む6件 | PK/check/FK、RLS | B |
| `20260628_typefully_sync_columns.sql` / `20260628` | Typefully同期 | `x_posts.thread_id/synced_at/sync_error/last_attempt_at/retry_count/source_status` | `idx_x_posts_typefully_id_unique` partial unique | thread FK | B |
| `20260629_daily_zukan_thread_schedule.sql` / `20260629` | 日次図鑑予定 | `daily_zukan_thread_schedule` | status/date、card_slug | FK/unique/check、RLS | B |
| `20260701_comment_spam_controls.sql` / `20260701` | コメントspam制御 | `posts.ip_hash`, `threads.comment_locked` | partial 2件 | — | B |
| `20260702_add_thumbnail_urls.sql` / `20260702` | サムネURL | `threads.thumbnail_url`, `posts.thumbnail_url` | — | — | B |
| `20260702_daily_zukan_typefully_status.sql` / `20260702` | 日次図鑑Typefully状態 | logsの `typefully_*` 5列 | 4件 | RLS | B |
| `20260702_kakolog_threads.sql` / `20260702` | 過去ログ化 | `threads.archived_at/auto_lock_exempt` | partial 3件 | — | B |
| `20260702_x_buzz_queue.sql` / `20260702` | Xバズキュー | `x_buzz_queue` | partial含む3件 | updated_at function/trigger、RLS、check/FK | B |
| `20260705_normalize_thread_categories.sql` / `20260705` | カテゴリ9種upsert・既存thread移行 | `categories`, `threads.category_id`（data-only） | — | — | D |
| `20260706_daily_zukan_typefully_reservations.sql` / `20260706` | Typefully予約情報 | scheduleの `typefully_*` 9列 | status、partial unique | check | B |
| `20260707_zukan_articles.sql` / `20260707` | 図鑑記事 | `zukan_articles` | 4件（後続で1件削除） | updated_at function/trigger、公開SELECT policy、RLS | B |
| `20260707_zukan_articles_card_archived.sql` / `20260707` | card記事・archived状態 | `zukan_articles` | — | article_type/status check更新 | B |
| `20260709_remove_zukan_one_published_per_target.sql` / `20260709` | 1対象1公開制約解除 | — | `zukan_articles_one_published_per_target_idx`削除 | — | B |
| `20260710_thread_polls_and_quizzes.sql` / `20260710` | 投票・クイズ | `thread_polls/options/votes` | partial/unique 3件 | `create_interactive_thread`, vote trigger function/trigger、SELECT policy、RLS | B |
| `20260711_admin_consented_thread_bulk_create.sql` / `20260711` | 同意済み投稿メタデータ | `admin_consented_post_metadata` | table unique | `admin_create_consented_thread`; service_roleのみEXECUTE; RLS | B |
| `20260713_01_hall_release_card_sync.sql` / `20260713` | 殿堂カード同期 | `cards.source_kind/source_key`、一時表、128件同期 | `cards_source_identity_unique` partial unique | — | B |
| `20260713_add_dm26_ex2_spr_cards.sql` / `20260713` | Tier企画SPR 5枚追加 | `cards`, `maker_project_cards`（data-only） | — | — | D |
| `20260713_admin_maker_analytics.sql` / `20260713` | 統合管理分析 | 既存maker表参照 | `maker_events_created_project_type_idx`, `maker_submissions_updated_project_valid_idx` | `admin_maker_project_stats(timestamptz)` | D |
| `20260713_daily_zukan_remove_auto_lock_exempt.sql` / `20260713` | 日次図鑑threadの免除解除 | `threads.auto_lock_exempt`（data-only） | — | — | F |
| `20260713_hall_of_fame_release_maker.sql` / `20260713` | 殿堂解除選手権 | maker企画・カード128件 | — | `maker_selection_aggregates` view、anon/authenticated revoke | B |
| `20260713_maker_acquisition_events.sql` / `20260713` | 登録導線イベント | `maker_events` | partial unique 2件 | `record_maker_event`更新、`maker_event_stats_v2`; service_roleのみ | B |
| `20260713_maker_events.sql` / `20260713` | makerイベント基盤 | `maker_events` | actor/project 2件 | `record_maker_event`, `maker_event_stats`; RLS、service_roleのみ | B |
| `20260714_add_maker_page_views.sql` / `20260714` | PVイベント | `maker_events.view_id` | `maker_events_page_view_id_uidx` partial unique | `record_maker_page_view`; event_type check更新 | B |

### data-only判定の補足

- `normalize_thread_categories`: 期待する9 slug中、本番に存在するのは1件。旧カテゴリに紐づくthreadが569件残るため未適用と判定。
- `add_dm26_ex2_spr_cards`: 固定UUIDのSPRカード0/5、企画紐付け0/5のため未適用。
- `daily_zukan_remove_auto_lock_exempt`: 対象threadは `false` 9件、`true` 10件。migrationの部分実行か、実行後の新規データかを履歴なしでは区別できないためF。
- `hall_of_fame_release_maker`: 企画1件、紐付け128件、view定義一致のためB。

## 5. `drafts/` 全一覧（CLI通常適用対象外）

| ファイル / version | 主な対象 | schema / data | 分類 |
|---|---|---|---|
| `drafts/20260610_zukan_packs_cards.sql` / `20260610` | `zukan_packs`, `zukan_cards`、index、RLS、公開policy | table/列/PK/FK/unique/index/policy一致 | A |
| `drafts/20260610_zukan_seed_dm01.sql` / `20260610` | DM-01 seed | 本番120/120件。全フィールド同値までは未比較 | F |
| `drafts/20260706_zukan_seed_dm02.sql` / `20260706` | DM-02 seed | 本番60/60件。全フィールド同値までは未比較 | F |
| `drafts/20260706_zukan_seed_dm22_rp1.sql` / `20260706` | DM22-RP1 seed | 本番171/171件。全フィールド同値までは未比較 | F |
| `drafts/20260706_zukan_seed_dmr_01.sql` / `20260706` | DMR-01 seed | 本番120/120件。全フィールド同値までは未比較 | F |
| `drafts/20260706_zukan_seed_dmrp_01.sql` / `20260706` | DMRP-01 seed | 本番104/104件。全フィールド同値までは未比較 | F |
| `drafts/20260706_zukan_update_dm02_details.sql` / `20260706` | DM-02 60枚の詳細UPDATE | 全60行・全フィールドの完全比較未実施 | F |
| `drafts/20260711_cards.sql` / `20260711` | 共通`cards`、`zukan_cards.card_id`、index/RLS | schema一致 | A |
| `drafts/20260712_maker_tier.sql` / `20260712` | maker 4表、Tier view、回答保存RPC | schema/RLS/view/function/ACL一致 | A |

## 6. 本番schema照合の重要結果

### 一致したもの

- 調査対象33 tableはすべて本番に存在し、すべてRLS有効。
- maker 4表の列型/default/nullable、PK/FK/unique/checkはdraft定義と一致。
- `maker_events` の列、FK/check、3既存index、RLSは一致。
- `maker_tier_aggregates` と `maker_selection_aggregates` はローカル定義と一致。ACLはpostgres/service_roleのみ。
- `save_maker_submission`, `record_maker_event`, `record_maker_page_view`, `maker_event_stats`, `maker_event_stats_v2` は引数・戻り値・SECURITY DEFINER・`search_path=public`・service_roleのみEXECUTEが一致。
- レビュー、記事、投票、Typefully、通報、問い合わせ等の対象index・constraint・policy・triggerは、後続migrationで意図的に削除されたものを除いて存在。

### 不一致・未適用

- `admin_maker_project_stats(timestamptz)`: 本番に存在しない。
- `maker_events_created_project_type_idx`: 本番に存在しない。
- `maker_submissions_updated_project_valid_idx`: 本番に存在しない。
- SPR固定カード・企画紐付け: 0/5。
- カテゴリ正規化data migration: 未適用状態。
- 日次図鑑auto-lock解除: 現在値だけでは適用履歴を確定不能。
- `zukan_articles_one_published_per_target_idx` は存在しないが、これは `20260709_remove...` の期待結果であり不一致ではない。

## 7. PR #551の依存関係

| 依存対象 | 作成元 | 本番状態 |
|---|---|---|
| `maker_projects` | `drafts/20260712_maker_tier.sql` / remote `20260712140743` | 一致 |
| `maker_project_cards` | 同上 | 一致 |
| `maker_submissions` | 同上 | 一致 |
| `maker_submission_items` | 同上 | 一致 |
| `maker_events` | `20260713_maker_events.sql` | 履歴なし・schema一致 |
| Tier集計view | `drafts/20260712_maker_tier.sql` | 一致 |
| 選択集計view | `20260713_hall_of_fame_release_maker.sql` | 履歴なし・定義一致 |
| makerイベント登録RPC | `20260713_maker_events.sql` → acquisition版で更新 | 履歴なし・最新版一致 |
| maker回答保存RPC | `drafts/20260712_maker_tier.sql` | 一致 |
| `is_valid` | maker_tier | boolean, not null, default true |
| `project_id` | maker_tier / maker_events | uuid, not null, FK一致 |
| `event_type` | maker_events + page_views | text, not null,8種check一致 |
| `created_at` | maker基盤各表 | timestamptz, not null, default now() |
| `updated_at` | projects/submissions | timestamptz, not null, default now() |

PR #551の分析RPCはこれら既存実体へ安全に依存できる。しかしmigration履歴が壊れた状態なので、CLI経由の単独適用は不可。

## 8. schema diff概要

「本番schema」対「active migration群が最終的に期待するschema」の確認できた差分:

```text
+ INDEX maker_events_created_project_type_idx
    ON maker_events(created_at, project_id, event_type)
+ INDEX maker_submissions_updated_project_valid_idx
    ON maker_submissions(updated_at, project_id) WHERE is_valid
+ FUNCTION admin_maker_project_stats(timestamptz)
    RETURNS TABLE(...15 columns...)
    SECURITY DEFINER SET search_path=public
    EXECUTE: service_role only
```

schema外のdata差分:

```text
+ DM26-EX2 SPR cards 5 rows
+ maker_project_cards links 5 rows
? category normalization (未適用だがPR #551非依存)
? daily-zukan auto_lock_exempt update (現状態から履歴判定不能、PR #551非依存)
```

本番schema dump、ローカルshadow schema、機械的diffは未保存。理由はpg_dump/shadow DBに必要なDockerがないため。秘密情報や接続文字列をファイルへ保存する代替は採用しなかった。

## 9. 修復案比較

### 案A: 完全適用済みmigrationだけをappliedとして履歴修復

- メリット: 既存ファイルを残しやすく、個々のmigration由来を追える。
- リスク: 同一8桁versionが複数あり、1ファイル単位でrepairできない。本番8件は14桁versionなので対応しない。data-only migrationは完全適用判定が難しい。誤ってappliedにすると未適用DDLが永久に飛ばされる。
- 必要コマンド（将来、承認後のみ）: `supabase migration fetch`、ファイルtimestamp正規化、全定義再照合後に限定的な `supabase migration repair --status applied <version>`。
- rollback: repair前の履歴一覧を保存し、誤ったversionだけ `--status reverted`。schema rollbackではない。
- 今後のdb push: version正規化が完全なら利用可能。現状のままでは不可。
- PR #551まで: 全35件のversion再設計が必要で最短ではない。

評価: **非推奨**。

### 案B: 本番schema基準のbaselineを新規作成し、以降をCLI管理

- メリット: 現在動いている本番を正とし、重複8桁versionと手動適用履歴を一度で切り離せる。将来のrebuild・diff・db pushの基準が明確になる。
- リスク: baseline生成時点のschema取り漏れ、auth/storage/extensionsの扱い、データseedの分離が必要。baselineを本番へ再実行してはいけない。
- 必要コマンド（将来、承認後のみ）:
  1. Docker/pg_dumpを用意し `supabase db dump --linked --schema-only`。
  2. `supabase migration fetch` で既存8履歴を保存。
  3. 旧8桁migrationを `legacy/` へ退避し、14桁versionだけのclean directoryを別ブランチで作成。
  4. 本番dumpをレビューしてbaseline SQLを作る。
  5. 空の検証DBへbaselineを適用し、本番catalogとdiff 0を確認。
  6. 明示承認後、baseline version 1件だけを履歴上appliedへrepair。
- rollback: repair前のmigration履歴dumpを保存。baseline versionをrevertedへ戻し、旧ディレクトリへ戻す。本番schema/dataは変更しない。
- 今後のdb push: baselineより後の一意な14桁timestamp migrationだけが適用対象になり、正常化しやすい。
- PR #551まで: baseline確定後、analytics SQLを新しい一意timestamp migrationとして追加し、dry-run→適用。

評価: **推奨**。

### 案C: 不足schemaだけ追補migrationにし、過去履歴には触れない

- メリット: PR #551の不足3オブジェクトだけならSQLが小さく、rollbackも簡単。
- リスク: remote-only 8件とlocal-only多数の履歴不一致が残り、`db push`は引き続き停止する。手動適用すると履歴に残らず二重適用判断が将来必要。SPR dataも別管理になる。
- 必要コマンド: 新しい14桁timestampの追補SQLを作り、Dashboard SQL Editor/psql/`supabase db query --file`で手動実行（現時点では禁止）。
- rollback: analytics functionと2 indexを明示DROP。SPRを追加した場合、既存回答との関係上、安易なDELETE rollbackは禁止。
- 今後のdb push: 改善しない。別途baselineが必要。
- PR #551まで: 緊急公開は可能だが、技術的負債を固定する。

評価: **緊急時のみ**。

### 案D: 新しいSupabase projectで正規化して切替

- メリット: cleanなmigration履歴をゼロから検証できる。
- リスク: auth user、Storage、接続先、データ移行、停止時間、Vercel env切替のリスクが最も大きい。
- 必要コマンド: schema/data/auth/storageの移行計画と段階的切替。単純なCLIコマンドだけでは不可。
- rollback: Vercel接続先を旧projectへ戻す。ただし切替後writeの差分同期が必要。
- 今後のdb push: 新projectでは正常化できる。
- PR #551まで: 過剰で遅い。

評価: **非推奨**。

## 10. 推奨案

**案B（本番schema基準baseline）を推奨する。**

理由:

1. 問題は「数件のapplied漏れ」ではなく、8桁重複version・14桁remote version・draftにある本番migration・active外のremote migrationが混在する構造不整合である。
2. 案Aでは同一versionの複数ファイルを安全に区別できない。
3. 本番schemaは現在動作しており、maker依存も定義一致している。本番をcanonical baselineにするのが最も事故が少ない。
4. baselineを空DBで再現してdiff 0を確認してから履歴だけを1件修復すれば、本番schema/dataへ触れずにCLI管理を再開できる。

## 11. PR #551 migrationの単独適用可否

### Dashboard SQL Editor

- schema上は適用可能。RPCは現在不存在、indexは `IF NOT EXISTS`、functionは `CREATE OR REPLACE` で再実行耐性がある。
- ただしmigration履歴へ記録されず、将来のbaseline/追補migrationと二重管理になる。
- rollbackは `DROP FUNCTION public.admin_maker_project_stats(timestamptz)` と2 indexのDROP。データ変更なし。
- 現時点の判定: **実行しない**。

### `supabase db execute`

- 使用中CLI v2.90.0には同subcommandがない。相当するのは `supabase db query --linked --file ...`。
- query実行は履歴を記録しないためSQL Editorと同じ問題を持つ。
- 現時点の判定: **実行しない**。

### psql

- transactionで単独適用できるが、履歴を記録しない。
- 接続文字列管理のリスクも増える。
- 現時点の判定: **実行しない**。

### 一意なtimestampへリネームして適用

- リネーム自体は必要だが、remote8件がローカルにないため`db push`はその前に停止する。
- SQL Editorでリネーム後SQLを手動適用しても履歴は残らない。
- baseline正常化後に新timestamp migrationとして適用するのは安全。
- 現時点の判定: **baseline後なら可、現在は不可**。

### 二重適用リスク

- 2 indexは同名 `IF NOT EXISTS` なので物理二重作成は避けられる。
- functionは置換されるため二重実行はエラーになりにくいが、将来別定義を上書きする危険がある。
- migration履歴なしの手動適用後、同SQLがCLI適用されても大半は成功するが、「いつ・どの定義が正か」が不明になる。運用上の二重適用リスクは残る。

総合判定: **PR #551を現時点で単独適用してよいとは判断しない。** schema単体の危険は低いが、履歴正常化を優先する。

## 12. 安全な最短手順（実行前計画）

1. Docker Desktopまたは安全な`pg_dump`実行環境を用意する。
2. 本番のschema-only dumpとmigration履歴を保存する（秘密値なし）。
3. `supabase migration fetch`でremote8件を正しい14桁versionとして取得する。
4. 旧8桁active migrationを適用対象外の`legacy/`へ移し、履歴資料として保持する。
5. 本番schemaからbaselineを作成し、空の検証project/DBへ適用する。
6. 本番と検証DBのtable/column/default/constraint/index/function/view/RLS/policy/trigger diffが0であることを確認する。
7. baseline履歴repairの対象version 1件、事前・事後migration list、rollbackコマンドを提示し、明示承認を得る。
8. baselineを履歴上appliedへ修復する（schemaは変更しない）。
9. `20260713_admin_maker_analytics.sql`を新しい一意な14桁timestampへ移し、SPR 5枚は別migrationに分離する。
10. `db push --dry-run`でanalytics migrationだけがpendingになることを確認する。
11. 改めて承認後にanalytics migrationを適用し、RPC/権限/index/実データ/Previewを検証する。
12. PR #551のDraft解除・mergeは全検証後のみ。

## 13. rollback計画

- 履歴修復: repair前migration一覧とbaselineファイルを保存し、baseline versionのみrevertedへ戻す。旧migrationディレクトリを復元する。本番schema/dataは触らない。
- analytics DDL: functionと追加2 indexだけを逆migrationでDROPする。table/dataは変更しない。
- SPR data: 回答や企画参照が生じうるためDELETE rollbackを標準手順にしない。非表示/企画カード除外など別途データ保全設計が必要。
- コード: Vercelを直前deploymentへrollbackする。DB履歴・schema rollbackとは分離する。

## 14. 判断用まとめ

1. **本番に実体があるのに履歴だけないmigration**: activeのB分類28件（x_posts系、avatar、moderation、site settings、campaign、contact、daily zukan、reports、Typefully、spam、thumbnail、kakolog、x buzz、zukan articles、polls、admin consented、hall card sync、maker events/acquisition/page views、hall maker等）。
2. **本番に実体も履歴もないmigration**: `20260713_admin_maker_analytics.sql`のRPC+2 index、`20260713_add_dm26_ex2_spr_cards.sql`の5カード+5紐付け。カテゴリ正規化data migrationも期待状態になっていない。
3. **一部だけ適用されているmigration**: schema DDLでCと確定したものは0件。`daily_zukan_remove_auto_lock_exempt`は現在値がfalse 9 / true 10でF。
4. **履歴修復だけで済むmigration**: B分類のschema migration。ただし重複versionのため個別repairではなくbaselineへ統合するのが安全。
5. **新規SQL適用が必要なmigration**: PR #551のanalytics RPC+2 index。SPR 5枚は別のdata migrationとして必要。カテゴリ正規化・daily-zukan更新はPR #551から分離して再判断する。
6. **PR #551を単独適用してよいか**: 現時点では不可。SQL単体は比較的再実行安全だが、履歴をさらに乖離させる。
7. **最も安全な次の1手**: Docker/pg_dump環境を用意し、本番schema-only dumpとremote migration fetchを取得したうえで、空DB検証可能なbaseline候補を作る。まだrepairも適用もしない。

## 15. baseline候補作成結果

作成ファイル:

- `supabase/baselines/20260713193000_production_schema_baseline.sql`
- `supabase/baselines/README.md`

`supabase/baselines/` は通常のCLI migration対象外である。既存 `supabase/migrations` は上書き・削除・移動していない。

### schema-only dump取得

- 公式 `supabase db dump --linked --schema public` はDocker Desktopがなく実行不能。
- ローカル`pg_dump`、利用可能なWSL distroも存在しない。
- 代替として `supabase db query --linked` で本番`pg_catalog`を読み、DDLをschema-only baseline候補へ再構成した。
- 生成結果: 904ステートメント、115,498文字（commit時は改行差でbyte数が変動しうる）。
- 範囲: extensions 3、sequence 12、table 42、constraint 142、非constraint index 70、function 15、view 2、RLS 42、policy 50、trigger 8、relation/function ACL。
- table data、`INSERT`/`UPDATE`/`DELETE`/`COPY`/`TRUNCATE`は含まない。function本体内のDMLは本番function定義そのものなので含む。

### migration fetch

既存migrationを保護するため `.codex-tmp-supabase-baseline/` を独立workdirとして初期化し、8件を取得した。

| fetched file | SHA-256 |
|---|---|
| `20260521122214_add_x_post_source_columns.sql` | `77ea820d5199ef1ca02ae07f887c395de53d88ff59351bcd99ecda6023f1bca0` |
| `20260524105613_add_is_protected_to_threads.sql` | `91ec6d69b0bedea64560c74b1d83abff506acb6a64d08955d81258c52fdfc73d` |
| `20260610111649_zukan_packs_cards.sql` | `585b6d0eb46cc7df2e17bab315c7726fc70e85eeede372b4e640117b024e45a2` |
| `20260611233908_zukan_reviews.sql` | `0a995d1f4b55fca6291fe181c4b48a9597c6afffd5234bda2f57b29f16e56316` |
| `20260611235153_fix_rating_constraint.sql` | `709e2c9d5ef9ac113059942ed6426069c8ebcfd76c8c612e021ce49c8c4028c3` |
| `20260612025342_zukan_admin_features.sql` | `ee0de724ba246e66e86b1ee48823c1a0e211831e5458a6910317deb3109ee70c` |
| `20260712140652_20260711_cards.sql` | `437ad388def003d9ef835937b561fbf63a8f4bcae07cca1a89c8d710fb9d2ad3` |
| `20260712140743_20260712_maker_tier.sql` | `def6ebe3bef0dd576889ee46b3389a73f8b1f417fe93c3ca2686b3959228ddfc` |

### baselineと本番schemaの対応

| 対象 | baseline | 本番 | 備考 |
|---|---:|---:|---|
| public table | 42 | 42 | catalogから直接生成 |
| public sequence（非identity） | 12 | 12 | identity内部sequenceはtable定義へ統合 |
| constraint | 142 | 142 | PK/FK/unique/checkを含む |
| 非constraint index | 70 | 70 | partial条件は`pg_get_indexdef`を使用 |
| function | 15 | 15 | 引数・戻り値・SECURITY DEFINER・search_pathを定義に保持 |
| view | 2 | 2 | `pg_get_viewdef`を使用 |
| RLS有効table | 42 | 42 | 全対象table |
| policy | 50 | 50 | role/command/using/with checkを保持 |
| trigger | 8 | 8 | 内部triggerを除外 |

### baselineから明示的に除外

- 全table dataとseed。
- `20260713_add_dm26_ex2_spr_cards.sql` のSPRカード5件・企画紐付け5件。
- category normalization、daily-zukan auto-lock更新、図鑑seedなどのdata migration。
- `admin_maker_project_stats(timestamptz)`。
- `maker_events_created_project_type_idx`。
- `maker_submissions_updated_project_valid_idx`。
- migration履歴tableのINSERT/UPDATE。

### 静的検証

- トップレベルdata DML: 0。
- 危険なトップレベルDROP: 0。
- table/sequence/index/viewの重複CREATE key: 0。
- PR #551未適用RPC/index、SPR固定UUIDの混入: 0。
- identity sequenceはtableの`GENERATED ... AS IDENTITY`へ任せ、別CREATE SEQUENCEとの重複を除外した。
- 未完了: Docker/Postgresを使った空DB適用、依存順・構文実行、公式pg_dumpとのdiff。

### baseline後の履歴修復コマンド案（未実行）

前提として、remote8件とbaselineだけを含むclean migration directory、空DB再現成功、明示承認が必要。

```powershell
npx.cmd supabase migration repair --linked --status applied 20260713193000
npx.cmd supabase migration list
npx.cmd supabase db push --dry-run --linked
```

rollback:

```powershell
npx.cmd supabase migration repair --linked --status reverted 20260713193000
npx.cmd supabase migration list
```

現時点ではbaseline候補を本番適用してはいけない。空DB検証と公式schema dump比較が未完了である。
