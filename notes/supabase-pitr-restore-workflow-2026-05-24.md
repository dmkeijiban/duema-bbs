# Supabase Backup/PITR 復旧ワークフロー 2026-05-24

## 目的

初期コメント消失について、2026-05-02以前の `posts` を安全に救出できるか確認する。

この手順では本番DBを直接巻き戻さない。本番DBへの `insert/update/delete` もしない。

## Dashboardで確認する場所

1. Supabase Dashboardで本番プロジェクトを開く。
2. `Database > Backups` を開く。
3. 2026-05-02 14:25 JSTより前のdaily backupが残っているか確認する。
4. `Point in Time` または `Point in Time Recovery` を開く。
5. earliest/latest recovery point の範囲に 2026-05-02 14:25 JSTより前が含まれるか確認する。
6. `Restore to a New Project` タブ/導線が使えるか確認する。

## 分岐

### Backup/PITRあり

1. 本番DBは直接restoreしない。
2. `Restore to a New Project` で別プロジェクトへ復元する。
3. 復元先プロジェクトのURLとanon key、必要ならservice role keyを控える。
4. 復元先で外部実行系があれば無効化する。
   - Edge Functions
   - Webhooks
   - pg_cron
   - pg_net
   - 外部通知系
5. 復元先DBに対して [recovery_extract_posts_readonly.sql](../supabase/recovery_extract_posts_readonly.sql) を実行し、件数とposts内容を確認する。
6. ローカルで比較スクリプトを実行してdry-run候補だけ出す。

```powershell
$env:RESTORED_SUPABASE_URL="https://RESTORED_PROJECT.supabase.co"
$env:RESTORED_SUPABASE_KEY="RESTORED_ANON_OR_SERVICE_KEY"
node scripts/compare-restored-posts.mjs --out-dir recovery-dry-run
```

復元先の `.env.restored.local` を作る場合:

```powershell
node scripts/compare-restored-posts.mjs --restored-env .env.restored.local --out-dir recovery-dry-run
```

出力:

- `recovery-dry-run/restore-candidates.json`
- `recovery-dry-run/restore-candidates.csv`
- `recovery-dry-run/summary.json`

この段階では本番DBへは何も書き込まない。

### Backup/PITRなし

- 元コメント本文の完全復旧は困難として扱う。
- 空スレ削除/一括アーカイブはしない。
- 「復元」ではなく「再生案」と明記して、タイトルを元にコメント案を作る。
- DB投入前に必ずプレビュー確認を挟む。

## dry-run候補の見方

| column | 意味 |
|---|---|
| restore_candidate_id | dry-run上の候補ID |
| original_post_id | 復元先DBに残っていた元posts.id |
| thread_id | 復元先候補のthread_id |
| thread_title | 現在DB上のスレタイ |
| post_number | 元post_number |
| body_preview | 本文先頭プレビュー |
| body_full_exists | 本文が空でないか |
| name | author_name |
| created_at | 元created_at |
| source | `restored-supabase` |
| current_thread_exists | 現在DBに対象スレがあるか |
| current_posts_count | 現在DBの実posts数 |
| duplicate_risk | low / medium / high |
| restore_status | safe / needs_review / impossible |

## 復旧判断

- `safe`: そのまま復旧候補。ただしユーザー確認まではinsert禁止。
- `needs_review`: スレ不在、重複疑い、本文とスレタイ不一致などの確認が必要。
- `impossible`: 本文空など、そのまま復旧できない。

## 絶対禁止

- 本番DBを直接巻き戻す。
- 本番DBにpostsを即insertする。
- `posts` / `threads` / `comments` / `responses` を物理削除する。
- 空スレを一括アーカイブする。
- `post_count` を一括再計算する。
- postsを移動する。
- `thread_id` を修正する。
- `archive-empty-threads` を本番実行する。
