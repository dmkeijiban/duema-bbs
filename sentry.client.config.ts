import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // エラーサンプリング率（本番: 100%）
  tracesSampleRate: 0.1,

  // リプレイ: エラー時のみ記録
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.05,

  // 開発環境ではデバッグログを出力
  debug: false,

  ignoreErrors: [
    /pause.*video/i,
    /video.*pause/i,
    /querySelector.*video.*pause/i,
  ],

  beforeSend(event) {
    const message = [
      event.message,
      event.exception?.values?.map(value => value.value).join(' '),
    ].filter(Boolean).join(' ')

    // 動画pause系（既存フィルタ）
    if (/pause/i.test(message) && /video|querySelector|undefined|null/i.test(message)) {
      return null
    }

    // ① AdSense内部エラー: adsbygoogle.push() の非同期処理がグローバルエラーハンドラに届くもの
    //   → 自コードにガードを追加したが、外部スクリプト起因のものはbeforeSendで除外
    if (/adsbygoogle/i.test(message)) {
      return null
    }

    // ② CONFIG undefined: pagead2.googlesyndication.com 等の外部スクリプト起因
    //   → 自コードには CONFIG の参照なし（grep確認済み）
    if (/\bCONFIG\b/.test(message) && /undefined|not defined|can't find variable/i.test(message)) {
      return null
    }

    // ③ currentInset undefined: ブラウザ固有API or 外部スクリプト起因
    //   → 自コードには currentInset の参照なし（grep確認済み）
    if (/currentInset/i.test(message)) {
      return null
    }

    // スタックトレースが外部スクリプト（googlesyndication, doubleclick等）のみの場合も除外
    const frames = event.exception?.values?.flatMap(v => v.stacktrace?.frames ?? []) ?? []
    const allExternal = frames.length > 0 && frames.every(f =>
      /googlesyndication|doubleclick|googleads|pagead/i.test(f.filename ?? '')
    )
    if (allExternal) {
      return null
    }

    // ④ AdSense/pagead の Failed to fetch: 広告ブロッカー・Google広告サーバー障害由来
    //   "Failed to fetch" + googlesyndication/pagead が絡む場合のみ除外
    //   掲示板本体（supabase.co 等）への fetch 失敗は除外しない
    if (/failed to fetch/i.test(message)) {
      const adPattern = /googlesyndication|pagead|doubleclick\.net|googleads/i
      // メッセージ自体にURLが含まれるパターン（Sentryがbreadcrumbからタイトルに追記する形式）
      if (adPattern.test(message)) return null
      // スタックフレームが広告ドメインを指すパターン
      if (frames.some(f => adPattern.test(f.filename ?? ''))) return null
      // フェッチのbreadcrumbに広告URLが含まれるパターン
      const crumbs = (event.breadcrumbs?.values ?? []) as Array<{ data?: Record<string, unknown> }>
      if (crumbs.some(b => adPattern.test(String(b.data?.url ?? '')))) return null
    }

    return event
  },
})
