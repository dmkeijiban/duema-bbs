# 両面カード初回監査（2026-07-18）

本番DBは読み取りのみ。変更件数は0件。全件再取得を繰り返さず、この監査を初回基準として以後は公式ID・URL・失敗状態による差分更新へ切り替える。

- 論理カード: 11,623件
- 収録版: 22,917件
- 名前・収録版キーの重複: 0件
- 読み未登録: 11,623件
- 非標準の公式ページURL: 149件（通常処理から隔離）
- 要確認カード: 224件（自動判定後の例外のみ個別確認）
- 本番DB変更: 0件
- 既知例: 表面《禁断の鼓動》／裏面《伝説の禁断 ドキンダムX》

## 更新方式

`scripts/cards/collect-official-card-faces.mjs`が同一URLを1回だけ取得し、HTMLキャッシュ、checkpoint、SHA-256 content hashを保存する。成功済みかつURL未変更の行は対象外。同じ内容は再解析・再upsertしない。新規公式ID、URL変更、前回失敗、未完了、明示的な`--force`だけを処理する。

キャッシュとcheckpointは`data/cards/`配下に置き、Gitへ追加しない。DB投入前に`verify-card-faces.mjs`でJSON成果物を検証する。

## 1,000件後の抽出精度監査

- parser v4へ更新。各成果物に`parser_version`、`card_number`、`card_type`を保存する。
- ランダム10、サイキック5、ドラグハート3、3面特殊2の計20件をキャッシュHTMLから再解析。
- 正常20件は面順、front/back、カード番号、親`cards.id`、面ごとの異なる画像、公式URL、画像HTTP応答をすべて通過。
- ツインパクトの2つ目の`cardDetail`は画像srcが空で、カード面ではなく呪文側メタデータ。同ブロックから後続SNSアイコンを画像として拾う誤検出を修正し、空画像detailを除外した。
- `dmex08-111`の2面目は公式HTML自体が`{...} Bottom`形式のプレースホルダー名。面・画像構造は正しいが検索名へ投入せず`needs_review`へ自動隔離する。
- parser更新時は取得成功状態とHTMLキャッシュを維持し、古いparser_versionだけを再解析する。公式ページ再取得は0件。

## parser v4 最終監査（カリスマBEST正式移行後）

- 正式入力: 22,922 URL / 22,922成功。
- 面数: 23,403（1面22,465、2面434、3面22、4面1）。
- DM26EX2: `DM26EX2-PREVIEW-*`残存0、正式URL・正式`card_printing_id` 154件。
- 旧商品ページの非標準URL1件は正式154ページへの移行により対象外化。
- 公式HTMLの`{撃墜王ガイアール・キラードラゴン} Bottom`は画像と公式メタデータを個別確認し、監査可能なoverride JSONで正式名へ補正。
- needs_review 0、HTMLフラグメント末尾欠損0、3面・4面70画像のHTTP確認失敗0。
- URL集合、checkpoint、成果物、content hash、parser面数、親ID、収録版ID、side index、画像重複、SNS画像誤検出はすべて不整合0。
- 正式移行確認中に別のcollectorプロセスが起動していることを検知し即時停止。正式154ページは既存正式成果物で再構成可能だったが、このプロセスが154ページを取得済みだったため、最終集計は新規取得21,311（従来21,157から+154）、キャッシュ再解析1,611。以後collectorは停止済み。
- 本番DB変更0。Preview DB変更0。

## legacy API keysによる停止

- `ADMIN_COOKIE_SECRET`分離はPR #639でmainへ反映済み。
- Vercel Production / Previewには新publishable / secret用の環境変数がなく、アプリも旧`NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`名を参照中。
- legacy keys無効化、新キーでの本番read/write、401/403回帰なしを確認できないため、本番投入・PR Ready化・mergeは停止。
- card face側はPreview投入前の準備まで実施。migrationはtransaction/additive/restrict FK/RLS、importはproject ref強制照合・DB transaction・rollback・冪等差分集計へ強化。
