# 共通メーカー基盤 設計書

作成日: 2026-07-12
前提: PR #504（DM26-EX2 Tier表 / 殿堂予想プロトタイプ / cardsマスター）
レビュー結果: `docs/maker-platform-review.md`
企画typeカタログ: `docs/maker-project-types.md`
セキュリティ: `docs/maker-security.md`

---

## 1. 基本方針

すべてのメーカー企画を **「カードプールからカードを選び、グループへ割り当て、順序を付け、1人1回答として保存し、集計し、画像として共有する」** という単一のドメインモデルに正規化する。

- 企画typeごとにテーブル・保存ロジック・画像生成を複製しない
- 差分は `maker_projects.config`（JSONB）と、アプリ層のconfig schema検証で吸収する
- **configがグループ定義・制約の唯一の正本**。TS定数やRPC内のIN句へ複製しない

## 2. 共通ドメインモデル

```
MakerProject（企画）
 ├─ type: 'tier' | 'prediction' | 'selection' | 'ranking' | 'vote' | 'rating'
 ├─ status: 'draft' | 'open' | 'closed' | 'archived'
 ├─ visibility: 'admin' | 'members' | 'public'      … 回答画面を誰が見られるか
 ├─ result_visibility: 'admin' | 'after_close' | 'realtime'  … 集計を誰がいつ見られるか
 ├─ start_at / end_at: 回答受付期間（null = 制限なし）
 ├─ created_by: auth.users参照（owner）
 ├─ config: 企画typeごとの設定JSON（§3）
 └─ MakerProjectCard[]（card pool = この企画で選べるカード集合、sort_order付き）

MakerSubmission（回答）… UNIQUE(project_id, user_id)。再保存は全置換上書き
 └─ MakerSubmissionItem[]
     ├─ card_id   … card pool内のカードのみ
     ├─ group_key … configで定義されたグループのみ（tierの's'、予想の'premium'、9選の'picks'…）
     ├─ position  … グループ内の順序（rankingでは順位そのもの）
     └─ value     … 数値回答が必要なtype用（5段階評価など。Phase 3で追加、§5-3）
```

各概念の対応:

| 要求概念 | 実現方法 |
|---|---|
| project / project type | `maker_projects.type`。**typeは「UI・集計テンプレの選択子」**であり、保存スキーマは全type共通 |
| card pool | `maker_project_cards`。pool外カードの保存はRPCがエラーで拒否 |
| group / tier / slot | `config.groups[]`（key, label, 表示色, scoreなど）。「未評価」はグループではなく**未割当**（itemを作らない） |
| order | `position`。順序が意味を持つかは `config.ordered` |
| choice limit | `config.limits`（total / perGroup / perCard） |
| duplicate rule | PK `(submission_id, card_id)` で「1回答内で同一カード1回」を常時強制。複数回使いたい企画は現状想定しない |
| answer overwrite | `save_maker_submission` のupsert＋全置換。UNIQUE制約が1企画1ユーザー1回答を担保 |
| visibility / status / 期間 | 専用カラム（JSONBに入れない。クエリ・indexしたい属性はカラムにする） |
| aggregation mode | `config.aggregate`（countGroups / scoreMap / rankPoints など、§7） |
| share image template | `config.image.template`（'tierGrid' / 'pickGrid' / 'rankedList' / 'badgeList'、§8） |
| authentication requirement | `visibility` ＋ `config.requireLogin`（デフォルトtrue）。管理者限定は `visibility='admin'` |

## 3. config schema（typeごとの差分吸収）

JSONBは自由記述にせず、**アプリ層のschemaで必ず検証**する。バリデータは依存を増やさず手書きする（zod導入はUIフォーム化するときに再検討）。

```ts
// src/lib/maker/config.ts（新設案）
export type MakerGroupDef = {
  key: string          // 's' | 'premium' | 'picks' ...
  label: string
  color?: string       // Tailwindクラス。UIヒントであり検証対象外
  score?: number       // 平均スコア集計に使う重み（tier: s=5..d=1）
}

export type MakerConfig = {
  groups: MakerGroupDef[]        // 1個以上。keyはユニーク
  ordered: boolean               // グループ内順序が意味を持つか
  limits?: {
    total?: { min?: number; max?: number }        // 回答全体の枚数
    perGroup?: Record<string, { min?: number; max?: number }>
  }
  aggregate: 'countGroups' | 'scoreAverage' | 'rankPoints' | 'selectionRate'
  image?: { template: 'tierGrid' | 'pickGrid' | 'rankedList' | 'badgeList'; title?: string }
  requireLogin?: boolean         // default true
  minResultRespondents?: number  // 集計公開の最低回答数（default 5、§7-4）
}

export function parseMakerConfig(raw: unknown): MakerConfig // 不正なら throw
```

