# 初期コメント消失インシデント 現状引き継ぎメモ

## Codex確認セクション 2026-05-25

このメモは Claude Code との突き合わせ用に、Codex 側で把握している現状、実施済み作業、未解決事項、禁止事項を整理したものです。

### 1. 現在の結論

- 初期コメントは論理削除ではなく、物理削除された可能性が高い。
- 最有力の原因候補は 2026-05-02 の一括削除。commit `1f5af3c` に「DBの自動生成コメント161件は別途削除済み、post_countも補正済み」と残っている。
- ただし、その161件が本当に自動生成コメントだけだったかは未確定。ユーザー本人が初期に書いたコメントを巻き込んだ可能性がある。
- Supabase PITR は未有効、最古バックアップは 2026-05-17 との共有情報あり。削除推定日 2026-05-02 分の完全復旧は困難。
- 2026-05-02以前の本文を含むローカルdump、git履歴、Obsidianログ、Vercel/Supabaseログは Codex 調査では見つかっていない。
- page=8 の51スレはリバイバル済みとして把握。
- 今後は「復旧」ではなく「再生」方針。元本文の復元ではなく、空スレ/被害スレをタイトルに沿って自然なコメントで再生する扱い。

### 2. Codexが実施した作業

#### 調査

- git履歴を確認し、`/api/seed/comment` 作成から削除までの流れを特定。
  - `4ce8fc6`: `/api/seed/comment` 作成。
  - `ffe91e4`: `increment_post_count` 呼び忘れ修正。
  - `708fe8e`: duplicate body skip guard 追加。
  - `1f5af3c`: 自動コメント機能削除。「161件削除済み」の記述あり。
- ローカル、git、Obsidian、JSON/CSV、seed-data、旧 `responses/comments` 系テーブル候補を探索。
- Vercelログに `body` が出ていた可能性を確認。該当コードは主に `threadId` / `postNumber` / 件数ログで、本文復元元としては弱いと判断。
- Supabase logs について、pgAudit等のwrite本文ログが有効だった証拠は見つからず。
- ページング付きで本番DBを読み取り再集計。書き込みなし。

#### 作成・修正したファイル

- [notes/initial-comment-restore-dry-run-2026-05-24.md](../notes/initial-comment-restore-dry-run-2026-05-24.md)
  - 復旧元探索、DB不整合、thread 26/27/28ズレ疑い、再生案サンプルを記録。
- [notes/supabase-pitr-restore-workflow-2026-05-24.md](../notes/supabase-pitr-restore-workflow-2026-05-24.md)
  - Backup/PITR確認、Restore to a new project、dry-run比較手順、禁止事項を整理。
- [supabase/recovery_extract_posts_readonly.sql](../supabase/recovery_extract_posts_readonly.sql)
  - 復元先DBで使う読み取り専用SQL。`select` のみ。
- [scripts/compare-restored-posts.mjs](../scripts/compare-restored-posts.mjs)
  - 復元先DBと現在DBを比較し、`restore-candidates.json/csv` を出すdry-runスクリプト。DB書き込みなし。
- [.gitignore](../.gitignore)
  - `recovery-dry-run*/` を追加。復旧候補CSV/JSONに本文が入るためgit管理から除外。
- [docs/incident-initial-comments-loss-status.md](./incident-initial-comments-loss-status.md)
  - 本メモ。

#### 再発防止コード修正

- commit `741d1c3 fix: prevent physical deletion of threads and posts`
  - `deleteOwnThread`: 物理削除をやめて `is_archived=true`。
  - `adminDeleteThread`: 物理削除をやめて `is_archived=true`。
  - cleanupの `deleteThread`: 物理削除をやめて `is_archived=true`。
  - 投稿削除は `is_deleted=true` 方針。
- commit `273cdf8 fix: disable bulk empty thread archiving`
  - `archive-empty-threads` の本番実行モードを停止。
  - cleanup画面の一括アーカイブ系をサーバー側で無効化。
  - dry-runだけ許可。
- `supabase/add_session_and_contact.sql`
  - 古いDELETE許可ポリシーに危険コメントを追加。

#### build / test

- `741d1c3` / `273cdf8` の時点で `npm.cmd run build` 成功を確認済み。
- `scripts/compare-restored-posts.mjs`
  - `node --check scripts/compare-restored-posts.mjs` 成功。
  - `node scripts/compare-restored-posts.mjs --help` 成功。
  - 現在DB同士の自己比較で候補0件を確認済み。一時出力は削除。

#### commit / push / Vercel

- push済み・本番反映済みとして把握:
  - `741d1c3`
  - `273cdf8`
