# デュエマ掲示板 X自動運用システム 実装仕様書

> **対象**: Codex + 人間レビュー前提の実装タスク集  
> **方針**: MVP（最小構成）を先に完成させ、段階的に拡張する  
> **最終目標**: 大会結果・デッキ情報を半自動でXに投稿し、掲示板への流入を増やす

---

## 1. MVP 定義（まず作るべき最小構成）

**MVPスコープ（Phase 1）**:

1. Supabase に `x_posts` テーブルを作る
2. 管理画面で投稿を手動登録できる
3. 登録した投稿を Typefully 下書きとして送信できる
4. 投稿に画像を添付できる（画像はあらかじめ用意したもの）

**MVPで作らないもの**（後回し）:
- X API からのリプライ自動取得
- 画像の自動生成（Satori / Canvas）
- n8n / Cron による完全自動化
- 投稿パフォーマンス分析

---

## 2. 機能優先順位

| Priority | 機能 | Phase |
|----------|------|-------|
| P0 | 投稿DB（x_posts）設計・作成 | 1 |
| P0 | 管理画面：投稿一覧・新規作成 | 1 |
| P0 | Typefully 下書き送信 Server Action | 1 |
| P1 | 画像アップロード（Supabase Storage） | 1 |
| P1 | 投稿テンプレート（優勝報告・大会告知） | 1 |
| P2 | 優勝画像の自動生成（Satori） | 2 |
| P2 | シルエットクイズ画像の自動生成 | 2 |
| P2 | 違和感クイズ画像の自動生成 | 2 |
| P3 | Apify でリプライ収集 → 掲示板スレ生成 | 3 |
| P3 | Cron / Cloudflare Worker で定期自動実行 | 3 |
| P4 | 投稿インサイト（いいね・RT 取得・記録） | 4 |

---

## 3. 技術スタック

| 役割 | 技術 | 理由 |
|------|------|------|
| フロント / 管理画面 | Next.js（既存） | そのまま使う |
| DB | Supabase（既存） | そのまま使う |
| 画像ストレージ | Supabase Storage | 既存インフラ活用 |
| SNS 下書き送信 | Typefully API | MCP接続済み、スレッド投稿が強い |
| 画像生成 | @vercel/og（Satori）| サーバーサイドPNG生成、フォント制御が容易 |
| リプライ収集 | Apify（既存 Actor） | 既存コードがある |
| 定期実行 | Cloudflare Worker（既存） | duema-cron-worker を拡張 |

---

## 4. DB設計（Supabase）

### 4-1. `x_posts` テーブル

```sql
create table x_posts (
  id            bigint generated always as identity primary key,
  post_type     text not null,          -- 'tournament_result' | 'quiz_silhouette' | 'quiz_odd' | 'announcement' | 'custom'
  status        text not null default 'draft', -- 'draft' | 'scheduled' | 'sent' | 'failed'
  title         text,                   -- 管理画面表示用タイトル
  thread_lines  text[] not null,        -- ツイートの各ツイート（配列 = スレッド）
  image_urls    text[],                 -- Supabase Storage の公開URL（複数可）
  typefully_id  text,                   -- Typefully 下書きID（送信後セット）
  scheduled_at  timestamptz,            -- 予約投稿日時（Typefully側で管理）
  sent_at       timestamptz,            -- 実際に送信された日時
  source_ref    text,                   -- 関連スレッドID等（任意）
  meta          jsonb,                  -- 拡張用（大会名・デッキ名など）
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS: 管理者のみ（anon はアクセス不可）
alter table x_posts enable row level security;
create policy "service role only" on x_posts using (false);
```

### 4-2. `x_post_images` テーブル（生成画像メタ管理）

```sql
create table x_post_images (
  id          bigint generated always as identity primary key,
  x_post_id   bigint references x_posts(id) on delete cascade,
  image_type  text not null,  -- 'winner_card' | 'silhouette' | 'odd_one_out' | 'upload'
  storage_path text not null, -- Supabase Storage path
  public_url  text not null,
  gen_params  jsonb,          -- 生成パラメータ（カード名・色等）
  created_at  timestamptz not null default now()
);
```

### 4-3. `x_reply_logs` テーブル（将来: Apify 収集）