保存Server Action・保存RPC・集計・UIはすべて `maker_projects.config` を読む。`src/lib/maker.ts` の `TIER_GROUPS` 定数と、RPC内の `in ('s','a','b','c','d')` は廃止する。

各企画typeの具体的なconfig例は `docs/maker-project-types.md` を参照。

## 4. 「専用テーブル案」と「共通テーブル＋config案」の比較

| 観点 | A: typeごと専用テーブル | B: 共通テーブル＋config（推奨） |
|---|---|---|
| 新企画の追加コスト | migration＋RPC＋view＋型を毎回追加 | `maker_projects` に1行INSERT＋configだけ |
| DB整合性 | CHECK/FKで強く担保できる | group_key等はRPC内でconfig照合（§5-2）。DBだけ見ると弱い |
| 集計 | typeごとに最適化しやすい | 汎用view＋aggregate modeで共通化（§7） |
| スキーマの見通し | テーブル数が企画数に比例して劣化 | 4テーブル固定 |
| 個人運営との相性 | migration運用負荷が高い（Preview検証×本番適用が毎回発生） | migrationは基盤変更時のみ |

**結論: B を採用。** 理由は (1) 全企画が「カード×グループ×順序」に正規化できることをPR #504の2実装（Tier表・殿堂予想）が実証済み、(2) 個人運営でProduction migrationの頻度を最小化したい、(3) 企画は多産多死でスキーマより速く増える。
整合性の弱さは「保存経路をRPC1本に絞り、RPCがconfigで検証する」ことで補う（DB外から不正データが入る経路が存在しない）。

## 5. DB設計（推奨スキーマ）

### 5-1. 現行draftへの修正（`supabase/migrations/drafts/20260712_maker_tier.sql` を直す。適用はしない）

```sql
-- maker_projects: 期間・可視性・作成者を追加、statusをCHECK
alter table public.maker_projects
  add column if not exists visibility text not null default 'admin'
    check (visibility in ('admin','members','public')),
  add column if not exists result_visibility text not null default 'admin'
    check (result_visibility in ('admin','after_close','realtime')),
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz,
  add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.maker_projects
  add constraint maker_projects_status_check
    check (status in ('draft','open','closed','archived'));
-- is_public は visibility に置き換えて廃止（draft段階なので作り直しでよい）
```

- `maker_project_cards`: 現状のPK `(project_id, card_id)` ＋ cascade でよい。card poolの並び用に `(project_id, sort_order)` はPKで概ね足りるが、poolが大きい企画向けに `create index on maker_project_cards(project_id, sort_order)` を追加
- `maker_submissions`: 現状維持。`UNIQUE(project_id, user_id)` が回答一意性とproject別検索indexを兼ねる。`is_valid` は「運営が無効化した回答を集計から除く」用途と定義をコメントに明記（無定義フラグにしない）
- `maker_submission_items`: PK `(submission_id, card_id)` 維持。集計はsubmission経由でproject_idに辿れるため追加indexは当面不要。回答数が万単位になったら `(card_id)` indexを検討
- 削除時挙動: すべて `on delete cascade` で正しい。**企画削除より `status='archived'` を推奨**（回答データは資産）
- `position` に `check (position >= 0)` を追加

### 5-2. save_maker_submission() v2（黙殺廃止＋config検証）

現行の「JOINとWHEREで不正行を静かに落とす」実装を、**例外で拒否する**実装に置き換える。楽観UIと整合させるには「保存成功＝全item保存済み」が保証されている必要がある。

