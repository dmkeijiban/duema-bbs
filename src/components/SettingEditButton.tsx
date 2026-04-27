'use client'

import { useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { updateSetting } from '@/app/actions/settings'

// Tiptap（ProseMirror）は大きいため、編集ボタンが開かれるまで遅延ロード
const SettingRichEditor = dynamic(
  () => import('@/app/admin/SettingRichEditor').then(m => m.SettingRichEditor),
  { ssr: false, loading: () => <div className="h-20 border border-gray-300 bg-gray-50 animate-pulse" /> }
)

interface Props {
  settingKey: string
  initialValue: string
  label?: string
  rows?: number
}

export function SettingEditButton({ settingKey, initialValue, label }: Props) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(initialValue)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateSetting(settingKey, value)
      if (!result.error) {
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <>
      <button
        onClick={() => { setValue(initialValue); setOpen(true) }}
        className="px-1.5 py-0.5 text-[10px] border border-purple-400 text-purple-700 hover:bg-purple-50 leading-none"
        title={label ? `${label}を編集` : 'テキストを編集'}
      >
        ✏️ 編集
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white border-2 border-purple-400 p-4 w-full max-w-lg mx-3"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-purple-800 mb-2 text-sm">
              📝 {label ?? 'テキスト編集'}
            </h3>
            <SettingRichEditor content={value} onChange={setValue} minHeight={120} />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleSave}
                disabled={isPending}
                className="px-4 py-1.5 text-white text-xs font-medium disabled:opacity-60"
                style={{ background: '#6f42c1' }}
              >
                {isPending ? '保存中...' : '保存'}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-1.5 text-xs border border-gray-300 text-gray-600"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
