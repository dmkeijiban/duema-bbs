# Codex Weekly Routines

この文書は、Claude側に残っている週次ルーチンを ChatGPT + Codex 中心の運用へ移行するための手順書です。

Claudeなし運用の正本は `docs/chatgpt-codex-operations.md` とします。この文書は週次X運用に絞った補助手順です。

## 前提

- 通常作業場: `C:\Users\light\Desktop\codex\projects\duema-bbs-main-clean`
- 対象ルーチン:
  - `Weekly X analysis`: 毎週金曜 20:30 JST
  - `Weekly Typefully schedule`: 毎週金曜 21:00 JST
- ChatGPT:
  - 方針判断
  - 投稿文ブラッシュアップ
  - PDCAの解釈
  - 次週の企画方向性決定
- Codex:
  - ローカルリポジトリ調査
  - 関連docs/Vaultメモ確認
  - 重複・禁止事項チェック
  - 記録案作成
  - 必要なドキュメント更新、検証、PR化
- Claude関連ファイル:
  - `CLAUDE.md` と `.claude/skills/` は削除しない。
  - 旧Claude前提の記述はアーカイブ扱い。現行判断は `docs/chatgpt-codex-operations.md` と本書を優先する。

## 共通禁止事項

- Typefullyの既存予約を編集、削除、日時変更しない。
- 公開済みX投稿や手動投稿を編集、削除しない。
- `typefully_delete_draft` / `typefully_edit_draft` を使わない。
- 重複日時を、既存予約の削除からの再登録で解決しない。
- ユーザーの明示承認なしにTypefullyへ新規下書きや予約を作成しない。
- ユーザーの明示承認なしにXへ投稿しない。
- 本番DB、Supabase Storage、Vercel設定、cron、GitHub Actions、AdSense/SEOに触らない。
- `CLAUDE.md` / `.claude/skills/` を削除しない。
- `git add .` / `git add -A` / `git add --all` を使わない。
- 秘密情報、APIキー、token、cookie、password、service role keyを読まない、保存しない、Markdownへ書かない。

## Weekly X Analysis

### 目的

毎週のX運用結果を分析し、次週の投稿方針、避ける型、増やす型、チャレンジ枠の扱いを決める。

### 必要な入力

- 対象週の公開済み投稿一覧
- 可能なら各投稿のインプレッション、いいね、リプ、リポスト、プロフィールクリック
- Typefullyの公開済み投稿
- Typefullyの予約済み投稿
- ユーザー本人の手動投稿
- ユーザーが手直しした投稿の差分
- 前回チャレンジ枠の結果
- 週次フォロワー数やアカウント全体サマリーがあれば追加する

### 読むべきファイル

- `docs/chatgpt-codex-operations.md`
- `docs/x-posting-pdca-rules.md`
- `docs/x-posting-style-guide.md`
- `obsidian-vault/x-growth.md`
- `obsidian-vault/AI_TASKS/Projects/X運用.md`
- `obsidian-vault/AI_TASKS/Projects/X-ideas.md`
- `obsidian-vault/07-logs/x-pdca/` の直近ログ

### Codexの確認手順

1. 作業前に `docs/chatgpt-codex-operations.md` を読む。
2. X運用関連docsとVaultメモを読む。
3. Typefully予約・公開済み投稿は読み取りと分析だけにする。
4. 最新の公開済み投稿と予約済み投稿から、文体、改行、CTA、テーマ重複を確認する。
5. ユーザー手直し差分を以下の分類へ落とす。
   - 改行
   - 口調・一人称
   - 自己開示
   - テーマの弱さ
   - 説明しすぎ
   - 重複
   - デュエマ勢っぽさ
   - 回答しやすさ
6. 週間インプ上位3本と下位3本を整理する。
7. 投稿型A-Fのどれが強かったかを整理する。
8. チャレンジ枠を過去4週の同枠baselineと比べる。
9. 次週に増やす型、減らす型、禁止する癖を整理する。

### ChatGPTが判断する部分

- 次週の投稿方針。
- どの勝ち型を増やすか。
- どの弱い型を減らすか。
- チャレンジ枠を昇格、継続、没のどれにするか。
- 投稿文の口調、自己開示、カード名選びの最終ブラッシュアップ。
- 既存ルール同士が衝突した場合の優先順位。

### Codexが記録する部分

- 週次PDCAレポート案。
- チャレンジ枠の結果と判定理由。
- ユーザー手直し差分の再発防止メモ。
- 次週Typefully scheduleへ渡す注意点。
- 記録先候補:
  - `obsidian-vault/07-logs/x-pdca/YYYY-MM-DD.md`
  - `obsidian-vault/AI_TASKS/Projects/X運用.md`
  - `obsidian-vault/AI_TASKS/Projects/X-ideas.md`

記録ファイルを更新する場合は、対象ファイルを明示し、必要最小限の差分にする。

## Weekly Typefully Schedule

### 目的

次週分のX投稿案を作り、ユーザー確認後にTypefullyへ反映できる状態にする。

### 対象期間

1. Typefully予約一覧を読み、最後の予約日付を確認する。
2. 最後の予約日付の翌週月曜から日曜までを対象週にする。
3. 既に予約がある期間には追加しない。
4. 対象週を「M/D-M/Dの週」としてユーザーに明示する。

### 参照ファイル