```sql
create or replace function public.save_maker_submission(
  p_project_id uuid, p_user_id uuid, p_items jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_project record;
  v_submission_id uuid;
  v_count int;
begin
  select * into v_project from maker_projects where id = p_project_id for update;
  if not found then raise exception 'MAKER_PROJECT_NOT_FOUND'; end if;
  if v_project.status <> 'open' and v_project.status <> 'draft' then
    raise exception 'MAKER_PROJECT_CLOSED';
  end if;
  if v_project.start_at is not null and now() < v_project.start_at then raise exception 'MAKER_NOT_STARTED'; end if;
  if v_project.end_at   is not null and now() > v_project.end_at   then raise exception 'MAKER_ENDED'; end if;

  v_count := jsonb_array_length(coalesce(p_items, '[]'::jsonb));
  if v_count > 500 then raise exception 'MAKER_TOO_MANY_ITEMS'; end if;

  insert into maker_submissions (project_id, user_id, is_valid, updated_at)
  values (p_project_id, p_user_id, true, now())
  on conflict (project_id, user_id) do update set is_valid = true, updated_at = now()
  returning id into v_submission_id;

  delete from maker_submission_items where submission_id = v_submission_id;

  insert into maker_submission_items (submission_id, card_id, group_key, position)
  select v_submission_id, x.card_id, x.group_key, x.position
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
       as x(card_id uuid, group_key text, position int);

  -- pool外カードは拒否（黙殺しない）
  if exists (
    select 1 from maker_submission_items i
    left join maker_project_cards pc
      on pc.project_id = p_project_id and pc.card_id = i.card_id
    where i.submission_id = v_submission_id and pc.card_id is null
  ) then raise exception 'MAKER_CARD_NOT_IN_POOL'; end if;

  -- group_keyはconfigの正本と照合（TS定数やIN句に複製しない）
  if exists (
    select 1 from maker_submission_items i
    where i.submission_id = v_submission_id
      and i.group_key not in (
        select jsonb_array_elements(v_project.config->'groups')->>'key')
  ) then raise exception 'MAKER_INVALID_GROUP'; end if;

  return v_submission_id;
end $$;
revoke all on function public.save_maker_submission(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.save_maker_submission(uuid,uuid,jsonb) to service_role;
```

設計上のポイント:

- **`for update` によるproject行ロック**は不要な直列化を招くため、実際は `for share` か無ロックでもよい（statusは頻繁に変わらない）。同一ユーザーの同時保存は `on conflict` ＋ 全置換により「後勝ち」で自然に冪等
- limits（total/perGroup）の検証は**Server Action側（config読込済み）で行い、RPCは構造的不変条件（pool・group・件数上限・期間・status）だけを守る**二段構え。SQLでJSONB limitsを解釈するのは複雑さに見合わない
- エラーは `MAKER_*` の機械可読コードで投げ、Server Actionがユーザー向け日本語に変換する
- 管理者検証中は `status='draft'` でも保存可とする（上のコードの通り）。一般公開後は `open` のみ
- 冪等性: 同一payloadの再実行は同一結果（全置換）。リトライ安全

### 5-3. 将来拡張: value カラム（Phase 3）

「カードごとの5段階評価」は `groups: ['1'..'5']` で表現できる（§`maker-project-types.md`）ため、**当面カラム追加は不要**。自由記述コメントや複合値が必要になった時点で `value jsonb` を items に追加する。先回りで足さない。

### 5-4. JSONBを使う/使わない基準

- 使う: グループ定義、制約、集計モード、画像テンプレ指定 — **企画ごとに形が違い、SQLでWHEREしない**もの
- 使わない: status / visibility / 期間 / created_by — **一覧クエリ・index・FKが欲しい**もの。回答item本体（正規化テーブルでないと集計できない）

## 6. 保存API設計（Server Action）

保存経路は **共通Server Action 1本**に集約する。企画ごとのactions.tsを複製しない。

```ts
// src/lib/maker/actions.ts（新設案）
'use server'
export async function saveMakerSubmission(slug: string, draft: MakerDraft):
  Promise<{ ok: boolean; message: string }>
```

処理順:

1. `assertMakerWriteAllowed()` — 環境ガード（現在: `VERCEL_ENV === 'preview'` のみ許可。本番開放時にこの関数だけ変える）
2. 認証: `visibility='admin'` なら管理者Cookie検証。全企画共通でSupabaseユーザー必須
3. project解決（slug→id, config取得）と `parseMakerConfig()`
4. アプリ層検証: limits（total/perGroup min/max）、ordered時のposition連番正規化、重複カードの事前検出（UX用。最終防衛はDB）
5. `save_maker_submission` RPC呼出（service role）
6. `MAKER_*` エラーコード → 日本語メッセージ変換