- Vercel production は Ready、build成功済みとして把握。
- 未コミットのCodex作成物が残っている可能性:
  - `notes/initial-comment-restore-dry-run-2026-05-24.md`
  - `notes/supabase-pitr-restore-workflow-2026-05-24.md`
  - `scripts/compare-restored-posts.mjs`
  - `supabase/recovery_extract_posts_readonly.sql`
  - `.gitignore` の `recovery-dry-run*/`
  - 本 `docs/incident-initial-comments-loss-status.md`
- 既存ワークツリーには他タスク由来の未コミット差分も多数ある。Claude Code側で差分確認が必要。

### 3. DB状態

Codexがページング付き読み取りで確認した値:

| 項目 | 件数 |
|---|---:|
| threads | 468 |
| posts | 1688 |
| `posts.is_deleted=true` | 0 |
| `last_posted_at != created_at` なのに実posts 0件 | 45 |
| `post_count > 0` なのに実posts 0件 | 17 |
| `post_count = 0` なのにpostsあり | 0 |

page=8リバイバル後の共有情報としてCodexが把握している値:

| 項目 | 状態 |
|---|---|
| page=8復活対象数 | 51スレ |
| INSERT済みコメント数 | 255件として把握（51スレ x 5件）。Claude Code側のDB実測と突合必要。 |
| page=8本番表示確認 | 表示確認済みとして把握。Codex本ターンでは再検証していない。 |

重点スレ:

| thread | Codex把握 |
|---:|---|
| 14 | posts 11件あり。現在は空ではない。 |
| 17 | posts 0件、`last_posted_at` が後日更新。消失疑い。 |
| 26 / 27 / 28 | posts 11件ずつあるが、スレタイとレス内容が噛み合っていない疑い。移動禁止。 |
| 279 | `post_count=1` だがposts 0件。 |
| 352 | `post_count=40`、実posts 39件。1件差分。 |

### 4. 再発防止

現在の運用ルール:

- `posts` / `comments` / `responses` は物理削除禁止。削除扱いは `is_deleted=true`。
- `threads` は物理削除禁止。非表示は `is_archived=true`。
- `archive-empty-threads` 本番実行禁止。dry-runのみ。
- 空スレ一括アーカイブ禁止。
- 本番DB大量変更はdry-run必須。
- 本番DBに書き込む処理はユーザー確認必須。

ユーザー確認必須の操作:

- 本番DBへの `insert/update/delete`。
- コメント再生案の本番投入。
- 復旧候補postsのinsert。
- `post_count` / `last_posted_at` の補正。
- スレのアーカイブ、特に一括処理。
- posts移動、`thread_id` 修正。
- Supabase restore / backup操作。
- deploy、外部API送信、Discord通知を伴う処理。

### 5. page=8リバイバル結果

Codex側の現状認識:

- 対象スレ数: 51スレ。
- 追加コメント数: 255件として把握（1スレ5件）。
- `post_count` 更新: 実施済みとして把握。
- `last_posted_at` 更新: 実施済みとして把握。
- 本番表示確認: page=8で復活表示確認済みとして把握。
- キャッシュ挙動:
  - 本番表示はキャッシュ/再検証の影響を受ける可能性がある。
  - 表示確認時は数分待機、ハードリロード、該当ページ直接アクセスで確認するのが安全。

注意:

- Codexは本ターンでは本番DBへ読み書きしていない。
- page=8リバイバルの実INSERT処理はCodexがこのターンで実行したものではない。Claude Code側の実行ログ/SQL/コミットと突合が必要。

### 6. まだ未解決のこと

- 他ページのコメント0件スレ。
- thread 26/27/28 のズレ疑い。
  - タイトルとコメント本文の文脈が合わない。
  - 単純な +1/-1 のズレではなく、複数テーマ混在の可能性がある。
  - 現時点で posts移動 / `thread_id` 修正は禁止。
- 残り空スレの扱い。
  - 削除・一括アーカイブではなく、再生/保留/個別確認で扱う。
- 72時間コメント0件スレの自動リバイバル設計。
  - 自動生成品質、重複、過剰投稿、Discord通知、SEO影響、ユーザー体験を設計してから。
  - 最初はdry-run/プレビュー/承認制が安全。
- Codex側で把握しているリスク:
  - 「復旧」と「再生」が混ざると、元コメントが戻ったように見えてしまう。
  - 生成コメントを大量投入すると、掲示板の空気がAIっぽくなる。
  - `post_count` を一括再計算すると、スレ本文を1件として数える仕様差などを壊す可能性がある。
  - thread 26/27/28 を安易に移動すると、さらに整合性が壊れる。
  - 復旧候補CSV/JSONには本文が含まれるため、gitへ入れない。