- `docs/chatgpt-codex-operations.md`
- `docs/x-posting-pdca-rules.md`
- `docs/x-posting-style-guide.md`
- `obsidian-vault/x-growth.md`
- `obsidian-vault/AI_TASKS/Projects/X運用.md`
- `obsidian-vault/AI_TASKS/Projects/X-ideas.md`
- `src/lib/weekly-schedule.ts`
- `src/app/admin/x-posts/actions.ts`

`src/lib/weekly-schedule.ts` は既存実装の参考として読む。ただし最新の運用ルールやユーザー手直し結果とズレる場合は、docs/Vaultの最新ルールとChatGPT判断を優先する。

### 投稿案作成フロー

1. Typefully予約一覧を読み、空き週を特定する。
2. 最新の公開済み投稿、予約済み投稿、手動投稿を読む。
3. 前回のユーザー手直し差分を確認する。
4. ChatGPTに週の方針と投稿文ブラッシュアップを渡す。
5. 月曜から日曜まで、7:00 / 12:00 / 19:00 / 22:00 の28枠を作る。
6. 水曜19:00はチャレンジ枠とする。
7. `X-ideas.md` の `[未テスト]` から1本だけ選び、19時枠の文体へ清書する。
8. `[未テスト]` がない場合は通常テンプレで代替する。
9. 全投稿で以下を確認する。
   - ハッシュタグを入れていない。
   - URLを本文に入れていない。
   - 掲示板宣伝を入れていない。
   - `リポスト・フォローお願いします` などの催促を入れていない。
   - `コメント` ではなく `リプ` 表記になっている。
   - 直近7日から2週間のテーマと重複していない。
   - 同一フォーマットを使いすぎていない。

### ユーザー確認フロー

1. 対象週、28本案、チャレンジ枠、主な重複チェック結果を提示する。
2. ユーザーがOKするまではTypefullyへ反映しない。
3. 修正希望があれば投稿案だけを直す。
4. 既存予約側に問題が見つかった場合も、操作はせず「修正提案」として報告する。

### Typefully反映時の安全ルール

- 新規追加のみ行う。
- 既存予約の編集、削除、日時変更はしない。
- 重複スロットがある場合は、そのスロットをスキップしてユーザーへ報告する。
- 一括送信前に、対象件数、対象日時、本文、重複有無を再確認する。
- Typefully接続が使えない場合は、予約案の提示またはファイル化までで止める。
- Typefully反映後も、既存予約に差分が出ていないか確認する。

### Typefully既存予約を触らないルール

- 予約済み投稿の本文修正は禁止。
- 予約済み投稿の削除は禁止。
- 予約済み投稿の日時変更は禁止。
- 予約済み投稿の上書きは禁止。
- 重複日時の解消目的で既存予約を消して再登録することは禁止。
- 既存予約に明らかなミスがある場合も、Codexは提案だけを出す。
- ユーザーが明示的に既存予約の編集/削除を依頼した場合でも、対象draft、日時、操作内容を再確認してから別タスクとして扱う。

### 反映後の確認項目

- Typefully上に新規分だけ追加されたか。
- 対象週の28枠が揃っているか。
- 重複日時がないか。
- 既存予約が編集、削除、日時変更されていないか。
- チャレンジ枠の扱いを `X-ideas.md` へ記録する必要があるか。
- PDCAログまたは日次ログに、対象週、件数、チャレンジ枠、注意点を記録する必要があるか。

## GitHub Actions / Cronとの関係

`.github/workflows/sync-typefully.yml` は、Typefully予約投稿を読み取って掲示板側の `x_posts` やスレ化へ同期するジョブです。

Weekly Typefully Scheduleは、次週分の投稿案作成とTypefully予約準備の手順です。`sync-typefully` と役割が違うため、週次ルーチン移行のためにGitHub Actionsやcronを変更しないでください。

## Claude側ルーチン停止条件

Claude側の `Weekly X analysis` と `Weekly Typefully schedule` は、以下を満たすまで停止しないでください。

- 本書が `docs/codex-weekly-routines.md` としてmainへ取り込まれている。
- 2026-07-10 の初回移行確認が完了している。
- `Weekly X analysis` をCodex + ChatGPT手順で1回実施できている。
- `Weekly Typefully schedule` をCodex + ChatGPT手順で1回実施できている。
- Typefully既存予約を編集/削除せず、新規追加または案提示だけで完了できている。
- 分析結果と予約結果がVaultまたは指定ログに記録されている。
- ChatGPTが方針判断と投稿文ブラッシュアップを担当する流れが確認できている。
- 失敗時の代替手順として、Codexが28本案を提示し、人間がTypefully UIで手動反映できる状態になっている。

特に、7/10の初回移行確認が終わるまではClaude側ルーチンを止めないでください。

## 初回移行確認

2026-07-10 は以下の順で確認します。

1. 20:30 JST: `Weekly X analysis` をCodex + ChatGPT手順で実施する。
2. 21:00 JST: `Weekly Typefully schedule` をCodex + ChatGPT手順で実施する。
3. Typefully既存予約に触っていないことを確認する。
4. 本番DB、Vercel設定、cron、GitHub Actions、AdSense/SEOに触っていないことを確認する。
5. Claude側ルーチン停止可否を判断する。

## 結論

Claude Free化後も、ChatGPTが方針判断と投稿文ブラッシュアップを担当し、Codexが調査、確認、記録、PR化を担当すれば、Weekly運用は継続できます。

ただし、2026-07-10の初回移行確認が完了するまではClaude側ルーチンを停止しないでください。
