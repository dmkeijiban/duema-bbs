# 管理アナリティクス再設計 作業ログ

## 現在地

- 2026-07-13: 最新 `origin/main` (`8b6641d`) から専用worktree・`feat/unified-admin-analytics` を作成。
- リポジトリ規約と共有メモを確認済み。既存構造の調査を開始する。
- 2026-07-13 最終レビュー: `origin/main` は引き続き `8b6641d`。競合なし。migration適用前レビューと追加修正を実施中。
- 2026-07-13 本番schema・migration履歴の読み取り専用照合を実施。詳細は `docs/worklogs/pr551-supabase-migration-reconciliation.md`。重複8桁versionと本番14桁versionの構造不一致があるため、baseline作成前のrepair/db push/単独適用は保留。

## 調査済みファイル

- `AGENTS.md`
- `README.md`
- `docs/chatgpt-codex-operations.md`
- `package.json`

## 既存テーブル・view・RPC

- テーブル: `maker_projects`, `maker_project_cards`, `maker_submissions`, `maker_submission_items`, `maker_events`。
- `maker_projects.type`: `tier | prediction | selection`。`config.groups[].key/label` で回答グループを表現。
- view: `maker_tier_aggregates`（S/A/B/C/D、回答者数、平均Tier）、`maker_selection_aggregates`（選択人数、全回答数、選択率、0票カードを含む）。
- RPC: `record_maker_event`, `record_maker_page_view`, `maker_event_stats`, `maker_event_stats_v2`, `save_maker_submission`。
- RLS: maker関連は有効。anon/authenticatedへ直接公開せず、管理サーバーのservice roleで読む。
- イベント: `tier_created`, `image_saved`, `x_shared`, `aggregate_viewed`, `page_viewed`, `auth_cta_clicked`, `signup_completed`, `submission_after_signup`。
- JST今日境界は既存 `getJstTodayCutoffUtcIso()` を再利用。

## 再利用する処理

- サイト全体: `getGa4DashboardData`, `getInternalDashboardData`, GA4の5分 `unstable_cache`。
- maker: 既存テーブル、イベント名、`maker_tier_aggregates`, `maker_selection_aggregates`。
- 認証: `ADMIN_COOKIE` + `verifyAdminCookie()`。DB: `createAdminClient()`。

## 採用した設計

- URL: `/admin/analytics?tab=site|makers`, `/admin/analytics/makers/[slug]?period=today|7d|30d|all`。
- 共通Server Componentで取得し、ブラウザへ生イベントを渡さない。
- `maker_projects.type/config.groups` でTier/選択型アダプターを選択。slugの固定配列・ページ全体ifは使用しない。
- 共通 `AnalyticsRefresh`: 表示中のみ5分、手動更新、visibility復帰時の期限切れ更新、単一timer、cleanup、二重更新guard。
- 既存専用ページは公開設定・編集機能を含むため削除せず維持。管理メニューの主分析導線だけ統合画面へ寄せる。
- migration: `admin_maker_project_stats(period_start)` を追加。企画横断を1 RPCで返し、slug固定列挙なし。未適用環境は既存表のサーバー集計へfallback。
- migration適用後のSupabaseクエリ数: サイト全体は内部指標4クエリ（GA4は外部API、5分cache）、企画一覧は1 RPC、企画詳細は4（project 1 + 一覧RPC 1 + 回答view 1 + cards 1）。更新・期間切替も同数。migration未適用時は企画一覧が `1 + 2N`、詳細は `4 + 2N`（N=企画数）。
- 最終レビューで高コストfallbackを削除。RPC未適用時は明示エラーにして、企画数比例のクエリを静かに実行しない。
- migrationへ期間横断用index（events created_at/project/type、valid submissions updated_at/project）を追加。
- 殿堂解除選手権へ既存共通イベント計測を接続。UI変更なしでPV・予想開始・画像保存・X共有・集計閲覧を計測する。

## 変更済みファイル

- `docs/worklogs/admin-analytics-redesign.md`
- `src/app/admin/page.tsx`
- `src/app/admin/analytics/layout.tsx`
- `src/app/admin/analytics/page.tsx`
- `src/app/admin/analytics/makers/[slug]/page.tsx`
- `src/components/admin/AnalyticsRefresh.tsx`
- `src/lib/admin-maker-analytics.ts`
- `supabase/migrations/20260713_admin_maker_analytics.sql`