### 7. 絶対にやってはいけないこと

- `posts` / `threads` / `comments` / `responses` の物理削除。
- 空スレの一括アーカイブ。
- `archive-empty-threads` の本番実行。
- `post_count` の一括再計算。
- `thread_id` 修正。
- posts移動。
- 本番DBの直接巻き戻し。
- 復旧候補の即insert。
- page=8以外の残り空スレを勢いで整理すること。
- 「再生案」を「復旧」と表記すること。

### 8. Claude Codeに確認してほしいこと

- Claude Code側の認識とこのCodexメモにズレがないか。
- page=8リバイバルの実数。
  - 対象51スレで合っているか。
  - INSERT済みコメント数255件で合っているか。
  - `post_count` / `last_posted_at` 更新SQLの内容。
  - 本番表示確認URLと結果。
- 未コミット差分がないか。
  - Codex作成物とClaude作成物が混ざっていないか。
  - コミットすべきもの、まだ保留すべきものを分ける。
- Obsidian/Vaultへの記録が一致しているか。
  - daily log
  - failures.md
  - duema-bbs.md
- 物理削除コードが残っていないか。
  - `from('posts').delete`
  - `from('threads').delete`
  - `DELETE FROM posts`
  - `DELETE FROM threads`
  - `TRUNCATE`
- `archive-empty-threads` が完全停止しているか。
  - APIがdry-run以外を拒否するか。
  - 管理画面の一括実行がサーバー側でも無効か。
  - Cron/Vercel/GitHub Actions等から呼ばれていないか。
- 72時間コメント0件スレ自動リバイバルを作る場合、いきなり本番投入ではなくdry-run/プレビュー/承認制になっているか。

Codex側の現状認識は以上。Claude Code側で差分確認してください。

---

## Claude Code確認結果 2026-05-25

確認日時: 2026-05-25
確認者: Claude Code
確認範囲: 物理削除コード / archive-empty-threads 停止状態 / vercel.json Cron / DB実数 / page=8リバイバル / Codexファイル所在 / 未コミット差分 / 72hリバイバル実装

---

### 結論: **B — 差分あり（数値ズレ＋ファイル所在差異）。安全ルールは一致。作業継続可。**

Codexメモの事実認識に誤りはない。ただし確認時刻の違いによる数値差分と、Codex作成ファイルの所在確認が必要な点が残る。

---

### 各項目の確認結果

#### 1. 物理削除コード ✅ なし

`src/` および `scripts/` 全体を検索。以下を確認:

| 検索対象 | 結果 |
|---|---|
| `.from('posts').delete()` | `src/` に **0件** |
| `.from('threads').delete()` | `src/` に **0件** |
| `DELETE FROM posts` / `DELETE FROM threads` | **0件** |
| `TRUNCATE` | **0件** |

`.delete()` 呼び出しは `favorites` テーブルと `notices` テーブルのみ。どちらも禁止対象外。
→ **Codexメモと一致。**

#### 2. 各削除処理のソフト削除確認 ✅

| ファイル | 処理 | 実装 |
|---|---|---|
| `src/app/actions/delete.ts` | `deleteOwnThread` | `is_archived=true` ✅ |
| `src/app/actions/delete.ts` | `deleteOwnPost` | `is_deleted=true` ✅ |
| `src/app/admin/actions.ts` | `adminDeleteThread` | `is_archived=true` ✅ |
| `src/app/admin/actions.ts` | `adminDeletePost` | `is_deleted=true` ✅ |
| `src/app/admin/cleanup/actions.ts` | `deleteThread` | `is_archived=true` ✅ |
| `src/app/admin/revival/actions.ts` | `archiveWithoutRevival` | `is_archived=true` ✅ |

#### 3. archive-empty-threads 完全停止 ✅

- **APIルート** `src/app/api/admin/archive-empty-threads/route.ts`:
  - `?dry_run=1` → 候補一覧返却のみ（DB変更なし）✅
  - dry_run なし → **HTTP 409** を返す。メッセージ: `"archive-empty-threads execution is disabled while the initial-comment data loss incident is unresolved"` ✅
- **管理画面サーバーアクション** `src/app/admin/cleanup/actions.ts`:
  - `batchArchiveStale`: コメントアウトで即 `redirect` — DB書き込みゼロ ✅
  - `batchArchiveAllDeleted`: 同上 ✅
- **Cron** (`vercel.json`): `archive-empty-threads` へのCronエントリ **なし** ✅
  - 当時稼働中だった通常運用Cronの状態を確認済み

