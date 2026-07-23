'use client'

import { useFormStatus } from 'react-dom'
import { useState } from 'react'
import type { AdstirAdSettings } from '@/lib/adstir'

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-w-36 rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white transition active:scale-95 disabled:cursor-wait disabled:bg-blue-400"
    >
      {pending ? '保存中…' : 'adstir広告設定を保存'}
    </button>
  )
}

export function AdstirSettingsForm({
  action,
  ads,
}: {
  action: (formData: FormData) => void | Promise<void>
  ads: AdstirAdSettings
}) {
  const [enabled, setEnabled] = useState(ads.enabled)
  const [listTop, setListTop] = useState(ads.listTop)
  const [listMiddle, setListMiddle] = useState(ads.listMiddle)
  const [threadInline, setThreadInline] = useState(ads.threadInline)

  const enablePlacement = (setter: (value: boolean) => void, value: boolean) => {
    setter(value)
    if (value) setEnabled(true)
  }

  const rows = [
    ['adstir_sp_list_top', 'SP スレ一覧上部（320×100）', listTop, setListTop],
    ['adstir_sp_list_middle', 'SP スレ一覧途中（320×100）', listMiddle, setListMiddle],
    ['adstir_sp_thread_inline', 'SP スレ内インライン（300×250）', threadInline, setThreadInline],
  ] as const

  const canDisplay = enabled && (listTop || listMiddle || threadInline)

  return (
    <form action={action} className="mt-5 space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-black">adstir広告（スマホWEB / CPC直接配信）</h2>
      <p className="text-xs text-gray-500">
        3枠ともスマートフォン幅（768px未満）のみ表示します。PC・タブレット幅では表示しません。
      </p>
      <label className="flex items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          name="adstir_enabled"
          checked={enabled}
          onChange={event => setEnabled(event.target.checked)}
          className="h-5 w-5"
        />
        <span>adstir広告を有効にする（全体スイッチ）</span>
      </label>
      {rows.map(([name, label, checked, setter]) => (
        <label key={name} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={name}
            checked={checked}
            onChange={event => enablePlacement(setter, event.target.checked)}
            className="h-5 w-5"
          />
          <span>{label}</span>
        </label>
      ))}
      {!canDisplay && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
          広告を表示するには「全体スイッチ」＋いずれかの枠をONにしてください。
        </p>
      )}
      <div className="flex items-center gap-3">
        <SaveButton />
        <span className="text-xs font-bold text-gray-500">押すと「保存中…」に変わります</span>
      </div>
    </form>
  )
}