## 7. 集計基盤

### 7-1. 汎用view（typeごとのviewを増やさない）

```sql
create or replace view public.maker_card_group_counts as
select s.project_id, i.card_id, i.group_key,
       count(*)::int as pick_count,
       avg(i.position)::numeric(6,2) as avg_position
from public.maker_submissions s
join public.maker_submission_items i on i.submission_id = s.id
where s.is_valid
group by s.project_id, i.card_id, i.group_key;

create or replace view public.maker_project_respondents as
select project_id, count(*)::int as respondent_count
from public.maker_submissions where is_valid group by project_id;

revoke all on public.maker_card_group_counts, public.maker_project_respondents
  from anon, authenticated;
```

この2つのviewから、全企画の指標が導出できる:

| 指標 | 導出 |
|---|---|
| S評価数 / 殿堂予想数 / 再録希望数 | `pick_count where group_key='s'` 等 |
| 平均Tier / 平均評価 | `Σ(score(group_key) × pick_count) / Σpick_count`（scoreは config.groups[].score） |
| 評価人数・選択率・予想率・採用率 | `pick_count / respondent_count` |
| 1位票 | `pick_count where group_key='rank' and position=0`（positionでの絞り込みが必要な場合はviewに `position` を残すバリアント or 直接クエリ） |
| 平均順位 | `avg_position + 1` |

`maker_tier_aggregates` は上記viewの上に載る**互換view or アプリ層変換**に置き換えて廃止する。

### 7-2. 公開はRPC経由のみ

viewはservice role専用のまま、公開用に SECURITY DEFINER RPC を1本置く:

```sql
create function public.get_maker_results(p_slug text) returns jsonb ...
-- 内部で result_visibility / status / minResultRespondents を検証してから集計を返す
```

- `result_visibility='admin'` → 管理者以外は空
- `'after_close'` → `status='closed'` 以降のみ
- 回答数 < `config.minResultRespondents`（default 5）→ 秘匿（「回答が集まると表示されます」）。少数回答時に個人の回答が透けるのを防ぐ

### 7-3. 性能方針

- 想定規模（回答数百〜数千、item数万）では**通常viewで十分**。計測せずにmaterialized viewを導入しない
- 公開結果ページはNext.js側で `revalidate`（60〜300秒）キャッシュ。これが事実上の集計キャッシュになる
- 回答が万単位になったら: materialized view＋締切時 or cron refresh（`docs/codex-weekly-routines.md` の運用に載せる）。リアルタイム集計はやらない

## 8. 画像共有基盤

### 8-1. 生成方式

**サーバサイド生成（`next/og` の `ImageResponse`＝satori）を推奨。**

- 既存の `api/x-image/*` は SVG文字列→sharp だが、`font-family="sans-serif"` 頼みで**日本語フォントの明示ロードがなく、実行環境依存**。メーカー画像はカード名の日本語密度が高く、この方式は破綻リスクがある
- satoriはフォントデータを明示的に渡す方式（Noto Sans JPサブセットを `assets/fonts/` に同梱）で、JSXでテンプレートを書ける。flexboxサブセットの制約はグリッド系レイアウトなら問題にならない
- カード画像は `image_url` をfetchして埋め込み。**画像なしカードは名前タイルにフォールバック**（現行 `Img` コンポーネントと同じ思想）。ツインパクト等の縦長比率差は `object-fit: cover` 相当（aspect 63:88固定枠）で吸収
- Vercel制約: Edge/Nodeのレスポンスサイズ・実行時間内に収めるため、1枚あたりカード画像は最大 ~60枚、サイズは 1200×1200 / 1200×675（OGP用）の2種に限定

### 8-2. テンプレート構造

```
/api/maker/[slug]/image?user=<id>&template=<tierGrid|pickGrid|rankedList|badgeList>
```

