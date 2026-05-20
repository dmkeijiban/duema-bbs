---
description: バグ原因調査・修正案提示（エラーメッセージ or ファイル指定）
---

# 🔥 Codex バグ救助

エラーを受け取って原因を特定し、修正案を提示する。

## 使い方

```
/codex:rescue error="<エラーメッセージ>"
/codex:rescue error="<エラーメッセージ>" file=<対象ファイル>
/codex:rescue file=<対象ファイル>    # 挙動がおかしいファイルを調査
```

## 実行手順

1. **エラーメッセージを解析**
   - スタックトレースからファイル名・行番号を抽出
   - エラーの種類（ランタイム / ビルド / 型エラー / Supabase / Next.js）を判定

2. **原因ファイルを特定**
   - `file=` 指定があればそのファイル、なければスタックトレースから推定
   - 関連ファイル（インポート元・型定義・マイグレーション等）も確認

3. **根本原因を特定**
   - コードを読んでエラーが発生する条件を説明
   - 「なぜこのエラーが出るか」を1〜2行で明確に示す

4. **修正案を提示**
   - 最小変更の修正コードを提示（diff 形式）
   - 副作用がある場合はその旨を明記
   - 代替案がある場合は2〜3パターン提示

5. **検証方法を提示**
   - 修正後に実行すべきコマンド（`npm.cmd run lint`、`npm.cmd run build` など）
   - 再現テストの手順

## よくあるパターン

| エラーパターン | 確認すべき箇所 |
|---|---|
| `TypeError: Cannot read properties of undefined` | null チェック漏れ、非同期処理の await 忘れ |
| Supabase RLS エラー | `alter table ... enable row level security` + policy 設定 |
| Next.js ビルドエラー | `node_modules/next/dist/docs/` の最新規約確認 |
| `Module not found` | パスエイリアス設定、tsconfig.json の paths |
| Vercel デプロイ失敗 | 環境変数の設定漏れ、Edge Runtime 非対応 API |

## ルール

- 原因不明の場合：「不明」と正直に報告し、追加で必要な情報を列挙する
- 複数の修正箇所がある場合：優先度順に列挙する
- 修正コードは必ず `lint/build` が通ることを確認してから提示する
