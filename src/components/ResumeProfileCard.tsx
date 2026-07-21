'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ScaledResumePreview } from '@/app/makers/resume-maker/ResumePreview'
import type { ResumeData } from '@/lib/maker-resume'

export function ResumeProfileCard({ data, avatarUrl, isOwner, isPublic }: { data: ResumeData; avatarUrl: string | null; isOwner: boolean; isPublic: boolean }) {
  const [zoomed, setZoomed] = useState(false)

  return (
    <section className="mt-4 rounded-sm border border-gray-200 bg-white px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800">デュエマ履歴書</h2>
        {isOwner && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${isPublic ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{isPublic ? '公開中' : '非公開'}</span>}
      </div>
      <button type="button" onClick={() => setZoomed(true)} aria-label="デュエマ履歴書を拡大表示" className="mt-3 block w-40 overflow-hidden rounded border border-gray-200 transition-transform hover:scale-[1.02] sm:w-48">
        <ScaledResumePreview data={data} avatarUrl={avatarUrl} />
      </button>
      {isOwner && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/makers/resume-maker" className="inline-flex items-center justify-center rounded border border-blue-300 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50">編集する</Link>
        </div>
      )}
      {!isOwner && (
        <Link href="/makers/resume-maker" className="mt-3 inline-flex items-center justify-center rounded border border-blue-300 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50">この形式で自分も作る</Link>
      )}
      {zoomed && (
        <div role="presentation" className="fixed inset-0 z-50 overflow-auto bg-black/90 p-3" onMouseDown={event => { if (event.currentTarget === event.target) setZoomed(false) }}>
          <div className="mx-auto max-w-xl">
            <div className="mb-2 flex justify-end"><button type="button" onClick={() => setZoomed(false)} aria-label="閉じる" className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl">×</button></div>
            <ScaledResumePreview data={data} avatarUrl={avatarUrl} />
          </div>
        </div>
      )}
    </section>
  )
}
