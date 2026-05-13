# デュエマ歴史読み物記事ジェネレーター

Wiki URLから、デュエマ掲示板用の読み物記事下書きを作るローカルCLIです。

## 目的

単なるWiki要約ではなく、商品・カード・ギミックがデュエマ史の中でどういう意味を持つかを読む記事にします。

## 使い方

```powershell
cd C:\Users\light\Desktop\codex\projects\duema-bbs
npm.cmd run content:article -- --url https://dmwiki.net/DM26-RP1
```

主要カード数を変える場合:

```powershell
npm.cmd run content:article -- --url https://dmwiki.net/DM26-RP1 --max-cards 6
```

画像取得を止める場合:

```powershell
npm.cmd run content:article -- --url https://dmwiki.net/DM26-RP1 --no-images
```

## 出力

`drafts/articles/` に以下を保存します。

- `*.md`: 記事下書き
- `*.source.json`: 抽出した商品情報、カード情報、公式画像候補ログ
- `*.quality.json`: 品質チェック結果

## 管理画面へ入れる

生成済みMarkdownは管理画面から取り込めます。

```text
/admin/article-drafts
```

取り込むと、固定ページに以下の状態で保存されます。

- 公開OFF
- ナビ非表示
- Markdown本文をテキスト/画像ブロックへ変換

確認後、固定ページ編集画面で公開してください。

ローカルCLIで直接取り込む場合:

```powershell
npm.cmd run content:import-draft -- --file "2026-05-13-DM26-RP1-「逆札篇-第1弾-逆転神VS切札竜」.md"
```

## 取得元

- 商品・カード情報: デュエル・マスターズ Wiki
- カード画像: タカラトミー公式カード検索

画像が一意に判断できない場合は本文に挿入せず、`*.source.json` に候補を残します。

## 現在の範囲

- CLIでWiki URLを入力
- Wikiページ取得
- 商品名、発売日、新能力、新種族、新カードタイプ、再登場ギミックを抽出
- 主要カード候補を抽出
- 主要カードの個別Wikiページを取得
- 読み物記事のMarkdown下書きを生成
- 本文内の《カード名》を抽出
- 公式カード検索から画像を取得
- 初出カード名の直後に画像を挿入
- 禁止語、画像、カード表記などを簡易チェック

## まだやらないこと

- 自動公開
- DBへの直接保存
- 公式画像のローカル保存
- AI APIによる完全自動執筆

まずは人間が確認できる下書きを安定して作ることを優先します。