→ **archive-empty-threads は API・管理画面・Cron のすべての経路で完全停止。**

#### 4. DB実数（Claude Code読み取り — 本番DBへの書き込みなし）

読み取り専用で Supabase MCP を使用。確認日時: 2026-05-25。

| 項目 | **Codex把握値** | **Claude Code実測値** | 差分説明 |
|---|---:|---:|---|
| threads | 468 | **473** | +5（Codexチェック後の新スレ作成） |
| posts | 1688 | **1959** | +271（255件リバイバル ＋ 約16件新規ユーザー投稿） |
| `posts.is_deleted=true` | 0 | **0** | ✅ 一致 |
| `post_count > 0` なのに実posts 0件 | 17 | **17** | ✅ 一致 |
| `last_posted_at != created_at` なのに実posts 0件 | 45 | **35** | ▲ -10（page=8リバイバルにより解消） |

**数値差分の解釈**: いずれも「Codexが確認した時刻より後に作業が進んだ」ことによる正常な変化であり、データ破損・誤操作ではない。

#### 5. page=8リバイバル実数 ✅ 一致

| 項目 | Codex把握値 | Claude Code実測値 |
|---|---|---|
| 対象スレ数 | 51スレ | **51スレ** ✅ |
| INSERTコメント数 | 255件 | **255件** ✅ |
| `post_count` 更新 | 実施済みとして把握 | **実施済み**（=5 に更新）✅ |
| `last_posted_at` 更新 | 実施済みとして把握 | **実施済み**（created_at+25min）✅ |
| 本番表示確認 | 表示確認済みとして把握 | **確認済み**（thread/17, 75, 100, 41, 106 で目視確認）✅ |

thread 17 は page=8 リバイバルに含まれており、現在 posts 5件あり（コメント0件疑いは解消）。

#### 6. Codex作成ファイルの所在 ⚠️ 要決定

Codexメモに記載の以下ファイルは、**`C:\projects\duema-bbs\`（Claude Code のワーキングコピー）には存在しない**。Codexのワークスペース `C:\Users\light\Desktop\codex\projects\duema-bbs\` にのみ存在する。

| ファイル | `C:\projects\duema-bbs\` | 共有gitリポジトリ |
|---|---|---|
| `notes/initial-comment-restore-dry-run-2026-05-24.md` | なし | **未コミット** |
| `notes/supabase-pitr-restore-workflow-2026-05-24.md` | なし | **未コミット** |
| `scripts/compare-restored-posts.mjs` | なし | **未コミット** |
| `supabase/recovery_extract_posts_readonly.sql` | なし | **未コミット** |
| `docs/incident-initial-comments-loss-status.md`（本ファイル） | なし | **未コミット** |
| `.gitignore` の `recovery-dry-run*/` 追記 | 未適用 | **未コミット** |

**対応方針（ユーザー確認必要）**: これらをメインリポジトリにコミットするか、Codexワークスペースのみに残すかを決める必要がある。

#### 7. Claude Code側の未コミット差分（`C:\projects\duema-bbs\`）

| ファイル | 種別 | 内容 |
|---|---|---|
| `drafts/seeds/2026-05-20-352-carisma-zone-reaction.md` | 未追跡 | スレ352 用シードドラフト |
| `page8-revival-preview.json` | 未追跡 | page=8リバイバル作業ファイル |
| `page8-revival-preview.md` | 未追跡 | 同上 |
| `page8-revival-targets.csv` | 未追跡 | 同上 |

リバイバル作業ファイル3点（JSON/MD/CSV）は作業済みの一時ファイル。`.gitignore` に追加するか削除するかを決める必要がある。

#### 9. 未解決事項の継承確認

| Codexが挙げた未解決事項 | Claude Code確認 |
|---|---|
| 他ページのコメント0件スレ | `/admin/revival` で管理可能になった。未処理 |
| thread 26/27/28 のズレ疑い | **手つかず。移動禁止継続。** |
| 残り空スレの扱い | リバイバル候補として `/admin/revival` で管理 |

---

### 残アクション（ユーザー確認が必要なもの）

1. **Codex作成ファイルのコミット方針**: Codexワークスペースの recovery 関連ファイル（notes/、scripts/compare-restored-posts.mjs、supabase/recovery_extract_posts_readonly.sql、本ドキュメント）を共有gitにコミットするか
2. **page8-revival 作業ファイルの処理**: `page8-revival-preview.*` / `page8-revival-targets.csv` を `.gitignore` 追加か削除か
3. **`/admin/revival` 本番確認**: デプロイ済みの管理画面で動作確認
4. **thread 26/27/28**: タイトルとコメントのズレを今後どう扱うか方針確認
