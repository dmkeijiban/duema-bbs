<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

ChatGPT + Codex体制の運用ルールは `docs/chatgpt-codex-operations.md` を正本として参照する。

## UIの恒久ルール

- サイト全体の既存・新規を問わず、ボタン・リンク・カードなどの押下可能要素は、押した瞬間に視覚的な反応を返すこと。
- 遷移や処理に時間がかかる場合も、押下済み・処理中だと利用者が判別できる状態を維持すること。
- 新機能ごとに個別実装せず、原則として共通コンポーネント・共通CSSの仕組みを利用すること。
