# メーカー基盤 セキュリティ設計・レビュー

対象: PR #504 時点の実装＋`docs/maker-platform.md` の推奨アーキテクチャ。

## 現状レビュー（PR #504）

| 項目 | 現状 | 評価 |
|---|---|---|
| 管理者限定 | 管理者Cookie（HMAC v2）検証→`/admin` redirect | ✅ 妥当 |
| ログイン必須 | Supabase `auth.getUser()` 必須 | ✅ 妥当 |
| noindex | `robots: {index:false, follow:false}` | ✅ ただしsitemap/内部リンク非掲載の確認をリリースチェックに含める |
| RLS | maker4テーブル＋cards: RLS有効・policyなし（service roleのみ） | ✅ 非公開段階の安全側デフォルト |
| RPC | `revoke from public/anon/authenticated` + `grant to service_role` | ✅。SECURITY DEFINERは `set search_path=public` 済み |
| 集計view | anon/authenticatedからrevoke | ✅。公開時はRPC経由に限定（下記） |
| service role | `createAdminClient` はサーバ専用、Clientへ未露出 | ✅ |
| Preview限定書込 | `VERCEL_ENV !== 'preview'` で拒否 | ✅ だが2箇所に重複 → `assertMakerWriteAllowed()` へ集約 |
| card id改ざん | RPCの `join maker_project_cards` でpool外は落ちる | ⚠️ **黙って落ちる**のが問題（エラーにすべき。platform§5-2） |
| group key改ざん | actionとRPCで二重検証だが両方ハードコード | ⚠️ config正本化とセットでRPC側検証に一本化 |
| project id改ざん | actionがslug→id解決するため任意idは渡せない | ✅ この形を維持（クライアントからproject idを受け取らない） |
| CSRF | Server Actions（Next.jsのorigin検証）＋SameSite cookie | ✅ 独自Route Handler書込（cards/import）はadmin Cookie検証があること、admin以外に増やさないこと |
| レート制限 | なし | ⚠️ 非公開段階は許容。公開前に必須（下記） |
| payloadサイズ | なし | ⚠️ RPCに件数上限500を追加（platform§5-2）＋action側でJSON長チェック |

## 公開段階（visibility='public'）に上げる前の必須項目

1. **レート制限**: `saveMakerSubmission` にユーザー単位のレート制限（例: 10回/分）。既存インフラにレートリミッタがなければ、`maker_submissions.updated_at` を使った「前回保存からN秒未満は拒否」の簡易実装で開始してよい
2. **スパム対策**: 1企画1ユーザー1回答＋全置換のため回答スパムは自己上書きにしかならない（設計自体が対策）。捨てアカウント大量投票は、掲示板本体のアカウント作成対策に依存。必要なら `config.minAccountAgeDays` を導入
3. **payload上限**: item数500・JSON文字列長 ~100KB でaction側拒否
4. **結果閲覧制御**: 集計は `get_maker_results` RPCのみ経由。`result_visibility`（admin / after_close / realtime）と最低回答数（default 5）をRPC内で検証。**個別ユーザーの回答は本人と管理者以外に返さない**
5. **画像ルート**: 非公開企画は管理者Cookie必須。他人の回答画像は本人＋管理者のみ。生成はキャッシュヘッダ（`s-maxage`）を付けDoS的連打を吸収
6. **書込ガードの切替**: `assertMakerWriteAllowed()` を「Preview または 明示的に許可された本番企画」に変更するのは、Preview実地検証と本レビュー項目の完了後

## 不変ルール

- service role キー・クライアントを Client Component / ブラウザへ渡さない
- RPCは `security definer` ＋ `set search_path = public` ＋ `revoke from public/anon/authenticated` をセットで書く（片方だけにしない）
- 「クライアントから受け取ったIDを信用しない」: project は slug→サーバ解決、card/group は pool・config と照合してエラー
- 非公開企画は noindex/nofollow・sitemap除外・公開ページからのリンクなし、の3点セット
- 検証はUI（UX用）・Server Action（config制約）・RPC（構造的不変条件）の三層。**最終防衛は必ずDB側**
