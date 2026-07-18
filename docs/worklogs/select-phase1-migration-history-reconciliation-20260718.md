# SELECT Phase 1 migration履歴整合監査

実施日: 2026-07-18 JST  
対象project: `nodgfukqvuwvgfnlzvnh`

## 結論

remote履歴11件はすべて本番実体またはremote保存SQLとの対応を確定できた。`migration repair` は不要。remoteから `migration fetch` したSQLを同じ14桁version/nameでactive migration directoryへ復元し、baselineに包含済みの旧8桁・重複ファイルは内容を変えず `supabase/legacy-migrations/` へ退避する。本番migration metadata、schema、ユーザーデータは変更しない。

## repair前主要件数

| relation | rows |
|---|---:|
| cards | 11,623 |
| maker_events | 867 |
| maker_projects | 2 |
| maker_submission_items | 569 |
| maker_submissions | 43 |
| posts | 7,245 |
| profiles | 88 |
| threads | 1,277 |

## remote-only 11件の監査

| version | name | remote | local/main | 本番実体 | 分類 | 推奨対応 | repair status | 根拠 | データ変更リスク |
|---|---|---|---|---|---|---|---|---|---|
| 20260521122214 | add_x_post_source_columns | あり | activeに同versionなし | 適用済み | remote適用済み・local欠落 | fetched SQLを復元 | 不要 | threads source系3列、partial unique index | ファイル復元のみ、なし |
| 20260524105613 | add_is_protected_to_threads | あり | activeに同versionなし | 適用済み | remote適用済み・local欠落 | fetched SQLを復元 | 不要 | threads.is_protected、archive index、id=22保護 | ファイル復元のみ、なし |
| 20260610111649 | zukan_packs_cards | あり | draftsに論理対応 | 適用済み | remote適用済み・active欠落 | fetched SQLを復元 | 不要 | zukan_packs/zukan_cardsとRLS | ファイル復元のみ、なし |
| 20260611233908 | zukan_reviews | あり | 8桁別versionあり | 適用済み | version違い重複 | remote版復元、旧版退避 | 不要 | review/rating 3表、index、policy | ファイル整理のみ、なし |
| 20260611235153 | fix_rating_constraint | あり | 8桁別versionあり | 適用済み | version違い重複 | remote版復元、旧版退避 | 不要 | user/anon unique constraint | ファイル整理のみ、なし |
| 20260612025342 | zukan_admin_features | あり | 8桁別versionあり | 適用済み | version違い重複 | remote版復元、旧版退避 | 不要 | admin note/memo/related tables | ファイル整理のみ、なし |
| 20260712140652 | 20260711_cards | あり | draftsに論理対応 | 適用済み | remote適用済み・active欠落 | fetched SQLを復元 | 不要 | cards table/index/RLS | ファイル復元のみ、なし |
| 20260712140743 | 20260712_maker_tier | あり | draftsに論理対応 | 適用済み | remote適用済み・active欠落 | fetched SQLを復元 | 不要 | maker 4表、RPC、view、RLS | ファイル復元のみ、なし |
| 20260713 | daily_zukan_remove_auto_lock_exempt | あり | 同version/nameあり | remote SQL取得済み、履歴適用済み | remote/local表現差 | remote版をactiveへ復元、旧版保存 | 不要 | remote statements MD5、daily-zukan現在値 | ファイル整理のみ、なし |
| 20260713193000 | production_schema_baseline | あり | baselines/に存在 | 908 statements、catalog diff 0確認済み | remote適用済み・active欠落 | remote版をactiveへ復元 | 不要 | 42 tables/142 constraints/70 indexes/15 functions/2 views/RLS/policy/ACL | baselineを本番実行しないためなし |
| 20260714160000 | anonymous_maker_submissions | あり | 14153000に論理対応、同versionなし | 適用済み | version違い重複 | remote版復元、14153000はremote履歴と整合する形で保持 | 不要 | anonymous owner 2列/index/RPC、remote 21 statements | ファイル整理のみ、なし |

## remote履歴の追加確認

- baseline `20260713193000` と analytics `20260713235000` は現在remote履歴に存在する。
- analytics RPCと2 indexも現在本番に存在する。
- `20260714153000`、`20260714183000`、`20260714210000`、`20260715100000`、`20260717080000` はremote metadata行のstatementsが空だが、対応する本番実体は存在する。これらは既存activeファイルを保持する。
- remote migration SQLは隔離ディレクトリ `.codex-tmp-migration-audit/` へ取得。接続情報・password・API keyは記録していない。

## 実行予定

1. remote fetch済み11ファイルを同名で `supabase/migrations/` へ復元。
2. baseline以前の旧8桁・重複migrationを削除せず `supabase/legacy-migrations/` へ移動。
3. remote履歴に存在せず後続migrationで置換済みの `20260715090000_fix_gennryoku_sougetsu_image.sql` もlegacyへ保存。
4. `supabase migration list --linked` を再取得。
5. `supabase db push --dry-run --linked` を実行し、SELECT migration以外がpendingでないことを確認。

初回整合確認で、Supabase CLIは8桁version `20260713` をlocal/remote双方に表示する一方、同一行として対応付けできずdry-runを拒否した。これはSQL/name差ではなく現行CLIの旧8桁version互換性によるもの。対象SQLはremoteから取得済みで、remote履歴上applied、本番のdaily-zukan対象値も確認済み。後続baseline `20260713193000` はappliedでschema catalog差分0である。

実行予定repairコマンド（1件のみ）:

```powershell
npx.cmd supabase migration repair --linked --status reverted 20260713
```

理由: 旧8桁履歴を現行14桁baseline以降の管理対象から外すmetadata-only修復。SQLは `supabase/legacy-migrations/` に保存し、本番schema/dataには再適用も巻き戻しも行わない。11件一括repairは行わない。

repair rollback（metadataのみ）:

```powershell
npx.cmd supabase migration repair --linked --status applied 20260713
```

## rollback

Git上のファイル移動・復元だけなので、commit前は移動を戻す。commit後はgit revertで戻す。本番migration metadata/schema/dataのrollbackは不要。

## 実施結果

- remote SQL 10件をactive migrationへ復元（旧8桁 `20260713` はlegacy保存）。
- 旧migration 35件を削除せず `supabase/legacy-migrations/` へ退避。
- 実施repair: `npx.cmd supabase migration repair --linked --status reverted 20260713` の1件のみ。
- repair後remote/local: baseline以降を含む20件が一致。pendingはSELECT型 `20260718150000` のみ。
- 通常dry-run: 成功。表示は `Would push these migrations: 20260718150000_select_maker_phase1.sql` のみ。
- repair前後の主要件数: 全8 relationで一致。
- 本番schema/data DDL/DML: 実施なし。
- schema差分: metadata repairのみのためなし。既存RPC/indexはrepair前後とも存在。
