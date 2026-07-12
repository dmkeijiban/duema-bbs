# 共通メーカー基盤 設計レビュー（PR #504 時点）

作成日: 2026-07-12
対象: PR #504 `feat/private-hall-of-fame-predictions`（head: 75ea143）
関連設計書: `docs/maker-platform.md` / `docs/maker-project-types.md` / `docs/maker-security.md`

---

## 1. 現行実装レビュー

PR #504 には実質 **3つの独立した機能** が同居している。

| 機能 | 場所 | DB | 状態 |
|---|---|---|---|
| A. 殿堂・プレ殿予想プロトタイプ | `src/app/admin/hall-of-fame-predictions/` | `cards` を直接読むだけ（保存なし） | localStorage下書きのみ |
| B. カードマスター取込 | `src/app/admin/cards/`, `src/lib/card-import.ts`, `api/admin/cards/import/*` | `cards` upsert | Preview限定書込 |
| C. DM26-EX2 Tier表メーカー | `src/app/admin/makers/dm26-ex2-charisma-best-tier/`, `src/lib/maker.ts` | `maker_*` 4テーブル + RPC | Preview限定書込 |

### 1-1. すでに共通化できている箇所（良い点）

- **DBスキーマは最初から汎用**。`maker_projects(type, config jsonb)` / `maker_project_cards` / `maker_submissions(UNIQUE(project_id,user_id))` / `maker_submission_items(group_key, position)` という構造は、Tier表・殿堂予想・9選・ランキング・投票のすべてを「カードをグループに割り当て、順序を付ける」として表現でき、**テーブル追加なしで将来企画の大半を吸収できる**。これは正しい設計判断。
- `save_maker_submission()` の「submission upsert → items全削除 → 再登録」を単一トランザクションにした点。1企画1ユーザー1回答の上書きモデルとして正しい。
- service role 限定実行（`revoke ... from public, anon, authenticated` + `grant execute to service_role`）、集計viewのanon/authenticated権限剥奪、RLS有効化＋policyなし（=service roleのみ）という安全側デフォルト。
- `cards` を図鑑（`zukan_cards`）から分離した共通カードマスターにし、`zukan_cards.card_id` で任意リンクする方針。図鑑の全カード化を待たずにメーカーを進められる。
- Preview限定書込ガード、noindex/nofollow、管理者Cookie＋Supabaseログインの二重認証。

### 1-2. Tier表専用になっている箇所（ハードコード一覧）

| 箇所 | 内容 | 問題 |
|---|---|---|
| `src/lib/maker.ts` | `TIER_GROUPS` 定数（s〜d＋Tailwindクラス） | グループ定義の正本その1 |
| `save_maker_submission()` 内 | `where x.group_key in ('s','a','b','c','d')` | 正本その2。**別typeの企画がこのRPCを使うと全itemが黙って捨てられる** |
| `maker_projects.config` | `{"groups":[...]}` を保存済み | 正本その3だが**どこからも読まれていない（死んだ設定）** |
| `maker_tier_aggregates` view | `s_count`〜`d_count` カラム、`s=5..d=1` のスコア変換 | Tier表専用集計。企画typeごとにviewが増殖する起点 |
| `actions.ts` | slug `'dm26-ex2-charisma-best-tier'` 直書き、`TIER_GROUPS`での検証 | 企画ごとにactionを複製する構造 |
| `TierMaker.tsx` | グループ描画・色・「未評価へ戻す」 | UIとグループ定義の密結合 |

**グループ定義の正本が3箇所**（TSの定数 / RPCのIN句 / config JSONB）に分裂しているのが最大の構造問題。2つ目の企画を追加した瞬間にこの3箇所すべてへ手を入れることになり、ズレたときの故障モードが「RPCが黙ってitemを捨てる」なので発見が遅れる。

### 1-3. 重複実装がすでに発生している箇所

殿堂予想プロトタイプ（A）とTier表（C）は**同一ドメインの二重実装**になっている。

