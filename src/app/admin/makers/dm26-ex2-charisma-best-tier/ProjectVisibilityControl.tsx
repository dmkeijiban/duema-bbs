'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { initializeTierProjectAndPublish, setTierProjectVisibility } from './actions'

export default function ProjectVisibilityControl({ isPublic, isReady }: { isPublic: boolean; isReady: boolean }) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')

  function toggle() {
    setMessage('')
    startTransition(async () => {
      const result = isReady ? await setTierProjectVisibility(!isPublic) : await initializeTierProjectAndPublish()
      setMessage(result.message)
    })
  }

  return (
    <section className={`mt-4 rounded-lg border p-4 ${isPublic ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 bg-white'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-500">現在の公開状態</p>
          <p className={`mt-1 font-black ${isPublic ? 'text-emerald-700' : 'text-slate-700'}`}>{!isReady ? '⚙️ 未準備' : isPublic ? '🌐 公開中' : '🔒 非公開'}</p>
          {!isReady && <p className="mt-1 text-sm text-slate-600">本番DBにTier表企画データまたは公式89枚の紐付けがありません。</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {isPublic && <Link href="/makers/dm26-ex2-charisma-best-tier" className="rounded border border-emerald-600 bg-white px-4 py-2 text-sm font-bold text-emerald-700">公開ページを見る</Link>}
          <button type="button" disabled={pending} onClick={toggle} className={`rounded px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${isPublic ? 'bg-slate-700' : 'bg-emerald-700'}`}>
            {pending ? (!isReady ? '準備中…' : isPublic ? '更新中…' : '公開中…') : !isReady ? '企画データを作成して公開' : isPublic ? '非公開にする' : '公開する'}
          </button>
        </div>
      </div>
      {message && <p aria-live="polite" className="mt-2 text-sm text-slate-700">{message}</p>}
    </section>
  )
}
