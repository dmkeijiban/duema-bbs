# コメントゼロスレ リバイバル 運用ルール

> 最終更新: 2026-05-25  
> 背景: 2026-05-02 自動コメント物理削除事故を受けた再発防止・運用方針

---

## 🔴 絶対禁止ルール（例外なし）

### 物理削除は禁止

| 禁止操作 | 代替操作 |
|---|---|
| `DELETE FROM posts` | `UPDATE posts SET is_deleted=true` |
| `DELETE FROM threads` | `UPDATE threads SET is_archived=true` |
| `supabase.from('posts').delete()` | `supabase.from('posts').update({is_deleted:true})` |
| `supabase.from('threads').delete()` | `supabase.from('threads').update({is_archived:true})` |

**理由:** 2026-05-02 に自動コメント 161 件を物理削除した結果、復旧に人力 255 件 INSERT が必要になった。
物理削除した証拠は永久に消えるため、ソフトデリートを必ず使う。

### 大量変更はかならず dry-run 先行

- 本番 DB への大量 INSERT / UPDATE は必ず preview ファイルを出力してからユーザー確認を得る
- ユーザーが "OK" と言うまで本番 insert は実行しない
- preview ファイルは `revival-preview-YYYY-MM-DD/` に保存する

### ゼロコメントスレを即アーカイブ・削除しない

- コメントゼロのスレッド = リバイバル候補として扱う
- `post_count` だけで判断しない。`is_deleted=false` の実コメント数を必ず確認する
- PostgREST 1000 行上限に注意: `.limit(100000)` を明示しないと途中で切れる

---

## ♻️ 72時間コメントゼロスレ リバイバル フロー

### 検出条件

以下をすべて満たすスレが対象:

1. `threads.created_at` が 72 時間以上前
2. 有効コメント数 = 0（`posts.is_deleted=false` の件数）
3. `threads.is_archived = false`
4. `threads.is_protected = false`
5. 固定スレ・管理者保護スレではない

### 標準手順（必ず守る）

```
① 対象スレ検出
   └─ generate-empty-thread-revival.mjs を実行

② 対象 ID 一覧をファイルに固定
   └─ revival-preview-YYYY-MM-DD/targets.csv に出力

③ スレタイトル・本文・カテゴリ取得

④ animanch / 既存ソースを参照

⑤ 1スレ5件コメント生成
   └─ ANTHROPIC_API_KEY が設定されていれば自動生成

⑥ preview を CSV / JSON / Markdown で出力
   └─ revival-preview-YYYY-MM-DD/ に保存

⑦ バリデーション（後述）

⑧ Discord / 管理画面で通知

⑨ 管理者が内容確認・承認（admin/revival でプレビュー表示）

⑩ 承認後のみ insert-approved-revival-comments.mjs を実行

⑪ 本番表示を目視確認（キャッシュ期限後に2回アクセス）
```

### コメント生成ルール

- 必ず **5件** 生成する（4件以下は失敗とみなす）
- 自然なデュエマ掲示板口調で書く
- AI っぽい説明文・箇条書きは使わない
- スレタイトルに沿った内容にする
- 根拠なく特定カードを断定しない
- 現在の相場・環境を断定しない（「〜かな？」「〜じゃない？」などの疑問形を使う）
- `#res数字` は使わない
- HTML タグ・URL フラグメントは使わない
- コメントを使いまわし（コピペ）しない
- 実在人物への批判はしない

### タイムスタンプルール

```
コメント1: thread.created_at + 5 分
コメント2: thread.created_at + 8 分
コメント3: thread.created_at + 12 分
コメント4: thread.created_at + 18 分
コメント5: thread.created_at + 25 分
threads.last_posted_at = created_at + 25 分
```

**重要:** `last_posted_at` はトップページのソート順に直結する。
過去日付のまま設定することで古いスレがトップに浮上しない。

### バリデーション（insert 前に必ず確認）

- [ ] 各スレに exactly 5 件のコメントがあるか
- [ ] コメント本文が空でないか
- [ ] `author_name` が設定されているか（デフォルト: `名無しのデュエリスト`）
- [ ] `created_at` がスレの `created_at` より後の値か
- [ ] 重複コメントがないか
- [ ] 対象外スレが含まれていないか（`is_archived=true` や `is_protected=true`）

---

## 🗄️ DB 操作 注意事項

### posts テーブル（insert 時の必須フィールド）

| フィールド | 値 |
|---|---|
| `thread_id` | 対象スレ ID |
| `post_number` | スレ内通し番号（1〜5） |
| `body` | コメント本文 |
| `author_name` | `'名無しのデュエリスト'` |
| `created_at` | `thread.created_at + N 分` |
| `is_deleted` | `false` |

### threads テーブル（insert 後に UPDATE）

```sql
UPDATE threads
SET post_count = 5,
    last_posted_at = created_at + INTERVAL '25 minutes'
WHERE id = $thread_id;
```

### キャッシュ注意

直接 SQL でデータを入れた場合、`revalidateTag()` は呼ばれない。
Vercel Data Cache の期限（60〜300 秒）が切れるまで古いデータが返る。

**確認手順:** キャッシュ期限を待ってから、同じページに **2回** アクセスして表示を確認する。

---

## 🖥️ 管理画面での操作

`/admin/revival` ページで以下を行う:

- 72h ゼロコメントスレ一覧を確認
- **除外** ボタン: リバイバル対象から外す（`is_protected=true` にはしない）
- **保護** ボタン: 永続的にリバイバル・アーカイブ対象外にする（`is_protected=true`）
- **プレビュー生成** ボタン: コメントの preview ファイルを生成してダウンロード
- insert は必ず `insert-approved-revival-comments.mjs` スクリプトで実行

---

## 📁 ファイル構成

```
scripts/
  generate-empty-thread-revival.mjs   ← 検出・コメント生成・preview 出力
  insert-approved-revival-comments.mjs ← 承認済み preview を本番 DB に insert

docs/
  empty-thread-revival-rule.md        ← このファイル（運用ルール）

revival-preview-YYYY-MM-DD/           ← preview 出力ディレクトリ（.gitignore 済み）
  targets.csv                         ← 検出された対象スレ一覧
  comments.json                       ← 生成コメント（insert 前確認用）
  preview.md                          ← 人間が読む Markdown プレビュー

src/app/admin/revival/
  page.tsx                            ← 管理画面 UI
  actions.ts                          ← Server Actions
```

---

## 🔁 定期チェック

- 月1回: 物理削除コードが復活していないか `scripts/` と `src/app/admin/` を確認する
- 月1回: `is_protected=true` のスレが意図どおりか確認する
- 適宜: revival 後の本番表示（トップページ・スレ詳細）を目視確認する