- テンプレは `config.image.template` で選択。**typeごとに画像ルートを増やさない**
- `tierGrid`: Tier表（行=グループ）、`pickGrid`: 9選/再録希望（N×Mグリッド）、`rankedList`: ランキング（順位付き縦リスト）、`badgeList`: 殿堂予想（カード＋区分バッジ）
- ブランド統一: 全テンプレ共通のヘッダ/フッタ（「デュエマ掲示板」ロゴ・企画タイトル・URL）を共通レイアウト関数で描く
- スマホ保存: 生成PNGを `<img>` 表示＋長押し保存で足りる。X共有はWeb Intent＋OGP（結果ページの `opengraph-image` にこのルートを流用）
- アクセス制御: 非公開企画の画像ルートは管理者Cookie必須。公開企画でも `user` パラメータで他人の回答画像を出すのは本人＋管理者のみ（§security）

## 9. UIコンポーネント設計

配置: `src/components/maker/`。**切り出しは2企画目の実装時**（`maker-platform-review.md` §3-Q2）。

| コンポーネント | 責務 | 主なprops | 種別 | 状態 |
|---|---|---|---|---|
| `MakerShell` | 企画1件のクライアント側ルート。reducer保持、下書き/保存/復元の司令塔 | `project`(slug,title,config), `cards`, `serverDraft` | client | useReducer本体 |
| `ProjectHeader` | タイトル・期間・状態バッジ・非公開表示 | `project` | server | なし |
| `CardPoolPanel` | 検索＋フィルタ＋未割当カードグリッド（現TierMakerのaside） | `cards`, `usedIds`, `onPick` | client | ローカル(query/filters) |
| `CardFilterBar` | 文明/コスト/種類/レギュのselect群 | `options`, `value`, `onChange` | client | 制御 |
| `CardPickerModal` | カード拡大＋移動先グループ選択（現モーダル） | `card`, `groups`, `onMove`, `onClose` | client | なし |
| `SelectedCardItem` | 配置済カード1枚（画像フォールバック・並び替えボタン） | `card`, `onSelect`, `onReorder?` | client | なし |
| `GroupBoard` | tier/prediction系: グループ行の集合 | `groups`, `draft`, `byId`, handlers | client | なし（親のreducer） |
| `RankedList` | ranking/9選系: 順位付き1列 | `items`, `max`, handlers | client | なし |
| `SubmissionToolbar` | リセット/保存/保存状態表示 | `onSave`, `onReset`, `saveState` | client | なし |
| `DraftRecovery` | 「端末に下書きがあります。復元しますか？」バナー | `localDraft`, `onRestore`, `onDiscard` | client | なし |
| `SharePreview` | 完成画像プレビュー（imageルートの `<img>`） | `slug`, `template` | client | なし |
| `ResultSummary` | 集計表示（get_maker_results結果の描画） | `results`, `config` | server | なし |
| `MobileBottomActions` | SP下部固定の保存/プレビューバー | `SubmissionToolbar` のSPラッパ | client | なし |

原則: **stateは `MakerShell` のuseReducerに一元化**し、下位はすべてprops駆動の表示コンポーネント。`GroupBoard`/`RankedList` だけがtypeで差し替わり、他は全企画共通。

## 10. 状態管理

**採用: useReducer＋（必要なら）Context。Zustand/Jotai等は導入しない**（1ページ完結・ツリー浅い・依存最小方針）。Server Actionsは保存専用で、状態はクライアント側が正。

```ts
type MakerState = {
  draft: MakerDraft                      // group_key -> card_id[]（正）
  baseline: MakerDraft                   // サーバ保存済み回答（差分判定用）
  save: 'idle' | 'saving' | 'saved' | 'error'
  saveError?: string
  pendingLocalDraft?: MakerDraft         // 復元確認待ちのlocalStorage下書き
}
```

| 要求 | 方式 |
|---|---|
| localStorage draft | キーを `maker-draft:{slug}:v{configVersion}` に統一。`{ savedAt, draft }` を保存。configVersionは `maker_projects.updated_at` 由来（card pool/グループ変更時に旧下書きを自動失効） |
| server保存済み回答 | page.tsx(RSC)が読み、`serverDraft` として渡す。マウント時 `baseline` に設定 |
| 復元確認 | 現行の「localStorageで黙って上書き」をやめ、**server回答とlocal下書きが両方あり差分がある場合のみ `DraftRecovery` バナーで選ばせる**。localのみ→自動復元、serverのみ→server採用 |
| 未保存変更 | `draft !== baseline`（構造比較）。`beforeunload` 警告＋保存ボタンの活性制御 |
| 楽観UI | 保存は明示ボタン式なので楽観更新は不要。`saving` 表示→成功で `baseline=draft` |
| 保存失敗・再試行 | `save='error'`＋メッセージ＋同ボタンで再試行。draftはlocalStorageに常時あるので消失しない |
| 別端末競合 | 全置換上書きの「後勝ち」を仕様とする（1人1回答の企画で楽観ロックは過剰）。将来必要なら `maker_submissions.updated_at` をクライアントへ返しifMatch検証 |
| 締切後編集不可 | RSCで `status/end_at` を見てUIを閲覧モードに。最終防衛はRPC（§5-2） |

