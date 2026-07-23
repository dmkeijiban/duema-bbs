'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FullscreenResumePreview, ScaledResumePreview } from '@/app/makers/resume-maker/ResumePreview'
import type { ResumeData } from '@/lib/maker-resume'

export function ResumeMypagePanel({
  data,
  avatarUrl,
  isPublic: _initialIsPublic,
  updatedAtLabel: _updatedAtLabel,
  resumeDate,
}: {
  data: ResumeData
  avatarUrl: string | null
  isPublic: boolean
  updatedAtLabel: string
  resumeDate: string
}) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  useEffect(() => {
    if (!isPreviewOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsPreviewOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isPreviewOpen])

  return (
    <>
      <div className="mt-3 flex h-full flex-col">
        <button type="button" aria-label="履歴書を拡大表示" onClick={() => setIsPreviewOpen(true)} className="block w-full cursor-zoom-in overflow-hidden rounded-lg border border-gray-200 bg-white text-left transition active:scale-[0.99]">
          <ScaledResumePreview data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} className="w-full" />
        </button>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
          <Link href="/makers/resume-maker" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-blue-300 px-2 text-center text-xs font-bold text-blue-700 hover:bg-blue-50">履歴書を編集する</Link>
          <Link href="/makers/resume-maker/submissions" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-blue-300 px-2 text-center text-xs font-bold text-blue-700 hover:bg-blue-50">みんなの履歴書を見る</Link>
        </div>
      </div>

      {isPreviewOpen && (
        <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/75 p-3" onMouseDown={event => { if (event.currentTarget === event.target) setIsPreviewOpen(false) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="resume-mypage-preview-title" className="relative flex h-full max-h-[calc(100dvh-24px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b px-4 py-2"><h2 id="resume-mypage-preview-title" className="font-black text-slate-900">デュエマ履歴書</h2><button type="button" onClick={() => setIsPreviewOpen(false)} aria-label="拡大プレビューを閉じる" className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-slate-700 hover:bg-slate-100">×</button></div>
            <div className="min-h-0 flex-1 bg-slate-100 p-2 sm:p-4"><FullscreenResumePreview data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} /></div>
          </section>
        </div>
      )}

    </>
  )
}
