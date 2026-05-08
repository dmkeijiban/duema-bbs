'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="ja">
      <body className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-gray-50">
        <p className="text-4xl mb-4">⚠️</p>
        <h2 className="text-xl font-bold text-gray-800 mb-2">予期しないエラーが発生しました</h2>
        <p className="text-gray-500 text-sm mb-6">
          申し訳ありません。問題が続く場合はお問い合わせください。
        </p>
        <button
          onClick={reset}
          className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          もう一度試す
        </button>
      </body>
    </html>
  )
}
