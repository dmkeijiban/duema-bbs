# Service Roleキー露出監査（カードmigrationとは別対応）

## 確認結果

- キー文字列はこの文書・回答・commitへ記載しない。
- 作業ツリー（`node_modules`、Git対象外カードキャッシュを除く）のJWT／`sb_secret_`形式一致: 0ファイル。
- 現在のGit追跡ファイルの同形式一致: 0ファイル。
- Git履歴の`SUPABASE_SERVICE_ROLE_KEY=<キー形式>`代入一致: 0commit。
- カード抽出JSON、checkpoint、HTMLキャッシュへキーを保存するコードはない。
- 監査時にSupabase CLIの標準出力へ旧キーが表示されたとの申告がある。ローカルファイルへの保存は確認されなかったが、Codexのツール実行ログ／会話記録の保持範囲はローカルGitから確認できないため、閲覧権限と保持期間はCodexワークスペース管理側で確認が必要。

この監査結果だけで「漏えいなし」とは断定しない。CLI出力を閲覧できる利用者が本人以外にもいる、共有ログへ転送された、または保持範囲が不明な場合はローテーションを推奨する。ただし本作業では失効・更新を行わない。

## ローテーション前の影響対象

1. VercelのProduction／Preview／Development環境変数`SUPABASE_SERVICE_ROLE_KEY`。
2. GitHub ActionsなどCI secret（現リポジトリのworkflow本文に直接参照は見つからないが、Repository／Environment secrets画面は別途確認）。
3. ローカル`.env.local`（通常作業ツリー、backup-enabled worktree、運用端末）。
4. ローカル／安全なCIで動かすカード・図鑑・記事インポートスクリプト。
5. `createAdminClient()`を使う管理API／Server Action。
6. `ADMIN_COOKIE_SECRET`または`NEXTAUTH_SECRET`未設定環境では、管理Cookie・匿名所有者pepper等がService Roleキーへfallbackしている箇所。キー更新で既存セッション／署名が無効化される可能性があるため、先に専用secretが設定済みか確認する。

## 安全な切り替え案

1. Supabaseで新旧キーの並行利用可否と作成方式を確認する。
2. 専用の`ADMIN_COOKIE_SECRET`／`NEXTAUTH_SECRET`が全環境にあることを確認し、Service Role fallback依存を解消する。
3. 新キーをPreviewとローカル検証環境へ設定し、管理ログイン、カード検索、管理API、カードdry-runを確認する。
4. ProductionのVercel環境変数を新キーへ更新し、再deploy後に読み取りと限定的な管理操作を確認する。
5. CI／運用端末を新キーへ更新する。
6. 旧キーを失効する前に、旧キー参照が残っていないことを一覧で再確認する。
7. 旧キー失効後、Vercel Production READY、管理画面、主要Server Action、監視ログを確認する。

## ロールバック

旧キーを即時失効せず並行期間を設ける。新キー切り替えで障害が出た場合は、Vercel／CI／ローカル設定を旧キーへ戻して再deployし、原因を修正してから再試行する。旧キー失効後はロールバックできないため、失効は全環境確認後にユーザー承認を得て実施する。
