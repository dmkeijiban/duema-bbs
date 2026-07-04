# 広告枠と外部スクリプトの CLS / 速度改善メモ

## 目的

SEO、表示速度、スマホ体験の診断で、広告枠の高さ予約や外部スクリプト数が Core Web Vitals、特に CLS / TBT / INP に影響する可能性が見えている。

ただし AdSense の読み込み方式や広告配置は収益、表示率、審査品質に影響する可能性があるため、現時点では実装変更を行わない。今後検証するときの判断材料と安全ルールだけを残す。

## 現状

- 広告表示は主に `src/components/AdBanner.tsx` の `AdBanner` コンポーネントで扱っている。
- `AdBanner` は `minHeight` を props で受け取れるが、デフォルト値は `0`。
- 外部スクリプトや計測系の読み込みは主に `src/app/layout.tsx` に集約されている。
- 現在読み込んでいる、または関係する主な外部スクリプト、処理は次の通り。
  - Google Analytics 4
  - Microsoft Clarity
  - PostHog
  - Google AdSense
  - Service Worker 登録
- AdSense は収益、広告表示率、審査品質に影響する可能性があるため、読み込み方式の変更は慎重に扱う。
- `images.unoptimized: true` は過去の Vercel コスト対策として入っているため、原則変更しない。

## CLS / 速度の懸念

- 広告枠の高さ予約がない箇所、または `minHeight=0` の箇所では、広告読み込み後にレイアウトが動き CLS が起きる可能性がある。
- 外部スクリプトが増えると、メインスレッドの処理が増えて TBT / INP に影響する可能性がある。
- PageSpeed Insights の点数だけを理由に、AdSense を遅延、削除、移動しない。
- 特に AdSense は表示タイミングや配置変更が収益、表示率、審査に影響する可能性があるため、速度指標だけで判断しない。

## 今後の検証方法

- PageSpeed Insights で PC / モバイルの Core Web Vitals と診断項目を確認する。
- Google Search Console の Core Web Vitals レポートで、実ユーザーに近い傾向を確認する。
- Microsoft Clarity で実際のスマホ操作、スクロール、離脱、表示崩れを確認する。
- Vercel Analytics / Speed Insights で本番環境の速度傾向を確認する。
- 実機スマホで広告表示前後のレイアウト移動、スクロール中の違和感、操作遅延を確認する。
- 変更前後で広告収益、広告表示率、CLS を比較する。
- 単発のスコアではなく、数日単位の傾向で見る。

## 触ってよい改善候補

- 広告枠ごとの高さ予約を検討する。
- どのページにどの広告枠があるか一覧化する。
- CLS が大きいページだけ個別に調整する。
- 先に docs 上で方針を決めてから実装する。
- 収益影響が小さそうな単一広告枠から小さく試す。

## 今は触らないもの

- AdSense script strategy の変更。
- AdSense の大規模な再配置。
- `images.unoptimized` の変更。
- `next/image` 最適化の再導入。
- 収益に影響する広告削除。
- robots / canonical / sitemap / meta の変更。
- DB / env / cron / Typefully / Discord 関連。

## 実装する場合の安全ルール

- 1 PR で 1 種類の広告枠だけを変更する。
- 変更前後で PC / スマホ表示を確認する。
- PageSpeed Insights の点数だけで判断しない。
- 収益影響が出る可能性を PR 本文に明記する。
- 本番反映後、数日単位で広告収益、広告表示率、CLS の傾向を見る。
- 問題が出た場合に戻しやすいよう、変更範囲を小さく保つ。
