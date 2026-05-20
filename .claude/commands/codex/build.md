---
description: DBスキーマ → API → 管理画面を一括生成
---

# 🏗️ Codex フィーチャービルド

テーブル名を受け取って、スキーマ・API・管理画面を一括生成する。

## 使い方

```
/codex:build schema=<テーブル名> label=<表示名>
/codex:build schema=x_posts label="X投稿管理"
```

## 実行手順

### 1. 既存スキーマ確認
- `supabase/migrations/` 内の該当テーブルの SQL を読む
- 既存の型定義（`src/types/` など）を確認

### 2. Supabase マイグレーション生成（未適用の場合）
- `supabase/migrations/YYYYMMDD_<table>.sql` を生成
- テーブル定義・インデックス・RLS ポリシー・updated_at トリガーを含める
- `create table if not exists` を使って冪等性を保つ

### 3. TypeScript 型定義生成
- `src/types/<table>.ts` に型定義を生成
- Supabase の Database 型と整合させる

### 4. API Route 生成
- `src/app/api/<table>/route.ts`（一覧取得・作成）
- `src/app/api/<table>/[id]/route.ts`（詳細・更新・削除）
- service role key を使ったサーバーサイド処理
- エラーハンドリング・バリデーションを含める

### 5. 管理画面生成
- `src/app/admin/<table>/page.tsx`（一覧）
- `src/app/admin/<table>/[id]/page.tsx`（詳細・編集）
- shadcn/ui コンポーネントを使用
- ページネーション・検索・ソート機能を含める

### 6. 動作確認
- `npm.cmd run lint && npm.cmd run build` を実行
- エラーがあれば修正してから報告

## 生成物レポート形式

```
## 生成完了: <label>

### 生成ファイル
- [ ] supabase/migrations/YYYYMMDD_<table>.sql
- [ ] src/types/<table>.ts
- [ ] src/app/api/<table>/route.ts
- [ ] src/app/api/<table>/[id]/route.ts
- [ ] src/app/admin/<table>/page.tsx
- [ ] src/app/admin/<table>/[id]/page.tsx

### 次の手順
1. Supabase Dashboard > SQL Editor でマイグレーションを実行
2. /admin/<table> を開いて動作確認
3. 公開前に RLS ポリシーを確認
```

## ルール

- 管理画面は `/admin/` 配下にのみ生成（公開ページには追加しない）
- API は必ず認証チェックを含める（`Authorization: Bearer <service_role_key>`）
- `AGENTS.md` の「触らないファイル」を確認してから生成する
- 既存ファイルへの変更は最小限に留める
