
# Daily Zukan Thread Operations

このメモは、思い出図鑑の0時スレ作成まわりの実行体制を残すための運用ドキュメントです。

Vercel Cron と GitHub Actions の二重実行は、重複ではなく意図的な救済設計です。将来の変更時に、どちらか一方を「不要なcron」と判断して削除しないでください。

## 実行トリガー

- Vercel Cron が JST 0:00 の本実行を担当します。
- GitHub Actions の `daily-zukan-thread.yml` が JST 00:05 / 01:05 / 07:05 の救済実行を担当します。
- どちらも本番LIVE実行です。dry-runや検証用ではありません。
- GitHub Actions の各救済実行後に、既存の `daily-zukan-typefully-reservations` を呼び、未来7日分の本文＋画像付きX投稿予約を補充します。

## 二重実行でも事故らない理由

二重cronであっても、当日分が複数回作成されないようにアプリ側で防御しています。

- `daily_zukan_thread_logs` の `posted_date` で当日実行済みかを確認します。
- すでに当日分が処理済みの場合は `already_posted_today` として扱います。
- 予定自体が完了済みの場合は `schedule_already_completed` として扱います。
- 競合や同時実行で先に当日分が作られた場合は `race_already_posted` として扱います。
- Typefully送信も `posted_date` ベースで成功済みを確認し、二重送信を避けます。

このため、GitHub Actions 側の救済が遅れて走っても、通常は既存ログを見てスキップされます。

## 0時X投稿の安定版

最後に本文＋画像付き投稿が連続成功した実装は `8a6309d`（PR #346）です。

この実装は、当日0時に画像URLを直接渡す方式ではありません。未来の予定カードを先に確定し、画像バイトをTypefullyへアップロードし、media statusが `ready` になったことを確認してから、本文と `media_id` をJST 0:00で予約します。

予約は次の順で成功した場合だけ完了扱いにします。

- 投稿対象カードを `daily_zukan_thread_schedule` から取得
- カード画像を取得し、image content-typeと0バイトでないことを確認
- Typefully media upload URLを発行して画像バイトをPUT
- media statusが `ready` になったことを確認
- 本文と `media_id` を含む予約を作成
- `typefully_id`、予約時刻、画像URL、画像取得元を保存

`scheduled_date` と `typefully_id` で同日分の二重予約を防ぎます。予約補充で画像取得・media upload・media ready・draft作成のどれかが失敗した場合、Workflowも失敗させます。

2026-07-12以降にX投稿が止まった原因は、`8a6309d` の初回予約が尽きた後、`daily-zukan-typefully-reservations` を継続実行する接続が無かったことです。掲示板スレ作成だけは成功し、救済Workflowも `errors=0` になっていたため、X投稿欠落が成功扱いになっていました。

## 障害時の切り分け

0:00にX投稿が見えなくても、すぐ手動実行しないでください。まず救済実行とログを確認します。

1. JST 00:05 / 01:05 / 07:05 の GitHub Actions 救済が動いたか確認します。
2. `daily_zukan_thread_schedule` の `typefully_status` を確認します。
3. `daily_zukan_thread_schedule` の `typefully_error` を確認します。
4. `daily_zukan_thread_schedule` の `typefully_scheduled_at` / `typefully_media_id` を確認します。
5. 掲示板スレ作成の成功と、Typefully投稿の成功を分けて判断します。

掲示板スレが作成済みでも、Typefully予約だけ失敗することがあります。逆に、Typefully側の予約時刻待ちでまだXに出ていないだけの場合もあります。

本番APIを手動で叩いて再実行すると、原因の切り分けや時系列確認が難しくなるため禁止です。

## 変更時の禁止事項

- Vercel Cronだけを消さない。
- GitHub Actions救済だけを消さない。
- `posted_date` のUNIQUE制約や重複防止ロジックを不用意に変更しない。
- 本番APIを手動実行しない。
- 原因確認前にTypefully予約を削除・編集・再登録しない。
- Discord通知テストを本番Webhookへ送らない。

この仕組みを変更する場合は、Vercel Cron、GitHub Actions救済、`daily_zukan_thread_logs`、Typefully二重送信防止の4点をまとめて確認してください。

