# デッキメーカー公式情報・画像利用調査

確認日: 2026-07-15。法的判断ではなく公開公式文書の確認記録。

## 確認できた事実

- [タカラトミーのサイトポリシー](https://www.takaratomy.co.jp/utility/sitepolicy/) は、文章・画像・動画等の権利が同社または原著作者等に帰属し、企業等の非営利目的、個人的使用、著作権法上認められる場合を除き、許諾なく利用できないと記載する。本サービスの画像表示・PNG複製が例外に当たるとは確認できない。
- [公式FAQ](https://faq.takaratomy.co.jp/detail.aspx?a=102&id=23595&isCrawler=1) も、著作権法上認められる場合を除き、掲載画像・動画を権利者の許諾なく使用できないとしている。
- [robots.txt](https://dm.takaratomy.co.jp/robots.txt) は `User-agent: *` に対し `/wp-admin/` を禁止し `/wp-admin/admin-ajax.php` を許可する。カードページの明示的Disallowはない。ただしrobots.txtは画像利用の許諾ではない。
- 紙のデュエル・マスターズの画像を第三者サービスが複製、プロキシ再配信、Canvas加工、PNG保存できると明示した固有規約・二次創作／ファン活動ガイドラインは確認できなかった。
- 「デュエル・マスターズ プレイス」向けガイドラインや他ファンサイトの掲載実績は根拠にしていない。

## 確認できなかったこと

- 紙カード画像の表示、プロキシ配信、画像入りPNG生成に対する明確な個別許諾。
- 自動取得の頻度・件数を定めた固有規約。robots.txt以外の明示的禁止は確認できなかったが、無制限取得の許可ではない。
- 画像縮小、利用者端末への保存、広告を含むサイトでの利用条件。

## 安全策

- 画像本体は永続保存せず `card_printings.image_url` にURLだけ保持する。プロキシは公式HTTPSホストだけを許可し、長期キャッシュしない。
- `CARD_IMAGES_ENABLED=false` で緊急停止できる。未設定時は通常表示する。
- 取得はdry-run既定、全体1req/sec、concurrency 1、429のRetry-After尊重、403・robots禁止・連続エラーで停止、検証は3ページ・3カードまで。全件相当は二重確認する。
- 画面に非公式サービスと権利帰属を表示し、削除要請時は停止する。

参照URL: https://www.takaratomy.co.jp/utility/sitepolicy/ / https://faq.takaratomy.co.jp/detail.aspx?a=102&id=23595&isCrawler=1 / https://dm.takaratomy.co.jp/robots.txt / https://dm.takaratomy.co.jp/
