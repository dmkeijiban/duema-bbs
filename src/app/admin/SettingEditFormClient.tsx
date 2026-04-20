'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateSetting } from '@/app/actions/settings'
import { SettingRichEditor } from './SettingRichEditor'

interface Props {
  settingKey: string
  initialValue: string
  label: string
}

export function SettingEditFormClient({ settingKey, initialValue, label }: Props) {
  const [value, setValue] = useState(initialValue)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateSetting(settingKey, value)
      if (result.error) {
        setError(result.error)
      } else {
        router.push('/admin')
      }
    })
  }

  return (
    <div className="mb-4 border-2 border-purple-400 bg-purple-50 p-4">
      <h2 className="font-bold text-purple-800 mb-3">📝 {label} の編集</h2>
      <div className="space-y-2">
        <SettingRichEditor content={value} onChange={setValue} minHeight={120} />
        <div className="flex gap-2 items-center">
          <button onClick={handleSave} disabled={isPending}
            className="px-4 py-1.5 text-white text-xs font-medium disabled:opacity-60"
            style={{ background: '#6f42c1' }}>
            {isPending ? '保存中...' : '保存'}
          </button>
          <a href="/admin" className="px-4 py-1.5 text-xs border border-gray-300 text-gray-600">
            キャンセル
          </a>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>
    </div>
  )
}
