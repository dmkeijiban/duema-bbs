# 思い出図鑑 パック追加フロー

DM-03以降の思い出図鑑パックを、1パック分のJSONからdraft SQLとして生成するための手順です。

このフローは本番DBへ自動適用しません。生成したSQLを人間が確認し、Supabase SQL Editorで手動実行します。

## 触らないもの

- 本番DBへの自動適用
- Supabase Storage
- 外部API
- cron
- 課金系設定
- 既存カードのslug / id / pack_id / sort_order
- 思い出投稿、評価、投稿フォーム
- 本物カード画像の保存

## データファイル

1パックにつき1ファイルを作ります。

```txt
data/zukan-packs/dm-03.json
```

DM-02のサンプル:

```txt
data/zukan-packs/dm-02.json
```

形式:

```json
{
  "pack": {
    "slug": "dm-03",
    "code": "DM-03",
    "name": "第3弾「...」",
    "released_year": "2002年...",
    "card_count": 60,
    "description": "...",
    "is_published": true,
    "sort_order": 3,
    "image_url": null
  },
  "cards": [
    {
      "slug": "dm03-001",
      "name": "カード名",
      "card_type": "クリーチャー",
      "civilization": "火",
      "cost": 6,
      "mana": 6,
      "race": "アーマード・ドラゴン",
      "power": "6000",
      "rarity": "VR",
      "illustrator": "Illustrator Name",
      "ability_text": "能力テキスト",
      "flavor_text": null,
      "image_url": null,
      "official_page_url": "https://dm.takaratomy.co.jp/card/detail/?id=...",
      "official_image_url": null,
      "is_published": true,
      "sort_order": 1
    }
  ]
}
```

画像を入れないカードは `image_url` と `official_image_url` を `null` にします。カード詳細や一覧では既存の `ZukanPseudoCard` が画像なし表示を担当します。

## SQL生成

通常:

```powershell
npm.cmd run zukan:seed dm-03
```

`--stdout` や `--output` などのオプションを使う場合は、npmにオプションを渡すため `--` を入れます。

標準出力で確認する場合:

```powershell
npm.cmd run zukan:seed -- dm-03 --stdout
```

入力ファイルを指定する場合:

```powershell
npm.cmd run zukan:seed -- dm-03 --input data/zukan-packs/dm-03.json
```

生成先を指定する場合:

```powershell
npm.cmd run zukan:seed -- dm-03 --output supabase/migrations/drafts/20260706_zukan_seed_dm03.sql
```

既定の生成先:

```txt
supabase/migrations/drafts/YYYYMMDD_zukan_seed_dm_03.sql
```

## 生成されるSQL

生成SQLには以下が含まれます。

- `zukan_packs` への `insert`
- `zukan_cards` への `insert`
- `ability_text`
- `flavor_text`
- `illustrator`
- `official_page_url`
- `image_url` / `official_image_url` はnullable
- 適用前確認SQLコメント
- 適用後確認SQLコメント
- `pack.card_count` と実カード件数の確認SQL

既存slugがある場合は上書きせず、SQL実行時に失敗させる方針です。衝突に気づけることを優先します。

## Supabase SQL Editorでの適用

1. 生成されたdraft SQLを開く。
2. 冒頭の「Before applying」SQLをSupabase SQL Editorで実行する。
3. 対象pack slugとcard slugが既存にないことを確認する。
4. seed SQL本体を実行する。
5. 末尾の「After applying」SQLを実行する。
6. `actual_card_count` が `expected_card_count` と一致することを確認する。
7. 代表カード数件の詳細ページ用データをspot checkする。

例:

```sql
select
  p.slug,
  p.card_count as expected_card_count,
  count(c.id) as actual_card_count
from public.zukan_packs p
left join public.zukan_cards c on c.pack_id = p.id
where p.slug = 'dm-03'
group by p.slug, p.card_count;
```

## PR作成前の確認

```powershell
npm.cmd exec tsc -- --noEmit
npm.cmd run lint -- scripts/zukan/generate-seed.mjs
npm.cmd run zukan:seed -- dm-03 --stdout
```

確認対象:

- 生成SQLに適用前確認コメントがある。
- 生成SQLに適用後確認コメントがある。
- `zukan_packs` / `zukan_cards` のinsertがある。
- `ability_text` / `flavor_text` / `illustrator` / `official_page_url` が最初から入る。
- 既存 `/zukan/dm-01` が壊れていない。
- 既存 `/zukan/dm-02` が壊れていない。
- 既存 `/zukan/card/dm02-002` が壊れていない。

## PRから本番確認まで

1. データJSON、生成スクリプト、生成されたdraft SQL、必要なページ実装だけをcommitする。
2. `git add .` / `git add -A` は使わない。
3. Previewで対象パックページと代表カード詳細を確認する。
4. 問題なければmainへmergeする。
5. 本番Vercel deployment完了後に以下を確認する。

```txt
/zukan/dm-01
/zukan/dm-02
/zukan/<new-pack-slug>
/zukan/card/<representative-card-slug>
```

## 次に改善するなら

- JSON Schema追加
- 公式カード検索からJSON下書きを作る補助スクリプト
- パックページ雛形生成
- 代表カードslug候補の自動チェック
- SQL生成結果の差分テスト
