# PR #910 本番マイグレーション適用手順書

対象PR: https://github.com/dmkeijiban/duema-bbs/pull/910
最新コミット: `10340fe6`

## 目的とスコープ

このPRのコードは、`deck_submissions.special_card_id` 列と `special_slot_representatives` テーブルを**フォーマットを問わずすべての「みんなのデッキ」公開・更新リクエストで参照します**（`src/app/makers/deck-maker/actions.ts` の `savePublishedDeck`）。これらのDBオブジェクトが本番に存在しない状態でこのPRのコードだけが先にデプロイされると、advanceフォーマットに限らず**既存の「みんなのデッキ」公開・更新機能そのものが失敗します**（例外は握りつぶされ「登録に失敗しました」を返すため画面はクラッシュしませんが、機能は止まります）。

このため、**本番マイグレーション適用が完了してからのみ、本PRをマージ（＝コードを本番デプロイ）してください。** 本書はその適用手順のみを扱います。コードのデプロイ手順は含みません。

## 前提

- 対象は Supabase の SQL Editor から人間が手動で実行することを想定しています。`supabase` CLI やservice roleキーを使った自動適用は想定していません。
- `supabase/migrations/20260722235500_card_deck_zone_class.sql`（`cards.deck_zone_class` 列、`deck_zone_class_from_card_type()` 関数、関連トリガー一式）は本PRより前にmainへ既にマージされており、**本番へ適用済みという前提**で本手順を書いています。念のため「0. 前提確認」で実在を確認してください。未適用だった場合はこの手順を中断し、まずその移行を別途検討してください。
- 同様に `deck_submission_cards` テーブルと `sync_deck_submission_cards()` トリガー（`card_usage_counts` ビューの集計元）も既存機能として適用済みという前提です。

## 必要なマイグレーション一覧（適用順）

| # | ファイル | 対象 |
|---|---|---|
| 1 | `supabase/migrations/20260724130000_refine_deck_zone_class.sql` | `deck_zone_class_from_card_type()` 関数の再定義＋全カードの再分類 |
| 2 | `supabase/migrations/20260724130500_card_usage_counts.sql` | `card_usage_counts` ビュー新規作成 |
| 3 | `supabase/migrations/20260724180000_deck_submission_special_card.sql` | `deck_submissions.special_card_id` 列追加 |
| 4 | `supabase/migrations/20260724190000_special_slot_representatives.sql` | `special_slot_representatives` テーブル新規作成＋代表カード自動登録 |

**この順番のとおりに、1件ずつ実行してください（まとめて1回で流さない）。** 各マイグレーションの後に、対応する「実行後の確認SQL」を実行し、期待どおりの結果になってから次へ進んでください。

---

## 1. `20260724130000_refine_deck_zone_class.sql`

**変更対象**
- テーブル: なし（既存 `cards` テーブルの `deck_zone_class` 列の**値**を再計算するのみ。列自体は前提の既存マイグレーションで追加済み）
- 列: なし（新規追加なし）
- 関数: `public.deck_zone_class_from_card_type(text)` を `create or replace` で再定義
  - hyperspatial判定に「ルール・プラス」を追加
  - special判定を、広い禁断/零龍系正規表現から `in ('最終禁断フィールド', '零龍クリーチャー')` の完全一致2種類のみに縮小
- トリガー: 変更なし（既存の `refresh_card_deck_zone_class_from_card`/`_from_face` トリガーがこの関数を呼ぶだけ）
- 副次処理: `do $$ ... $$` ブロックで `cards` 全行に対して `refresh_card_deck_zone_class(id)` を再実行し、`deck_zone_class` を再計算・更新

**既存データへの影響**
- `cards.deck_zone_class` の値が変わりうるカードが存在します。具体的には、旧正規表現では `special` に分類されていた「禁断クリーチャー」「禁断の鼓動」「禁断フィールド」「零龍の儀」「零龍星雲」「キング・セル」等の cardType を持つカードが、新関数では `normal` に再分類されます（`最終禁断フィールド`／`零龍クリーチャー`のみ`special`のまま）。
- アプリの `resolveAutoZone()` はcards配列の自動ゾーン振り分けにおいて `special` を特別扱いしません（`gr`/`hyperspatial`以外はすべて`main`）。したがって、この再分類自体はメインデッキへのカード振り分け結果を変えません。影響があるのは、後述の migration 4（`special_slot_representatives`）の代表カード特定条件が「`deck_zone_class = 'special'`」を使う点のみです。

**ロック・長時間処理の可能性**
- `create or replace function` は一瞬（DDLロックのみ）。
- 再分類の`do`ブロックは `cards` の全行を1行ずつ `update ... where ... is distinct from ...` します。カード数が数千件規模であれば通常は数秒〜数十秒で完了する見込みですが、行ロックは更新対象行ごとに一時的に発生します。トラフィックが少ない時間帯の実行を推奨します。テーブルロック（ACCESS EXCLUSIVE等）は発生しません。

