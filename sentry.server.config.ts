import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  // サーバー側はエラー全件キャプチャ
  tracesSampleRate: 0.1,

  debug: false,
})