```sql
create table x_reply_logs (
  id           bigint generated always as identity primary key,
  x_post_id    bigint references x_posts(id) on delete set null,
  tweet_id     text not null unique,
  author_name  text,
  content      text,
  replied_at   timestamptz,
  processed    boolean not null default false,
  created_at   timestamptz not null default now()
);
```

---

## 5. フォルダ構成

```
src/
├── app/
│   └── admin/
│       └── x-posts/
│           ├── page.tsx              # 投稿一覧
│           ├── new/
│           │   └── page.tsx          # 新規作成
│           ├── [id]/
│           │   └── page.tsx          # 編集・送信
│           └── actions.ts            # Server Actions
│
├── lib/
│   ├── typefully.ts                  # Typefully API ラッパー
│   ├── x-post-templates.ts           # 投稿テンプレート生成関数
│   └── x-image-gen.ts                # 画像生成ユーティリティ
│
├── app/
│   └── api/
│       ├── x-image/
│       │   ├── winner/route.ts       # 優勝カード画像生成エンドポイント
│       │   ├── silhouette/route.ts   # シルエットクイズ画像生成
│       │   └── odd/route.ts          # 違和感クイズ画像生成
│       └── x-posts/
│           └── send/route.ts         # Cron/Worker からの自動送信トリガー

drafts/
└── x-posts/                          # 手動テンプレートYAML置き場（任意）
```

---

## 6. API 設計

### 6-1. 管理画面 Server Actions（`src/app/admin/x-posts/actions.ts`）

```typescript
// 投稿を Typefully に下書き送信
export async function sendToTypefully(formData: FormData): Promise<{ error?: string }>

// 投稿を DB 保存
export async function saveXPost(formData: FormData): Promise<{ error?: string; id?: number }>

// 投稿を削除
export async function deleteXPost(formData: FormData): Promise<{ error?: string }>

// ステータス更新（手動 sent マーク等）
export async function updateXPostStatus(formData: FormData): Promise<{ error?: string }>
```

### 6-2. 画像生成 API Routes

```
GET /api/x-image/winner?card=超竜バジュラ&player=田中&event=WGP2025春
  → PNG を返す（@vercel/og）

GET /api/x-image/silhouette?card=超竜バジュラ&reveal=false
  → シルエット画像

GET /api/x-image/odd?cards=A,B,C,D&odd=C
  → 4枚並び画像（1枚だけ違うカード）
```

### 6-3. 自動送信トリガー（将来）

```
POST /api/x-posts/send
  Body: { postId: number }
  Auth: Bearer CRON_SECRET
  → DB から取得して Typefully 送信
```

---

## 7. Typefully 連携仕様

### 7-1. 接続方式

MCP ツール `mcp__typefully__typefully_create_draft` は旧 Claude Code MCP 環境で使っていたツール名。現行の ChatGPT + Codex 運用では、利用可能な接続が明示されている場合だけ下書き作成に使う。
**アプリ内（Next.js Server Action）からは REST API を直接呼ぶ**。

### 7-2. Typefully REST API

```typescript
// src/lib/typefully.ts

const TYPEFULLY_API_BASE = 'https://api.typefully.com/v1'

// 下書き作成
export async function createTypefullyDraft(params: {
  content: string           // スレッドは "\n\n---\n\n" で区切る
  scheduleDate?: string     // ISO 8601
  threadify?: boolean
}): Promise<{ id: string; share_url: string } | { error: string }>

// スレッド形式のツイートを content に変換
export function threadsToContent(lines: string[]): string {
  return lines.join('\n\n---\n\n')
}
```

**環境変数**:
```
TYPEFULLY_API_KEY=xxx   # .env.local に追加
```

**Typefully API ヘッダー**:
```
X-API-KEY: {TYPEFULLY_API_KEY}
Content-Type: application/json
```

---

## 8. 投稿テンプレート

