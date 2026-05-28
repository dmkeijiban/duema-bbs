'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateSetting } from '@/app/actions/settings'
import { SettingRichEditor } from './SettingRichEditor'

// URL として保存すべきキー（リッチエディタを使わず plain input にする）
const URL_SETTING_KEYS = new Set(['sns_x', 'sns_youtube', 'sns_discord'])

interface Props {
  settingKey: string
  initialValue: string
  label: string
}

export function SettingEditFormClient({ settingKey, initialValue, label }: Props) {
  // URLフィールドの場合、DB に HTML が入っていたら href だけ抽出してフォールバック
  const extractUrl = (raw: string): string => {
    if (!URL_SETTING_KEYS.has(settingKey)) return raw
    if (!raw.trimStart().startsWith('<')) return raw
    const m = raw.match(/href=['"]([^'"]+)['"]/)
    return m ? m[1] : ''
  }

  const [value, setValue] = useState(extractUrl(initialValue))
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const isUrl = URL_SETTING_KEYS.has(settingKey)

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
        {isUrl ? (
          <input
            type="url"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="https://"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-purple-400"
          />
        ) : (
          <SettingRichEditor content={value} onChange={setValue} minHeight={120} />
        )}
        <div className="flex gap-2 items-center">
          <button onClick={handleSave} disabled={isPending}
            className="px-4 py-1.5 text-white text-xs font-medium disabled:opacity-60"
            style={{ background: '#6f42c1' }}>
            {isPending ? '保存中...' : '保存'}
          </button>
          <Link href="/admin" className="px-4 py-1.5 text-xs border border-gray-300 text-gray-600">
            キャンセル
          </Link>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>
    </div>
  )
}
