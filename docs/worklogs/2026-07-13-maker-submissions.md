# みんなの作品一覧 実装ログ

## 構造

- 変更前: `maker_submissions` は `(project_id,user_id)` unique。`save_maker_submission` が同じ行とitemsを上書き。
- 変更後: uniqueを外し、`create_maker_submission` が登録ごとに新しいsubmissionとitemsを作る。既存RPCは他メーカー互換のため維持。
- URL: `/makers/[slug]/submissions`、`/makers/[slug]/submissions/[submissionId]`。
- 共通化: `maker_projects.type/config` と `maker_submission_items` から表示名・グループ・内容を決める。slug配列や企画別routeは追加していない。

## DB変更

- `title`（必須40文字）、`comment`（任意200文字）、`thumbnail_url`、`is_public`を追加。
- 公開・有効作品の新着一覧用partial indexを追加。
- RPCはservice roleだけ実行可能。anon/authenticatedへのexecuteは付与しない。
- migration: `20260713221500_maker_multiple_submissions.sql`。migration履歴不整合のため本番未適用、db push/repair/SQL Editor操作なし。

## 表示・サムネイル

- 一覧は1回のsubmission query、profile query、item+card queryの計3クエリ。最大60件。
- PNGを一覧アクセスごとに生成せず、保存済みitemsと既存カード画像からServer Componentで縮小Tier表を再構成。画像なしはカード名fallback。
- `thumbnail_url`は将来登録時生成へ移行できる保存先として追加したが、今回は未使用。

## 集計・セキュリティ

- 現行集計は`is_valid=true`の全作品を含む。将来は`is_aggregate_target`または代表submission IDを追加し、view条件だけ差し替えられる。
- 一覧・詳細はservice roleをサーバー内だけで利用し、`is_public=true`、`is_valid=true`、公開中project、停止・非表示・退会profileをコードで絞る。非公開IDの直指定は404。
- Reactのテキスト出力を使い、タイトル・一言をHTMLとして解釈しない。DBとServer Actionの両方で長さを検証。

## 今回省略

- タイトル・一言の登録後編集、削除、非公開UI。短期企画の必須範囲を優先した。
- 保存PNGのStorageアップロード。既存画像保存は端末ダウンロードのまま変更していない。
- DB未適用のため実DBによる複数登録、非公開・無効作品、RLSの実動作確認は未検証。

## 検証記録

- TypeScript: 成功。
- ESLint: error 0、既存warning 20。変更箇所ではplain `img` 方針によるwarningのみ。
- `git diff --check`: 成功。
- production build: Vercel Previewで成功。ローカルは秘密情報をworktreeへ複製しない状態では既存summaryのpage data収集で停止。
- Preview: PC 1280px / mobile 390pxとも横スクロールなし。タイトル40文字、一言200文字、未ログイン登録モーダル、一覧空状態、存在しないsubmission 404を確認。
- 回帰: カリスマBEST本体、みんなの評価ボタン、画像保存/X共有ボタン、殿堂解除選手権の表示を確認。
- DB未適用のため未検証: ログイン後の複数作品登録、作品あり一覧/詳細、一言あり/なし/長いタイトル、非公開・無効・停止ユーザー実データ、詳細X共有、保存画像の実ダウンロード。