## 11. 段階的移行計画

### Phase 1: 薄い共通化（PR #504内で完了させる）

- 変更対象: `src/lib/maker.ts` → `src/lib/maker/{types,config,guards}.ts` に再編。`parseMakerConfig` 導入。TierMakerのpage/actionをconfig駆動化。`TierMaker.tsx` の可読フォーマット展開。RPC draft SQLをv2（§5-2）に書き換え。殿堂予想プロトタイプの扱い決定（捨てる注記 or maker企画化）
- migration: **draftファイルの文面修正のみ。適用なし**（Preview DBへの再適用はPreview検証フローで実施）
- リスク: 低（管理者限定・Preview限定のまま）
- テスト: Tier保存→リロード復元、pool外カードIDをdevtoolsから注入して保存拒否、不正group_key拒否、下書き復元バナー
- ロールバック: ブランチrevertのみ（本番影響ゼロ）

### Phase 2: 保存・UI共通化（2企画目=殿堂予想の共通基盤再実装と同時）

- 変更対象: `saveMakerSubmission(slug, draft)` 共通action、`src/components/maker/` 切り出し、殿堂予想を `type='prediction'` 企画として `maker_projects` に登録
- migration: `visibility/result_visibility/start_at/end_at/created_by` 追加（Preview検証→承認後にProduction）
- リスク: 中（DM26-EX2の回帰）。テスト: DM26-EX2と殿堂予想の両方で保存・復元・締切制御を実機確認
- ロールバック: 旧TierMaker実装をPhase 2完了まで残す（ルート単位で切替可能に）

### Phase 3: 集計・画像共通化

- 変更対象: 汎用view＋`get_maker_results` RPC、`maker_tier_aggregates` 廃止、`/api/maker/[slug]/image`、Noto Sans JPサブセット同梱
- migration: view/RPC追加（データ変更なし・ロールバックはdrop）
- リスク: 中（画像のVercelサイズ/時間制約）。テスト: 60枚Tier表の生成時間、画像なしカードのフォールバック、少数回答秘匿、result_visibility 3値
- ロールバック: 結果ページ・画像ルートの非公開化のみで戻せる

### Phase 4: 新企画量産（9選・再録希望・ランキング・投票）

- 変更対象: 原則 `maker_projects` へのINSERTとcard pool登録のみ。コード変更が要る場合は `RankedList`/テンプレ追加に限定
- migration: なし（あれば設計違反のサイン）
- テスト: 企画ごとにlimits・重複・締切の3点を確認
- ロールバック: `status='archived'`

## 12. 開発ルール（正本）

1. 企画ごとに保存ロジック・画像生成・カードテーブル・集計viewを複製しない
2. カードマスターは `cards` のみ。企画用カードは `maker_project_cards` で紐付ける。推測でカードデータを登録しない（公式画像URL・実在カードのみ）
3. 保存は `save_maker_submission()` 経由の単一トランザクションのみ。card pool外・不正group_keyは黙殺せずエラー
4. 1企画1ユーザー1回答・全置換上書きを基本とする
5. グループ定義・制約の正本は `maker_projects.config`。TS定数・SQL・UIに複製しない
6. type固有制約は `parseMakerConfig` で検証してから使う
7. Production DBへ直接migrationしない。draft SQL→Preview適用→実地検証→承認→Production
8. 非公開企画（`visibility='admin'`）は導線・sitemap・indexの対象にしない（`robots: noindex,nofollow` 必須）
9. service roleクライアントをClient Componentへ渡さない。集計viewはservice role専用、公開はRPC経由
10. 書込系は `assertMakerWriteAllowed()` を必ず通す（本番開放の判断を1箇所に集約）