- `Picks = Record<PredictionType, string[]>`（A）と `MakerDraft = Record<string, string[]>`（C）は同じ型
- 殿堂予想の `premium / hall / release` は、Tier表の `s〜d` と同じ「グループセット」。`maker_projects` に `type='prediction'` の1行を足せば表現できるのに、Aは `cards` 直読み＋独自state＋独自localStorageキーで別実装
- カード画像フォールバック（`Img` / `CardImage`）、検索＋文明/コスト/種類フィルタ、カード選択モーダル、localStorage下書き（キー命名も `maker-draft:...:v1` と `admin-hall-of-fame-prediction-draft-v1` で不統一）がコピペ関係
- 管理者Cookie検証→redirect→Supabaseユーザ確認のボイラープレートが両page.tsxに重複
- `process.env.VERCEL_ENV !== 'preview'` ガードが `card-import.ts` と `actions.ts` に重複

1つのPR内で既に二重実装が起きているのは、このまま企画を足すとN重実装になる強いシグナル。

### 1-4. 責務が混ざっている箇所

- `makers/.../page.tsx`（Server Component）が、認証・project取得・card pool取得・既存回答のdraft復元まで全部を1つの `try/catch` で包み、**全エラーを握りつぶして `unavailable=true`** にしている。migration未適用と実バグの区別がつかない。
- `actions.ts` が「認可・payload検証・project解決・RPC呼出」を全部持つ。検証ロジック（重複禁止・group key）はRPC側にも半分ある（二重管理かつ内容が非対称）。
- `TierMaker.tsx` は**全コードが数行に圧縮された1行JSX**で、state管理・フィルタ・DnD代替UI・モーダル・プレビュー枠が単一コンポーネントに同居。レビュー不能・修正困難であり、共通化以前にメンテナンス上の負債。

### 1-5. このまま拡張すると破綻する箇所

1. **RPCの黙殺フィルタ**: `join maker_project_cards`（pool外除外）と `where group_key in (...)`（不正group除外）が**例外を投げずに行を捨てる**。楽観UIで「保存しました」と出るのに実際は一部しか保存されていない状態が起こり得る。企画が増えるほど「保存されない」問い合わせがデバッグ不能になる。
2. **企画typeごとのview増殖**: `maker_tier_aggregates` 方式を踏襲すると、殿堂予想用view・9選用view・ランキング用view…とtype数だけ専用viewとRPCが増える。
3. **期間・状態・公開の未実装**: `maker_projects.status` / `is_public` は存在するが保存パスで一切チェックされない。`start_at/end_at` カラム自体がない。一般公開した瞬間に「締切後も保存できる」「draft企画に投稿できる」が事故になる。
4. **`maker_submission_items` の表現力不足**: PK `(submission_id, card_id)` は「1回答内で同一カード1回」を強制する。Tier表には正しいが、「カードごとの5段階評価＋コメント」のような**カードに紐づく値**を持つ企画は group_key の濫用でしか表現できない（対応案は設計書参照）。
5. **`cards.normalized_name` UNIQUE**: 同名別カード（再録別イラスト、《〜》表記ゆれ、ツインパクトの面）を1行に潰す前提。現段階の「代表カード」方針としては妥当だが、コメントにある通り将来の収録版管理を子テーブルにする判断を維持すること。

---

## 2. 問題点一覧（3分類）

### 今すぐ直すべき（PR #504 の中で）

| # | 問題 | 直し方 |
|---|---|---|
| 1 | グループ定義の正本が3箇所 | `maker_projects.config` を唯一の正本にし、page/action/RPCはconfigから読む（設計書§3） |
| 2 | RPCが不正itemを黙って捨てる | pool外カード・不正group_keyは `raise exception` にする（migration draftの修正なので適用不要・SQL文面だけ直す） |
| 3 | `TierMaker.tsx` の1行圧縮コード | 通常のフォーマットに展開。共通化はまだしなくてよいが、可読性は今直さないと後続作業全部が高コスト化 |
| 4 | 殿堂予想プロトタイプ（A）の二重実装 | 「捨てるプロトタイプ」と明記するコメント＋`docs`参照を入れるか、`maker_projects` に `type='prediction'` の企画として載せ替える。**同PRで2実装を並走させたままmainに入れない** |
| 5 | page.tsx の全握りつぶしtry/catch | 「テーブル未作成」だけを判別して `unavailable` にし、他はthrow（Sentryに乗せる） |
| 6 | Preview書込ガードの重複 | `src/lib/maker/guards.ts` に `assertMakerWriteAllowed()` として集約 |

