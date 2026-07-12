---
name: maker-platform
description: メーカー企画（Tier表・殿堂予想・9選・ランキング・投票・評価など「カードを選ぶ・並べる・保存する・集計する・画像共有する」企画）の追加・変更を行うときに必ず読む。共通基盤のルールと手順の入口。
---

# メーカー企画の追加・変更ルール

## 必読ドキュメント（正本）

1. `docs/maker-platform.md` — アーキテクチャ・DB・RPC・UI・状態管理・移行計画
2. `docs/maker-project-types.md` — typeカタログとconfig例。**新企画はまずここに当てはめる**
3. `docs/maker-security.md` — 権限・公開前チェックリスト

## 絶対ルール（違反実装を提案しない）

- 企画ごとに保存ロジック・画像生成ルート・集計view・カードテーブルを**複製しない**。既存の共通実装（`save_maker_submission()` / `saveMakerSubmission` action / `/api/maker/[slug]/image` / 汎用集計view）に載せる
- カードマスターは `public.cards` のみ。企画のカード集合は `maker_project_cards`（card pool）で定義する。**pool外のカードを保存しない・させない**
- カードデータを推測で登録しない（実在カード・公式画像URLのみ。不明なら空欄にして人間に確認）
- 保存は必ず `save_maker_submission()` の単一トランザクション経由。1企画1ユーザー1回答（`UNIQUE(project_id,user_id)`）の全置換上書きが基本
- グループ定義・制約の正本は `maker_projects.config`。TS定数・SQLのIN句・UIへ複製しない。configは `parseMakerConfig` で検証してから使う
- **Production DBへ直接migrationしない。** 手順: draft SQL作成 → Preview DBで適用 → 実地検証 → 人間の承認 → Production
- 非公開企画（`visibility='admin'`）は、公開ページからの導線・sitemap・検索indexの対象にしない（`robots: {index:false, follow:false}` 必須）
- service role クライアント（`createAdminClient`）を Client Component へ渡さない。書込系は `assertMakerWriteAllowed()` を必ず通す

## 新企画追加の定型手順

コード変更なしで済むのが正常。必要になったら基盤の設計不足なので docs 改訂とセットで相談する。

1. `docs/maker-project-types.md` から type / config を選ぶ
2. `maker_projects` に1行INSERT（`status='draft'`, `visibility='admin'` で開始）
3. `/admin/cards/import` でカード取込 → `maker_project_cards` にpool登録
4. Previewで 保存 → リロード復元 → 締切制御 → 集計 → 画像 を実地確認
5. `docs/maker-security.md` の公開前チェックリストを通してから `visibility` を上げる
