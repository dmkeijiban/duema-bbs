'use client'

import { useFormStatus } from 'react-dom'
import { useState } from 'react'
import type { GoodlifeAdSettings } from '@/lib/ads'

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-w-36 rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white transition active:scale-95 disabled:cursor-wait disabled:bg-blue-400"
    >
      {pending ? '保存中…' : '広告設定を保存'}
    </button>
  )
}

export function AdSettingsForm({
  action,
  ads,
}: {
  action: (formData: FormData) => void | Promise<void>
  ads: GoodlifeAdSettings
}) {
  const [enabled, setEnabled] = useState(ads.enabled)
  const [threadList, setThreadList] = useState(ads.threadList)
  const [threadDetail, setThreadDetail] = useState(ads.threadDetail)
  const [footer, setFooter] = useState(ads.footer)
  const [desktop, setDesktop] = useState(ads.desktop)
  const [mobile, setMobile] = useState(ads.mobile)

  const enablePlacement = (setter: (value: boolean) => void, value: boolean) => {
    setter(value)
    if (value) {
      setEnabled(true)
      if (!desktop && !mobile) setMobile(true)
    }
  }

  const rows = [
    ['goodlife_inline_enabled', 'Goodlifeインライン広告', enabled, setEnabled],
    ['goodlife_inline_thread_list', 'スレッド一覧・1件目の上', threadList, (value: boolean) => enablePlacement(setThreadList, value)],
    ['goodlife_inline_thread_detail', 'スレッド詳細に表示', threadDetail, (value: boolean) => enablePlacement(setThreadDetail, value)],
    ['goodlife_inline_footer', 'フッターの上に表示', footer, (value: boolean) => enablePlacement(setFooter, value)],
    ['goodlife_inline_desktop', 'PCで表示', desktop, setDesktop],
    ['goodlife_inline_mobile', 'スマホで表示', mobile, setMobile],
  ] as const

  const canDisplay = enabled && (threadList || threadDetail || footer) && (desktop || mobile)

  return (
    <form action={action} className="mt-5 space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">許可済みの固定広告タグだけを読み込みます。広告配信コード自体は変更しません。</p>
      {rows.map(([name, label, checked, setter]) => (
        <label key={name} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={name}
            checked={checked}
            onChange={event => setter(event.target.checked)}
            className="h-5 w-5"
          />
          <span>{label}</span>
        </label>
      ))}
      {!canDisplay && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
          広告を表示するには「Goodlifeインライン広告」＋表示場所＋PCまたはスマホの3つをONにしてください。
        </p>
      )}
      <div className="flex items-center gap-3">
        <SaveButton />
        <span className="text-xs font-bold text-gray-500">押すと「保存中…」に変わります</span>
      </div>
    </form>
  )
}