```typescript
// src/lib/x-post-templates.ts

// 優勝報告スレッド
export function buildWinnerPost(params: {
  eventName: string        // 例: "WGP2025春 東京"
  playerName: string       // 例: "田中たろう"
  deckName: string         // 例: "赤青バイク"
  deckDetail?: string      // デッキリスト等（任意）
  boardThreadUrl?: string  // 掲示板スレッドURL
}): string[]               // スレッドの各ツイート配列

// シルエットクイズ
export function buildSilhouettePost(params: {
  answerCardName: string
  hintText?: string
  revealUrl?: string       // 翌日答え合わせ用
}): string[]

// 違和感クイズ
export function buildOddOneOutPost(params: {
  cards: string[]          // 4枚のカード名
  oddCard: string          // 違和感カード名
  reason?: string          // 翌日公開用
}): string[]

// 大会告知
export function buildTournamentAnnouncePost(params: {
  eventName: string
  date: string
  venue: string
  entryUrl?: string
  boardThreadUrl?: string
}): string[]
```

---

## 9. 画像生成構成

### 9-1. 技術: `@vercel/og`（ImageResponse）

- サーバーサイドで JSX → PNG 変換
- フォントはプロジェクトに同梱（`public/fonts/`）
- カード画像は DM Wiki 等の画像URLを fetch して埋め込み

### 9-2. 優勝カード画像 (`/api/x-image/winner`)

```
レイアウト:
┌──────────────────────────┐
│  🏆 優 勝               │  ← 金文字ヘッダー
│                           │
│  [カード画像 大]          │
│                           │
│  使用デッキ: 赤青バイク   │
│  優勝者: 田中たろう       │
│  大会: WGP2025春 東京    │
└──────────────────────────┘
サイズ: 1200×675px (OGP比率)
```

### 9-3. シルエットクイズ画像 (`/api/x-image/silhouette`)

```
レイアウト:
┌──────────────────────────┐
│  このカードは何でしょう？ │
│                           │
│  [カード画像を黒塗り]     │
│                           │
│  ヒント: {hint}           │
└──────────────────────────┘
実装: canvas-api または CSS filter: brightness(0)
```

### 9-4. 違和感クイズ画像 (`/api/x-image/odd`)

```
レイアウト:
┌──────────────────────────┐
│  1枚だけ仲間はずれは？   │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐   │
│ │A │ │B │ │C │ │D │   │
│ └──┘ └──┘ └──┘ └──┘   │
└──────────────────────────┘
4枚のカード画像を横並び
```

### 9-5. カード画像取得

- DM Wiki の画像URL: `https://dmwiki.net/images/{カード名}.jpg` 形式  
- API route 内で `fetch` → `arrayBuffer` → `base64` に変換して埋め込み  
- キャッシュ: Supabase Storage に保存して再利用（将来）

---

## 10. 管理画面UI仕様

### 10-1. 投稿一覧 (`/admin/x-posts`)

- ステータス別（下書き / 送信済 / 予約）でフィルタ
- 各行: タイトル / 投稿タイプ / ステータス / 作成日 / 操作ボタン
- ボタン: 編集 / Typefully送信 / 削除

### 10-2. 新規作成 / 編集 (`/admin/x-posts/new`, `/admin/x-posts/[id]`)

- 投稿タイプ選択（select）→ テンプレート自動入力
- スレッド各ツイートを `<textarea>` で個別編集（追加・削除可能）
- 画像: Supabase Storage へのアップロード OR 生成画像プレビュー
- 送信先: Typefully下書き（即時 or 予約日時指定）

---

## 11. 将来拡張: Apify リプライ収集

### 11-1. フロー（Phase 3）

```
1. Typefully で投稿公開
2. 公開 tweet_id を x_posts.meta に保存
3. Cloudflare Worker (cron) が Apify Actor を呼び出し
4. リプライを x_reply_logs に保存
5. 特定条件（"参加しました" 等）でスレッド自動作成
```

### 11-2. Apify 連携

既存の `src/lib/apify.ts` がある前提で拡張:

```typescript
// リプライ収集 Actor を呼ぶ
export async function fetchTweetReplies(tweetId: string): Promise<ReplyItem[]>
```

---

## 12. Codex 実装タスク（原子タスク分割）

各タスクは独立して実装・PRにできるサイズ。

---

### Task 1: DB マイグレーション

**ファイル**: `supabase/migrations/YYYYMMDD_x_posts.sql`

```
- x_posts テーブル作成（Section 4-1 のSQL）
- x_post_images テーブル作成（Section 4-2 のSQL）
- x_reply_logs テーブル作成（Section 4-3 のSQL）
- RLS 設定（service role のみ許可）
- updated_at 自動更新トリガー追加
```