**冪等性**: 冪等です。関数再定義もbackfillループも、同じ入力に対して同じ結果になるため、誤って複数回実行しても問題ありません。

**失敗時のロールバック方法**
```sql
-- 関数を元の定義（20260722235500時点）に戻す
create or replace function public.deck_zone_class_from_card_type(p_card_type text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when coalesce(p_card_type, '') ~* '(^|[^[:alnum:]])(NEO[[:space:]]+)?GRクリーチャー' then 'gr'
    when coalesce(p_card_type, '') ~ '(サイキック|ドラグハート)' then 'hyperspatial'
    when coalesce(p_card_type, '') ~ '(禁断の鼓動|禁断クリーチャー|禁断フィールド|最終禁断|零龍クリーチャー|零龍星雲|零龍の儀)' then 'special'
    else 'normal'
  end
$$;

-- 全カードを旧関数で再分類し直す
do $$
declare
  v_card_id uuid;
begin
  for v_card_id in select id from public.cards loop
    perform public.refresh_card_deck_zone_class(v_card_id);
  end loop;
end
$$;
```

**コードとの依存関係**: migration 4（`special_slot_representatives`）の `select ... into strict` が `deck_zone_class = 'special'` を条件に含むため、**必ずこれより先に適用する**必要があります（適用順どおり）。それ以外のコードパス（cards配列の自動ゾーン振り分け・保存処理）は、このマイグレーション単体の未適用によって壊れることはありません。

---

## 2. `20260724130500_card_usage_counts.sql`

**変更対象**
- ビュー: `public.card_usage_counts` を `create or replace view` で新規作成
  - `deck_submission_cards` を `deck_submissions.is_public = true` でフィルタし、`card_id` ごとに `quantity` を合計
- 権限: `grant select on public.card_usage_counts to service_role;`

**既存データへの影響**: なし（新規ビューの追加のみ。既存テーブルへの書き込みは一切ありません）。

**ロック・長時間処理の可能性**: なし。ビュー定義の追加はメタデータ操作のみで一瞬です。

**冪等性**: 完全に冪等です（`create or replace view`、`grant`はいずれも再実行安全）。

**失敗時のロールバック方法**
```sql
drop view if exists public.card_usage_counts;
```

**コードとの依存関係**: `/api/cards/search` の `getUsageCounts()` はこのビューを参照しますが、**エラー時はfail-open設計**（`result.error` があれば集計を打ち切り、それまでに集まった分だけで採用枚数0扱いにフォールバックするだけ）です。このため、このマイグレーションが未適用でも通常カード検索APIはクラッシュしません。「採用枚数順」ソートの精度が下がるだけです。**必須ではありませんが、機能を正しく動かすために本PRの一部として適用してください。**

---

## 3. `20260724180000_deck_submission_special_card.sql`

**変更対象**
- 列: `public.deck_submissions.special_card_id uuid references public.cards(id) on delete set null` を `add column if not exists` で追加

**既存データへの影響**: 既存の `deck_submissions` 行はすべて `special_card_id = null` になります。データの上書き・削除は一切ありません。

**ロック・長時間処理の可能性**: `DEFAULT` を伴わないnull許容列の追加はPostgres 11以降ではテーブル書き換えを伴わないメタデータのみの操作です。追加されるFK制約（`references cards(id)`）の検証も、既存行がすべてNULLであるため実質的に即座に完了します。長時間ロックの懸念はありません。

**冪等性**: 冪等です（`add column if not exists`）。

**失敗時のロールバック方法**
```sql
alter table public.deck_submissions drop column if exists special_card_id;
```
（注意: **このロールバックは、このPRのコードがまだ本番にデプロイされておらず、`special_card_id` に実データが1件も書き込まれていない場合にのみ無損失です。** コードデプロイ後にユーザーが特殊枠を保存していた場合、この列を削除するとその選択情報が失われます。本手順書の想定では「コードデプロイ前にDB適用する」順序を守るため、この段階でのロールバックは無損失です。）

**コードとの依存関係**: `savePublishedDeck`（insert/update）、公開デッキ詳細ページ（`submissions/[id]/page.tsx`）、`makers/deck-maker/page.tsx` がこの列を無条件に読み書きします。**この列が存在しないと、みんなのデッキの新規公開・更新が全フォーマットで失敗します。** 本PRの中で最も優先度の高い必須マイグレーションの1つです。

---

## 4. `20260724190000_special_slot_representatives.sql`

