'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function Error({
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
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
      <p className="text-4xl mb-4">⚠️</p>
      <h2 className="text-xl font-bold text-gray-800 mb-2">エラーが発生しました</h2>
      <p className="text-gray-500 text-sm mb-6">
        ページの読み込み中に問題が起きました。再試行するか、しばらく経ってからアクセスしてください。
      </p>
      <button
        onClick={reset}
        className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
      >
        もう一度試す
      </button>
    </div>
  )
}
