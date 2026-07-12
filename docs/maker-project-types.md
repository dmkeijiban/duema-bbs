# メーカー企画typeカタログ

正本設計: `docs/maker-platform.md`。新企画は原則このカタログのいずれかのtype＋configで表現し、**新テーブル・新RPC・新画像ルートを作らない**。ここに当てはまらない企画が出たら、まず本ドキュメントとconfig schemaの拡張を検討する。

## 共通の考え方

すべての企画は「card pool のカードを **グループ** に割り当て、必要なら **順序** を付ける」で表現する。

- 「未評価」「未選択」はグループではなく**未割当**（itemを保存しない）
- 集計は `config.aggregate` で選ぶ（`docs/maker-platform.md` §7）
- 画像は `config.image.template` で選ぶ（同 §8）

## typeごとの表現

### tier — 新弾Tier表（DM26-EX2等）

```jsonc
{
  "groups": [
    {"key":"s","label":"S","score":5}, {"key":"a","label":"A","score":4},
    {"key":"b","label":"B","score":3}, {"key":"c","label":"C","score":2},
    {"key":"d","label":"D","score":1}
  ],
  "ordered": true,                    // Tier内の並びも残す
  "aggregate": "scoreAverage",        // 平均Tier＋各Tier数
  "image": {"template": "tierGrid"}
}
```

### prediction — 殿堂予想 / プレミアム殿堂予想 / 再録予想

「カードごとに区分を1つ選ぶ」＝グループ割当そのもの。重複禁止PKが「1カード1区分」を自動で担保する。

```jsonc
{
  "groups": [
    {"key":"premium","label":"プレミアム殿堂"},
    {"key":"hall","label":"殿堂入り"},
    {"key":"release","label":"殿堂解除"}
  ],
  "ordered": false,
  "aggregate": "countGroups",         // 区分ごとの予想数・予想率
  "image": {"template": "badgeList"}
}
```

再録予想は `groups: [{"key":"reprint","label":"再録される"}]` の1グループ版。

### selection — 9選メーカー / 再録希望 / デッキ採用候補 / 相棒カード

「1グループにN枚選ぶ」。順序の有無と上限だけが違う。

```jsonc
// 9選（順序あり・ちょうど9枚）
{
  "groups": [{"key":"picks","label":"9選"}],
  "ordered": true,
  "limits": {"total": {"min": 9, "max": 9}},
  "aggregate": "selectionRate",       // 採用率
  "image": {"template": "pickGrid"}   // 3×3
}
// 再録希望（順序なし・最大20枚）: ordered:false, total:{max:20}
// 相棒カード（1枚だけ）: total:{min:1,max:1}
```

### ranking — 最強カードランキング

```jsonc
{
  "groups": [{"key":"rank","label":"ランキング"}],
  "ordered": true,                    // position 0 = 1位
  "limits": {"total": {"min": 3, "max": 10}},
  "aggregate": "rankPoints",          // 1位票数・平均順位・ポイント
  "image": {"template": "rankedList"}
}
```

### vote — ベストカード投票（1枚 / 複数選択）/ Yes・No形式

- 1枚投票: selectionの `total:{min:1,max:1}` と同型。typeを分けるのはUI（グリッドから1タップ投票）と結果表示（得票率バー）のため
- 複数選択投票: `total:{max:N}`
- Yes/No形式: 対象カードをcard poolに1枚だけ入れ、`groups: [{"key":"yes"},{"key":"no"}]`。カードなしの純アンケートはメーカー基盤の対象外（掲示板スレで行う）

```jsonc
{
  "groups": [{"key":"best","label":"ベストカード"}],
  "ordered": false,
  "limits": {"total": {"min":1, "max":1}},
  "aggregate": "selectionRate",
  "image": {"template": "pickGrid"}
}
```

### rating — カードごとの5段階評価 / パック評価

評価値をグループとして表現する（valueカラム不要）。

```jsonc
{
  "groups": [
    {"key":"5","label":"★5","score":5}, {"key":"4","label":"★4","score":4},
    {"key":"3","label":"★3","score":3}, {"key":"2","label":"★2","score":2},
    {"key":"1","label":"★1","score":1}
  ],
  "ordered": false,
  "aggregate": "scoreAverage",        // 平均評価・評価人数
  "image": {"template": "badgeList"}
}
```

パック評価はcard poolを「そのパックの収録カード」にした rating 企画。パック自体への総合評価が要る場合のみ、将来 `value` カラム拡張（`docs/maker-platform.md` §5-3）を検討する。

## 新企画追加の手順（Phase 4以降の定型）

1. このカタログから type と config を選ぶ・調整する
2. `parseMakerConfig` が通ることを確認（不正configは登録段階で弾く）
3. `maker_projects` に1行INSERT（`status='draft'`, `visibility='admin'`）
4. カードを `cards` に取込み（`/admin/cards/import`）、`maker_project_cards` にpool登録
5. Previewで回答→保存→復元→集計→画像を実地確認
6. `visibility` / `status` / 期間を設定して公開

コード変更・migrationが必要になった場合は、この基盤の設計不足なので `docs/maker-platform.md` の改訂とセットで行う。