**変更対象**
- テーブル: `public.special_slot_representatives` を新規作成
  - `key text primary key check (key in ('dormageddon', 'zeroryu'))`
  - `label text not null`
  - `card_id uuid not null references cards(id) on delete restrict`
  - `updated_at timestamptz not null default now()`
- データ: 同じファイル内の `do $$ ... $$` ブロックで、以下の2行を `insert ... on conflict (key) do update` します。
  - `dormageddon`: `cards.card_type = '最終禁断フィールド' and deck_zone_class = 'special' and is_active` を満たす1件（想定cards.id: `c87706ba-a6a1-49da-923f-68bb7c8e681c`）
  - `zeroryu`: `card_printings.source_key = 'dmbd22-001'` かつ対応する `cards.card_type = '零龍の儀' and deck_zone_class = 'special' and is_active` を満たす1件（想定cards.id: `d0dab9d1-8c2a-49e0-8837-33d33953e973`）

**既存データへの影響**: 新規テーブルのみで、既存テーブルへの書き込みは行いません（`cards`/`card_printings` は読み取りのみ）。

**ロック・長時間処理の可能性**: `create table if not exists` は一瞬。2件の `select ... into strict` はcards/card_printingsに対する軽いクエリで、インデックスの有無に関わらずカード数が数千件規模であれば即座に完了します。テーブルロックの懸念はありません。

**冪等性**: `create table if not exists` は冪等。`insert ... on conflict (key) do update` も冪等（再実行すれば同じ2行に上書きされるだけ）。

**重要な注意（このファイル自体の実行方法）**: このSQLファイルには `begin;`/`commit;` の明示的なラップがありません。SQL Editorに貼り付けて実行する際は、**ファイル内容全体を `begin;` と `commit;` で囲んで1トランザクションとして実行してください。** これにより、万が一 `select ... into strict` が失敗した場合（`no_data_found`/`too_many_rows`）でも、直前の `create table` を含めて全体がロールバックされ、中途半端な状態が残りません（`RAISE EXCEPTION` はトランザクション全体を異常終了させます）。

**失敗時のロールバック方法**
```sql
drop table if exists public.special_slot_representatives;
```
（`begin;`/`commit;` で囲んで実行していれば、`RAISE EXCEPTION`発生時は自動的にロールバックされ、このDROPは通常不要です。）

**コードとの依存関係**: `getSpecialSlotOptions()`（`src/lib/special-slot-options.ts`）がこのテーブルを参照し、`/api/cards/special-options` と `savePublishedDeck` の両方から**フォーマットを問わず**呼ばれます。**このテーブルが存在しないと、みんなのデッキの新規公開・更新が全フォーマットで失敗します。** migration 3 と並び、本PRの中で最も優先度の高い必須マイグレーションです。

---

## どのマイグレーションまで適用すればコードを安全にデプロイできるか

**4件すべてです。** 内訳:

- **必須（未適用だと保存機能が壊れる）**: #3（`special_card_id`列）、#4（`special_slot_representatives`テーブル）
- **機能の正しさに必須（保存自体は壊れないが、advanceフォーマットの分類・特殊枠の代表カード特定条件が正しく機能するために必要）**: #1（`deck_zone_class`再分類）— #4の`select ... into strict`は`deck_zone_class = 'special'`を条件に使うため、#1を先に適用しておく必要があります
- **推奨だが未適用でも保存機能は壊れない（fail-open）**: #2（`card_usage_counts`ビュー）— 未適用でも「採用枚数順」ソートが単に無効化されるだけ

4件とも小さく、テーブル全体をロックするような重い処理はありません。まとめて（順番どおり）適用してから、コードのデプロイ（PRマージ）に進むことを推奨します。

---

## 0. 前提確認（適用前の読み取り確認SQL）

```sql
-- 前提: 20260722235500の下地が既に存在するか
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'cards' and column_name = 'deck_zone_class';
-- → 1行返ればOK。0行ならこの手順書の前提が崩れているため、先に進まないこと。

select proname from pg_proc
 where proname in ('deck_zone_class_from_card_type', 'refresh_card_deck_zone_class');
-- → 2行返ればOK。

-- 現時点でのドルマゲドン/零龍候補の状態を確認（マイグレーション1適用前の状態）
select id, name, card_type, deck_zone_class, is_active
  from cards
 where card_type in ('最終禁断フィールド', '零龍の儀');
-- → 最終禁断フィールドが1件、零龍の儀が1件以上あることを確認する
```

## 1件目適用後の確認SQL（`20260724130000`）

