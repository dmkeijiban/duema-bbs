# 殿堂解除選手権 ラベル共通化

## 原因

- メーカー本体は `TierMaker` の専用指定で「殿堂解除／予想」の2行と黄オレンジ配色を使っていた。
- 登録作品の一覧・詳細・保存画像は、後から追加された `MakerSubmissionBoard` 内に独自のラベル文言、配色、枠色、幅を持っていた。
- 一覧だけ `compactGroupLabel="殿堂\n解除\n予想"` と28px幅を指定し、保存画像も同じファイルで薄ベージュ背景・黒枠・3行を再定義していた。
- そのためメーカーまたは画像側を直しても、一覧用実装が別のまま残り再発した。

## 修正

- `src/lib/hall-release-design.ts` を文言、色、枠色、ラベル幅、Canvas設定の正本にした。
- `HallReleaseLabel` が明示的な2個の要素で「殿堂解除」「予想」を描画し、自然改行を禁止する。
- メーカー、一覧、詳細、編集、保存PNG、X共有用PNGが同じ正本を参照する。
- `release` グループだけに適用し、通常Tier表のラベル仕様は変更しない。

## 確認

- TypeScript: 成功。
- ESLint: error 0（既存warningのみ）。
- `git diff --check`: 成功。
- production build: compile・TypeScript成功。隔離worktreeにSupabase環境変数がないため、既存 `/summary/[slug]` のpage data収集で停止。
- Preview／本番: PC・スマホ、一覧・詳細・編集・画像保存、カード1・4・7・10枚を確認する。
