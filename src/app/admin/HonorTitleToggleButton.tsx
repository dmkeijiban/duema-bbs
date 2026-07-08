'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleHonorTitleEnabled } from '@/app/actions/honor-title'

export function HonorTitleToggleButton({ enabled }: { enabled: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleToggle = () => {
    setError(null)
    startTransition(async () => {
      const result = await toggleHonorTitleEnabled(!enabled)
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className={`rounded border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
          enabled
            ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
            : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        {isPending ? '切り替え中...' : enabled ? '✅ 有効（クリックで無効化）' : '⬜ 無効（クリックで有効化）'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