---

### Task 2: Typefully API ラッパー

**ファイル**: `src/lib/typefully.ts`

```
- createTypefullyDraft(params) 関数
  - POST https://api.typefully.com/v1/drafts/
  - X-API-KEY ヘッダー
  - content: スレッドを "\n\n---\n\n" 区切りで結合
  - scheduleDate: ISO8601 (オプション)
  - 戻り値: { id, share_url } or { error }
- threadsToContent(lines: string[]): string
- 環境変数: TYPEFULLY_API_KEY
```

---

### Task 3: 投稿テンプレート関数

**ファイル**: `src/lib/x-post-templates.ts`

```
- buildWinnerPost(params): string[]
  - 第1ツイート: 🏆優勝報告 + 大会名 + 選手名
  - 第2ツイート: デッキ名 + 構成説明
  - 第3ツイート: 掲示板スレッドURLへの誘導
- buildSilhouettePost(params): string[]
  - 第1ツイート: クイズ本文 + ヒント
  - 第2ツイート: 答え合わせは明日！
- buildOddOneOutPost(params): string[]
  - 第1ツイート: クイズ本文
  - 第2ツイート: 答えは明日！
- buildTournamentAnnouncePost(params): string[]
  - 第1ツイート: 大会告知
  - 第2ツイート: エントリーURL + 掲示板誘導
```

---

### Task 4: Server Actions

**ファイル**: `src/app/admin/x-posts/actions.ts`

```
'use server'

- saveXPost(formData):
  - バリデーション（thread_lines 必須、post_type 必須）
  - supabase.from('x_posts').insert(...)
  - revalidatePath('/admin/x-posts')
  - 戻り値: { id } or { error }

- sendToTypefully(formData):
  - x_posts から取得
  - typefully.createTypefullyDraft() を呼ぶ
  - 成功: x_posts.typefully_id と status='scheduled' を更新
  - 失敗: status='failed' を更新
  - 戻り値: { shareUrl } or { error }

- deleteXPost(formData):
  - supabase.from('x_posts').delete().eq('id', id)
  - revalidatePath('/admin/x-posts')

- updateXPostStatus(formData):
  - status を手動更新（sent / draft 等）
```

---

### Task 5: 管理画面 - 投稿一覧ページ

**ファイル**: `src/app/admin/x-posts/page.tsx`

```
- isAdmin() チェック（既存パターン踏襲）
- supabase から x_posts を status, created_at でソートして取得
- ステータスバッジ（下書き/予約/送信済/失敗）
- 各行に: タイトル / タイプ / 日時 / 編集リンク / 送信ボタン / 削除ボタン
- 送信ボタンは <form action={sendToTypefully}> で実装
- 削除ボタンは ConfirmDeleteButton（既存コンポーネント）を使う
- /admin/pages と同じUIパターンを踏襲（border, text-sm等）
```

---

### Task 6: 管理画面 - 新規作成ページ

**ファイル**: `src/app/admin/x-posts/new/page.tsx`

```
- post_type の <select>（tournament_result / quiz_silhouette / quiz_odd / announcement / custom）
- テンプレート選択時に thread_lines の初期値を localStorage でセット（Client Component）
- thread_lines: 各ツイートを <textarea> で個別編集
  - 「+ ツイート追加」ボタン
  - 各行に「削除」ボタン
  - 文字数カウンター（140文字警告）
- title: テキスト入力
- scheduled_at: datetime-local 入力（オプション）
- 送信: <form action={saveXPost}>
- 保存後: /admin/x-posts/[id] にリダイレクト
```

---

### Task 7: 管理画面 - 編集ページ

**ファイル**: `src/app/admin/x-posts/[id]/page.tsx`

```
- 既存データをフォームに初期値として表示
- 編集後「保存」→ saveXPost
- 「Typefullyに送る」ボタン → sendToTypefully（別 form）
- 送信済みの場合: Typefully の share_url を表示
- 画像セクション: 現在添付画像の表示 + 新規アップロード（後の Task で）
- /admin/x-posts への戻りリンク
```

---

### Task 8: 優勝カード画像生成 API

**ファイル**: `src/app/api/x-image/winner/route.ts`