```sql
-- 関数が新定義になっているか（'零龍の儀'単体ではspecialにならないはず）
select public.deck_zone_class_from_card_type('零龍の儀') as should_be_normal,
       public.deck_zone_class_from_card_type('最終禁断フィールド') as should_be_special,
       public.deck_zone_class_from_card_type('ルール・プラス') as should_be_hyperspatial;

-- ドルマゲドン候補が1件で、deck_zone_class='special'になっているか
select id, name, card_type, deck_zone_class, is_active
  from cards
 where card_type = '最終禁断フィールド';
-- → 1行のみ。deck_zone_class='special'、is_active=true であること。

-- 零龍関連（5種のツインパクト前面）がdeck_zone_class='special'になっているか
-- （裏面のcard_facesが零龍クリーチャーであるため、UNION経由でspecialになる想定）
select id, name, card_type, deck_zone_class, is_active
  from cards
 where card_type in ('零龍の儀', '零龍星雲');
-- → 5行程度。すべてdeck_zone_class='special'であることを確認。
```

**進んでよい判断基準**: 上記3クエリすべてが期待どおりであれば次へ進む。`最終禁断フィールド`が0件または2件以上、あるいは`deck_zone_class`が期待と異なる場合は**中断**し、実データと`src/lib/special-slot-representative-rules.ts`のコメントに記載した2026-07-24読み取り確認結果との差分を確認すること。

## 2件目適用後の確認SQL（`20260724130500`）

```sql
select viewname from pg_views where schemaname = 'public' and viewname = 'card_usage_counts';
-- → 1行返ることを確認

select * from card_usage_counts limit 5;
-- → エラーなく実行できることを確認（0行でもエラーでなければOK）
```

**進んでよい判断基準**: ビューが存在し、クエリがエラーなく実行できれば次へ進む。

## 3件目適用後の確認SQL（`20260724180000`）

```sql
select column_name, is_nullable, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'deck_submissions' and column_name = 'special_card_id';
-- → 1行。is_nullable='YES'、data_type='uuid' であること。

select count(*) as should_be_zero
  from deck_submissions
 where special_card_id is not null;
-- → 0件であること（新規列なので、この時点で誰かが値を持っているのはおかしい）。
```

**進んでよい判断基準**: 列が存在し、既存行が全てNULLであれば次へ進む。0件以外が返った場合は想定外の状態のため中断し報告すること。

## 4件目適用後の確認SQL（`20260724190000`）

```sql
-- special_slot_representativesがちょうど2行であること
select key, label, card_id, updated_at from special_slot_representatives order by key;
-- 期待される結果（2行のみ）:
--  key          | label       | card_id
--  dormageddon  | ドルマゲドン | c87706ba-a6a1-49da-923f-68bb7c8e681c
--  zeroryu      | 零龍         | d0dab9d1-8c2a-49e0-8837-33d33953e973

-- 代表カードそれぞれが有効な特殊カードであることを確認
select r.key, c.id, c.name, c.card_type, c.deck_zone_class, c.is_active
  from special_slot_representatives r
  join cards c on c.id = r.card_id
 order by r.key;
-- → 2行。両方 deck_zone_class='special' かつ is_active=true であること。
```

**進んでよい判断基準（＝マイグレーション完了後にPRをマージしてよい判定条件）**:
1. `special_slot_representatives` が**ちょうど2行**であること
2. `key`が`dormageddon`と`zeroryu`の2つであること（他の値がないこと）
3. `dormageddon`の`card_id`が`c87706ba-a6a1-49da-923f-68bb7c8e681c`と一致すること
4. `zeroryu`の`card_id`が`d0dab9d1-8c2a-49e0-8837-33d33953e973`と一致すること
5. 上記JOINクエリで両行とも`deck_zone_class='special'`かつ`is_active=true`であること

**この5条件がすべて満たされて初めて、PR #910をマージ（コードデプロイ）してよいと判断してください。** 1つでも満たされない場合は、マージせずに一覧化した「失敗時のロールバック方法」に従って対象マイグレーションを戻し、原因を確認してから再実行してください。

---

## 全体のロールバック（4件すべてを戻す場合）

適用順と逆順に実行してください。

```sql
-- 4を戻す
drop table if exists public.special_slot_representatives;

-- 3を戻す（コードデプロイ前で special_card_id にデータが無い場合のみ無損失）
alter table public.deck_submissions drop column if exists special_card_id;

-- 2を戻す
drop view if exists public.card_usage_counts;

-- 1を戻す（上記「1. 失敗時のロールバック方法」のSQLを実行）
```

---

## まとめ

- **本PRのコードは、DBマイグレーション（特に#3・#4）が本番に適用されていることを前提に動作します。コード先行デプロイは、みんなのデッキ公開・更新機能の全面停止につながるため行いません。**
- 適用順: #1 → #2 → #3 → #4（1件ずつ、各確認SQLで検証してから次へ）
- 4件すべての適用完了・上記5条件の充足を確認した後に、PR #910をマージしてください。