## 完了済み

- `git fetch origin`
- 最新 `origin/main` の確認
- 専用ブランチ・worktree作成
- worktreeの起点確認
- 既存構造、DB/view/RPC、イベント、更新処理、管理認証、キャッシュの調査
- URL・責務・タイプ判定・更新hook・migration設計
- 統合画面、一覧、汎用詳細、管理メニュー導線の初期実装
- TypeScriptと対象lint

## 未完了作業

- 既存サイトダッシュボードの人気ページ・人気スレッド表示を統合画面へ完全移植
- RPC利用部分とfallbackの負荷・型の最終レビュー
- 全lint、`git diff --check`、環境変数ありbuild、ブラウザ検証
- Preview、PC/390pxスクリーンショット、commit/push/Draft PR

## 検証結果

- worktree作成成功。起点は `origin/main` の `8b6641d`。
- `npm.cmd exec tsc -- --noEmit`: 成功。
- 対象ESLint: 成功。
- `npm.cmd run build`: コンパイル・型検査成功後、既存環境変数不足（`supabaseUrl is required`、`/summary/[slug]` page data収集）で停止。
- Vercel Preview build: 成功（Next.js compile、TypeScript、320 static pages、動的analytics route生成）。
- 最終Preview URL: `https://duema-m3cplqjxd-mkeijibans-projects.vercel.app`。
- Draft PR: `https://github.com/dmkeijiban/duema-bbs/pull/551`。
- ブラウザ: Vercel Deployment Protectionでログイン要求。Chrome連携も利用不可だったため、管理画面本体・PC/390pxスクリーンショット・実データ整合は未検証。
- migrationはファイル作成のみ。本番/Preview DBへ未適用。
- 最新main照合: `origin/main=8b6641d`、PRはCLEAN/MERGEABLE、管理メニュー競合なし。
- migration権限レビュー: `SECURITY DEFINER` + `search_path=public`、PUBLIC/anon/authenticated revoke、service_roleのみgrant。既存データ変更・削除なし。
- 本番Supabase事前確認: Supabase CLIは未認証・未リンク。Vercel projectは `mkeijibans-projects/duema-bbs` と確認したが、CLIで取得したproduction envでは `SUPABASE_DB_URL` とservice roleが空値のため、本番project ref・既存function・事前件数を照合できず。migration未適用。
- Vercel production envの一時ファイルは確認後に削除済み。秘密値はログ出力していない。
- 最終レビュー修正 commit: `596c2bb`。Vercel Preview build/check成功。
- 最新Preview: `https://duema-jzvo9p4mi-mkeijibans-projects.vercel.app`。
- ChromeではDeployment Protectionを通過。管理パスワードはローカル設定とPreviewで不一致だったため管理画面にはログインできず、管理PC/390px・実データ・クエリ数・更新動作は未検証。
- 公開回帰（Preview）: カリスマBESTと殿堂解除選手権はPC相当幅で見出し・主要操作表示、横スクロールなし、console errorなし。390pxでも両ページとも `scrollWidth=clientWidth=384` で横スクロールなし。
- TypeScript成功、全ESLintはerror 0（既存warning 18）、`git diff --check` 成功。
- 本番migration、本番データ検証、Draft解除、main merge、本番deployは未実施。

## 次に行う具体的な作業

- 最終Preview再deploy、commit、push、Draft PR作成まで完了。
- Deployment Protectionと管理認証を通せる環境でPC/390px・実データ・期間切替・更新動作を追加確認する。
- 追加修正のTypeScript/ESLint/build/Previewを通してPRへpushする。
- Supabase CLI login+link、または値の入った安全なDB接続経路が用意されるまで本番migrationとマージは保留する。
- Vercelの現行 `ADMIN_PASSWORD` でPreview管理認証を通し、管理画面のPC/390px・期間・更新・Networkを検証する。

## 注意点

- mainの既存作業ツリーは未コミット変更あり。専用worktree以外を編集しない。
- 本番migration適用、本番DB write、Production deploy、mainへのマージは行わない。
- 公開企画ページのUIは必要以上に変更しない。
