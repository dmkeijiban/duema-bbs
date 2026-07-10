# ChatGPT + Codex 運用ルール

このドキュメントを、Claudeなし運用へ移行するための正本とする。

旧 `CLAUDE.md` や `.claude/skills/`、Claude Code 前提のメモは削除しない。ただし今後はアーカイブ扱いであり、現行運用の正本ではない。安全ルールや過去の事故防止知見は、この文書と関連ドキュメントへ移して使う。

## 1. 役割分担

### ユーザー

- 最終判断者。公開投稿、本番DB変更、Vercel設定変更、cron変更、課金増、SEO/AdSense変更を承認する。
- Typefully予約済み投稿や公開済み投稿の編集・削除を許可するか判断する。
- 方針が曖昧なときは、優先順位と許容リスクを決める。

### ChatGPT

- 方針整理、プロンプト作成、運用設計、X投稿案、PDCA、レビュー観点の整理を担当する。
- GitHub connector / ai-memory-vault / Obsidian などを使う場合も、秘密情報は保存しない。
- Codexへ渡すときは、この文書の「Codexへの引き継ぎフォーマット」を使う。

### Codex

- ローカルリポジトリの調査、最小差分の実装、ドキュメント更新、検証を担当する。
- 変更前に対象ファイルを読む。既存の未コミット差分を壊さない。
- 本番DB、Typefully予約、Vercel設定、cron、AdSense/SEO系には明示承認なしで触らない。

## 2. 絶対禁止事項

- 秘密情報、APIキー、token、cookie、password、service role key を読む・保存する・Markdownへ書く。
- 本番DBの物理削除、`DELETE` / `DROP` / `TRUNCATE`、既存本文の一括 `UPDATE`。
- 承認なしの Supabase 本番 write、migration実行、Storage削除。
- 承認なしの Typefully予約編集・削除・重複日時の削除再登録。
- 承認なしの X投稿、外部公開、DM、mass messaging。
- 承認なしの Vercel設定変更、環境変数変更、Production deploy、cron変更。
- AdSense審査やSEOに関わる `ads.txt`、robots、sitemap、canonical、noindex、meta、AdSense script の変更。
- `git add .`、`git add -A`、`git add --all`。
- ユーザーや他エージェントの未コミット差分を勝手に戻す。
- `.claude/skills/` と `CLAUDE.md` の削除。

## 3. Codexへの引き継ぎフォーマット

```md
## 目的
- 何を達成するか:
- 今回やらないこと:

## 対象
- リポジトリ:
- 触ってよいファイル:
- 触ってはいけないファイル:

## 安全ルール
- 本番DB:
- Typefully:
- Vercel / cron:
- AdSense / SEO:
- Git:

## 参照する正本
- `docs/chatgpt-codex-operations.md`
- 関連docs:
- Obsidianメモ:

## 作業内容
1.
2.
3.

## 検証
- 実行するチェック:
- 実行しないチェックと理由:

## 報告してほしいこと
- 変更ファイル:
- 差分概要:
- 検証結果:
- 未対応/リスク:
```

## 4. Typefully安全ルール

- 既存の公開済み投稿・予約投稿は読み取りと分析のみ。
- 予約済み投稿の削除、編集、日時変更、重複日時の削除再登録は禁止。必要なら提案に留める。
- 新規下書き作成も、ユーザーが明示したときだけ行う。
- `typefully_delete_draft` / `typefully_edit_draft` を迂回策として使わない。
- 週次PDCAでは、直近の公開済み投稿、予約投稿、ユーザーの手動投稿を読み、完成形の文体に寄せる。
- `duema-bbs.com` リンクは毎回入れない。ランキング発表、結果まとめ、続きが自然なときだけ使う。

## 5. 本番DB安全ルール

