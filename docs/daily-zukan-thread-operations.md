# Daily Zukan Thread Operations

このメモは、思い出図鑑の0時スレ作成まわりの実行体制を残すための運用ドキュメントです。

Vercel Cron と GitHub Actions の二重実行は、重複ではなく意図的な救済設計です。将来の変更時に、どちらか一方を「不要なcron」と判断して削除しないでください。

## 実行トリガー

- Vercel Cron が JST 0:00 の本実行を担当します。
- GitHub Actions の `daily-zukan-thread.yml` が JST 00:05 / 01:05 / 07:05 の救済実行を担当します。
- どちらも本番LIVE実行です。dry-runや検証用ではありません。

## 二重実行でも事故らない理由

二重cronであっても、当日分が複数回作成されないようにアプリ側で防御しています。

- `daily_zukan_thread_logs` の `posted_date` で当日実行済みかを確認します。
- すでに当日分が処理済みの場合は `already_posted_today` として扱います。
- 予定自体が完了済みの場合は `schedule_already_completed` として扱います。
- 競合や同時実行で先に当日分が作られた場合は `race_already_posted` として扱います。
- Typefully送信も `posted_date` ベースで成功済みを確認し、二重送信を避けます。

このため、GitHub Actions 側の救済が遅れて走っても、通常は既存ログを見てスキップされます。

## PR #303 後のTypefully投稿

以前の0時思い出図鑑Typefully投稿は、スレ作成後に `publish_at: "now"` 相当の即時公開として作成されていました。

URL入り本文を即時公開しようとすると、Typefully / X 側のpolicyで失敗することがありました。PR #303 で、即時公開ではなく実行時刻から5分後のISO日時を使った予約投稿に変更済みです。

次回確認時は、以下を見て切り分けます。

- `daily_zukan_thread_logs.typefully_scheduled_at`
- Typefully側の予約時刻
- Xで実際に公開された時刻

0時実行なら、Typefully予約はおおむね JST 0:05 前後になる想定です。救済実行で投稿された場合は、その救済実行時刻から約5分後が予約時刻になります。

## 障害時の切り分け

0:00にX投稿が見えなくても、すぐ手動実行しないでください。まず救済実行とログを確認します。

1. JST 00:05 / 01:05 / 07:05 の GitHub Actions 救済が動いたか確認します。
2. `daily_zukan_thread_logs` の `typefully_status` を確認します。
3. `daily_zukan_thread_logs` の `typefully_error` を確認します。
4. `daily_zukan_thread_logs` の `typefully_scheduled_at` を確認します。
5. 掲示板スレ作成の成功と、Typefully投稿の成功を分けて判断します。

掲示板スレが作成済みでも、Typefully予約だけ失敗することがあります。逆に、Typefully側の予約時刻待ちでまだXに出ていないだけの場合もあります。

本番APIを手動で叩いて再実行すると、原因の切り分けや時系列確認が難しくなるため禁止です。

## 変更時の禁止事項

- Vercel Cronだけを消さない。
- GitHub Actions救済だけを消さない。
- `posted_date` のUNIQUE制約や重複防止ロジックを不用意に変更しない。
- 本番APIを手動実行しない。
- Typefully投稿や予約作成を手動テストしない。
- Discord通知テストを本番Webhookへ送らない。

この仕組みを変更する場合は、Vercel Cron、GitHub Actions救済、`daily_zukan_thread_logs`、Typefully二重送信防止の4点をまとめて確認してください。
