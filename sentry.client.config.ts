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

    if (/pause/i.test(message) && /video|querySelector|undefined|null/i.test(message)) {
      return null
    }

    return event
  },
})
