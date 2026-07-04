# duema-bbs

デュエル・マスターズ専門の掲示板です。スレッド投稿、コメント、カテゴリ別一覧、過去ログ、思い出図鑑、投稿者ランキング、管理画面を Next.js / Supabase / Vercel で運用しています。

## 技術スタック

- Next.js App Router
- React
- TypeScript
- Supabase
- Vercel
- Tailwind CSS

## ローカル開発

```powershell
npm.cmd install
npm.cmd run dev
```

開発サーバー起動後、ブラウザで `http://localhost:3000` を開きます。

型チェック:

```powershell
npm.cmd exec tsc -- --noEmit
```

lint:

```powershell
npm.cmd run lint
```

## Content Tools

Wiki URL から歴史読み物系の記事下書きを作る場合:

```powershell
npm.cmd run content:article -- --url https://dmwiki.net/DM26-RP1
```

詳しくは [docs/history-article-generator.md](docs/history-article-generator.md) を参照してください。

## 重要な運用注意

- 投稿本文、コメント本文、ユーザー投稿データは保全を優先します。
- 本番DBの物理削除、既存本文の一括更新、post_count修正、thread_id変更は事前確認なしで行いません。
- Typefully、Discord、本番API、cron、GitHub Actions、Vercel設定、Supabase設定の手動操作は、目的と影響を確認してから行います。
- 公開前の下書き生成と本番投稿・外部送信は分けて扱います。

## 触る前に確認する領域

次の領域は小さな変更でも影響が大きいため、別PRで扱います。

- DB / migration / RLS / env
- cron / GitHub Actions / Typefully / Discord通知
- AdSense / `ads.txt`
- `images.unoptimized`
- metadata / canonical / robots / sitemap
- 本番APIの手動実行

APIキー、Cookie、Webhook URL、環境変数の実値はREADMEやdocsに書かないでください。