### 後でよい（Phase 2〜4 で）

- UIコンポーネントの完全共通化（`MakerShell` 等）— **2つ目の企画を作るときにやる**のが最も安全（1例からの抽象化は外しやすい）
- `start_at/end_at/visibility/result_visibility/created_by` カラム追加と保存時チェック
- 汎用集計view＋集計RPC＋少数回答秘匿
- 画像生成（satori/ImageResponseベース、設計書§8）
- items への `value` カラム追加（5段階評価・自由記述対応）
- materialized view / キャッシュ（回答数が数千を超えてから）

### やらない方がよい

- **企画typeごとの専用テーブル追加**（`maker_tier_items`, `maker_prediction_items`...）。個人運営×多数の小企画では管理コストが利益を上回る。共通テーブル＋config JSONB＋アプリ層schema検証で吸収する（比較は設計書§4）
- **Zustand等の状態管理ライブラリ導入**。メーカーは1ページ完結・単一ツリーで、`useReducer`＋propsで足りる。依存を増やさない
- **リアルタイム集計・Supabase Realtime**。掲示板企画の集計は「締切後に見る」が主で、鮮度要求が低い
- **html-to-image系のクライアント画像生成**。フォント・CORS・端末差でスクショ品質が安定しない。サーバ生成に寄せる
- **今の時点でのDnDライブラリ導入**。タップ→モーダルで移動のUXはSP実機で十分機能しており、DnDはPC向け強化として後日
- **`cards` の完全カードDB化を先にやること**。企画に必要なカードだけ取込む現方針を維持

---

## 3. 結論（意思決定事項）

### Q1. PR #504 を現状のまま進めてよいか

**条件付きYES。** draft PR・管理者限定・noindex・Preview限定書込であり、公開面のリスクはない。ただしmainに入れる前に「今すぐ直すべき」6点（上表）を反映すること。特に #1（config正本化）と #2（RPC黙殺廃止）は、**この上に企画を積み始めてからでは直すコストが跳ね上がる**。

### Q2. 共通化してから DM26-EX2 を完成させるべきか / 完成後に共通化すべきか

**「薄い共通化 → DM26-EX2完成 → 2企画目でUI共通化」の順を推奨。**

- 先にやる薄い共通化（1〜2日規模）: config正本化・RPC厳格化・共有ガード・型を `src/lib/maker/` に整理。ここまでやればDM26-EX2は「共通基盤の最初の利用者」になる。
- DM26-EX2をその上で完成させる（画像プレビュー・保存の実地検証を含む）。
- UI共通コンポーネント（`MakerShell` 等）への切り出しは、**殿堂予想を共通基盤上で作り直すタイミング**で、2つの実例から抽象化する。1例だけからの共通化は誤った抽象を生みやすい。

「完全共通化を先に」は過剰設計（企画が本当に増えるかまだ未検証）、「完成後に共通化」はTier表専用コードの上に2企画目が乗ってしまうリスクがあり、どちらも推奨しない。

### Q3. 今回どこまで変更するのが最も安全か

**今回（本ブランチ）は設計書・ルール文書の追加のみ。** コード変更はPR #504側で「今すぐ直すべき」6点に限定し、migration draftはSQL文面の修正のみ（適用はPreview検証フローで別途）。UI共通化・集計・画像生成は着手しない。

---

## 4. AGENTS.md への追記案（文案）

以下をAGENTS.md末尾に追記することを提案する（本レビューでは適用していない）。

```markdown
## メーカー企画（Tier表・殿堂予想・9選など）

カードを選ぶ・並べる・保存する・集計する企画は、必ず共通メーカー基盤に載せる。
設計と実装ルールの正本: docs/maker-platform.md / docs/maker-security.md

- 企画ごとに保存ロジック・画像生成・カードテーブルを複製しない
- 保存は save_maker_submission() 経由の単一トランザクションのみ
- グループ定義の正本は maker_projects.config。TS定数やSQLに複製しない
- Production DBへ直接migrationしない。Previewで実地検証してから適用
- 非公開企画は導線・sitemap・indexの対象にしない
- service role クライアントをClient Componentへ渡さない
```
