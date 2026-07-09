'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updatePostGuidanceSetting } from '@/app/actions/post-guidance'

type PostGuidanceSettingKey = 'show_thread_form_hint' | 'show_after_comment_thread_prompt' | 'show_comment_form_hint'

export function PostGuidanceToggleButton({
  settingKey,
  enabled,
}: {
  settingKey: PostGuidanceSettingKey
  enabled: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleToggle = () => {
    setError(null)
    startTransition(async () => {
      const result = await updatePostGuidanceSetting(settingKey, !enabled)
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
        {isPending ? '切り替え中...' : enabled ? '✅ 表示中（クリックで非表示に）' : '⬜ 非表示（クリックで表示に）'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