```
依存: @vercel/og（npm install @vercel/og）

GET /api/x-image/winner
クエリ: card, player, event, deckName

- カード名からDMWiki画像URLを構築して fetch
- ImageResponse で JSX レイアウト組む（Section 9-2 参照）
- 背景: 黒グラデーション、金テキスト
- 戻り値: PNG (1200×675)
- エラー時: 404

Noto Sans JP フォントを public/fonts/ に配置して使う
```

---

### Task 9: シルエットクイズ画像生成 API

**ファイル**: `src/app/api/x-image/silhouette/route.ts`

```
GET /api/x-image/silhouette
クエリ: card（カード名）, hint（ヒント文）, reveal（true/false）

- reveal=false: カード画像を黒塗り（CSSフィルターでなく canvas で処理）
  - fetch でカード画像取得 → sharp または純JSで暗くする
  - @vercel/og の ImageResponse に埋め込み
- reveal=true: カード画像をそのまま表示
- レイアウト: Section 9-3 参照
- 戻り値: PNG (1200×675)
```

---

### Task 10: 違和感クイズ画像生成 API

**ファイル**: `src/app/api/x-image/odd/route.ts`

```
GET /api/x-image/odd
クエリ: cards（カンマ区切り4枚のカード名）, odd（違和感カード名）

- 4枚のカード画像を横並びにする
- odd に一致するカードのみ枠色を変える（答え確認用、通常は隠す）
- @vercel/og ImageResponse
- 戻り値: PNG (1200×675)
```

---

### Task 11: 管理画面ナビゲーション追加

**ファイル**: `src/app/admin/page.tsx`

```
- 既存の管理画面トップに「📣 X投稿管理」リンクを追加
- /admin/x-posts へのリンク
- 既存のボタンと同じスタイル踏襲
```

---

### Task 12: 環境変数追加

**ファイル**: `.env.local`（手動追加、Codexはコメントのみ記載）

```
# Typefully
TYPEFULLY_API_KEY=       # Typefully の Settings > API Keys から取得
```

**ファイル**: `.env.example`（または `.env.local.example`）

```
TYPEFULLY_API_KEY=your_typefully_api_key_here
```

---

## 13. Phase 2 以降のタスク（参考）

### Phase 2: 画像生成の高度化

- Task 13: カード画像キャッシュ（Supabase Storage）
- Task 14: 画像生成プレビュー（管理画面内 `<img>` タグで表示）
- Task 15: アップロード機能（Supabase Storage + 管理画面UI）

### Phase 3: 自動収集・スレッド生成

- Task 16: `x_reply_logs` への Apify 結果保存
- Task 17: リプライから掲示板スレッド自動生成ロジック
- Task 18: Cloudflare Worker cron 拡張（Typefully → Apify 連携）

### Phase 4: インサイト

- Task 19: X API v2 で投稿のいいね・RT 取得 → `x_posts.meta` に保存
- Task 20: 管理画面でインサイト表示

---

## 14. 実装順序（推奨）

```
Task 1 (DB) → Task 2 (Typefully lib) → Task 3 (Templates) → Task 4 (Actions)
→ Task 5 (一覧) → Task 6 (新規作成) → Task 7 (編集)
→ Task 11 (ナビ) → Task 12 (env)
→ 動作確認（手動投稿 → Typefully 送信）
→ Task 8 (優勝画像) → Task 9 (シルエット) → Task 10 (違和感)
```

---

## 15. 既存コードの活用パターン

Codex は以下の既存実装をパターンとして踏襲すること：

| 参照ファイル | 使うパターン |
|------------|------------|
| `src/app/admin/pages/actions.ts` | Server Actions の形式（use server, formData, revalidatePath） |
| `src/app/admin/pages/page.tsx` | 管理画面UI（ボタン, バッジ, フォーム, border スタイル） |
| `src/components/admin/ConfirmDeleteButton.tsx` | 削除確認ボタン |
| `src/lib/supabase-server.ts` | Supabase クライアント生成 |
| `src/app/admin/article-drafts/actions.ts` | 非 service_role な Server Action |
| `cloudflare/duema-cron-worker/src/index.ts` | Cloudflare Worker の拡張方法 |

---

*最終更新: 2026-05-14*
