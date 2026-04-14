# デュエルBBS セットアップ手順

## 1. Supabaseプロジェクト作成

1. https://supabase.com でプロジェクト作成
2. **SQL Editor** で `supabase/schema.sql` を全文コピー＆実行
3. **Storage** → 「New bucket」→ 名前: `bbs-images`、Public: ON で作成

## 2. 環境変数設定

`.env.local` を編集:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=（hCaptchaサイトキー）
HCAPTCHA_SECRET_KEY=（hCaptchaシークレットキー）
```

### Supabaseキーの取得
- Project Settings → API → Project URL / anon key

### hCaptchaキーの取得
1. https://www.hcaptcha.com でアカウント作成
2. サイト登録してサイトキーとシークレットキーを取得
3. **開発中はキー未設定でもスキップ可能**（HCaptchaWidgetが「認証をスキップ」ボタンを表示）

## 3. 起動

```bash
npm install
npm run dev
```

→ http://localhost:3000

## 機能一覧

| 機能 | 説明 |
|------|------|
| スレッド一覧 | カテゴリ絞り込み・新着順/人気順・ページネーション |
| スレッド作成 | タイトル・本文・カテゴリ・画像添付・hCaptcha |
| レス投稿 | 本文・名前・画像添付・hCaptcha（折りたたみUI） |
| 画像添付 | JPEG/PNG/GIF/WebP、最大5MB、Supabase Storageに保存 |
| カテゴリ | 総合・デッキ相談・カード評価・大会・売買・雑談 |
| ダークモード | ヘッダーの月/太陽ボタンで切替、システム設定に連動 |
| お気に入り | CookieのセッションIDで管理、ログイン不要 |
| スパム対策 | 日本語チェック（ひらがな・カタカナ・漢字必須）+ hCaptcha |

## Supabase Storage CORS設定

必要に応じてStorageのCORSポリシーにアプリのURLを追加してください。