- 本番DBは原則読み取りも慎重に扱う。writeは必ずユーザー承認を取る。
- 物理削除は禁止。削除は `is_deleted=true`、スレ非表示は `is_archived=true` のソフトデリートを基本にする。
- bulk insert / update / delete、post_count修復、thread_id変更、posts移動、revival insert は、事前バックアップ、dry-run、プレビュー、ユーザー承認が必須。
- 既存本文の上書きは禁止。直す場合は preview → 承認 → soft delete / new insert のように復旧可能な手順にする。
- service role はサーバー側だけで使い、Client Componentやログに出さない。

## 6. Vercel / cron / AdSense / SEO注意

- Vercel Function実行、ISR Writes、Observability Events、RSC prefetch、revalidate頻度を増やす変更は、事前にコスト影響を説明する。
- Vercel設定、環境変数、Production deploy、rollback、domain、cron設定は承認なしで触らない。
- cronは高頻度化しない。まずdry-run、管理者プレビュー、低頻度実行から始める。
- AdSense審査中やSEO安定運用中は、`ads.txt`、robots、sitemap、canonical、noindex、meta、AdSense script、構造化データを触らない。
- SEO系の変更は、検索意図、canonical、OGP、内部リンク、noindex影響を確認してから行う。

## 7. X運用 / PDCA / Analytics取得ルール

- Xは需要発見と参加型コミュニティ形成を優先する。掲示板誘導を本文に混ぜすぎない。
- ハッシュタグは原則使わない。使う場合も過去ルールと最新実績を確認する。
- 22:00枠は懐古×参加型×定時企画。`リポスト・フォローお願いします` や `毎晩22時開催です` のような圧の強い宣伝は禁止。
- PDCAは直近の公開済み投稿、予約投稿、手動投稿、Typefullyの反応、必要ならAnalyticsを読んでから行う。
- Analytics取得は読み取りのみ。取得結果は、投稿案の改善、勝ち型、避ける型、次の実験に落とし込む。
- 外部リンクは、初速を落とさないように使う。プロフィール、固定投稿、後続投稿、自然な続きとしての誘導を優先する。

## 8. 図鑑 / 思い出図鑑 / 殿堂図鑑の注意

- `/zukan` は思い出図鑑と殿堂・プレミアム殿堂図鑑の入口。既存タブ体験を壊さない。
- 殿堂図鑑は巨大DB化しない。基本は `src/lib/hall-of-fame.ts` の静的データ追加で進める。
- 公式カード検索の画像URLを使い、外部API追加、自動スクレイピング、Supabase Storage変更、DB変更は避ける。
- `next/image` の remotePatterns 追加は必要性を確認する。現行方針は plain `<img>`。
- 日付ページは `YYYY年M月D日 殿堂発表` とし、「殿堂入りカード」だけに限定する表現を避ける。
- 紫系・グラデーションなど、既存方針から外れる装飾を入れない。
- 新しいパックを追加するときは、公式カード詳細の複数面を確認し、両面カードを1枚の物理カード・同一slugに紐づけたうえで、表面と裏面を続けて表示できるよう `src/lib/zukan-card-faces.ts` に必ず登録する。両面データの追加漏れを残さない。
- 両面カードページは「表面」「裏面」のラベルだけを使用し、「裏面あり：表面と裏面を続けて表示しています」のような青い案内枠は表示しない。

## 9. 旧Claude関連ファイルの扱い

- `CLAUDE.md` と `.claude/skills/` は削除しない。
- 旧Claude関連ファイルはアーカイブ扱い。今後の正本ではない。
- ただし、旧ファイル内の安全ルール、事故防止、運用ノウハウは安全資産として扱い、必要に応じてこの文書へ移す。
- 旧Claude表記を見つけても、大量置換はしない。文脈上明らかに現行運用へ誤誘導する箇所だけ最小修正する。

## 10. 作業後チェック

- `git diff --check` を実行する。
- 変更ファイル一覧を出す。
- コード変更をした場合のみ、対象に合った lint / typecheck / browser確認を行う。
- ドキュメントだけの作業では、本番DB、Typefully、Vercel、cron、SEO系に触れていないことを報告する。
