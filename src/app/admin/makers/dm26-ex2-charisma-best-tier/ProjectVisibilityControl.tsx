'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { setTierProjectVisibility } from './actions'

export default function ProjectVisibilityControl({ isPublic }: { isPublic: boolean }) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')

  function toggle() {
    setMessage('')
    startTransition(async () => {
      const result = await setTierProjectVisibility(!isPublic)
      setMessage(result.message)
    })
  }

  return (
    <section className={`mt-4 rounded-lg border p-4 ${isPublic ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 bg-white'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-500">現在の公開状態</p>
          <p className={`mt-1 font-black ${isPublic ? 'text-emerald-700' : 'text-slate-700'}`}>{isPublic ? '🌐 公開中' : '🔒 非公開'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPublic && <Link href="/makers/dm26-ex2-charisma-best-tier" className="rounded border border-emerald-600 bg-white px-4 py-2 text-sm font-bold text-emerald-700">公開ページを見る</Link>}
          <button type="button" disabled={pending} onClick={toggle} className={`rounded px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${isPublic ? 'bg-slate-700' : 'bg-emerald-700'}`}>
            {pending ? '更新中…' : isPublic ? '非公開にする' : '公開する'}
          </button>
        </div>
      </div>
      {message && <p aria-live="polite" className="mt-2 text-sm text-slate-700">{message}</p>}
    </section>
  )
}
