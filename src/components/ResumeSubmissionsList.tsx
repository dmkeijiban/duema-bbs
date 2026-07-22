'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FullscreenResumePreview, ScaledResumePreview } from '@/app/makers/resume-maker/ResumePreview'
import type { PublicResumeSubmission } from '@/lib/maker-resume-queries'

function excerpt(value: string, max = 40) {
  const oneLine = value.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo' }).format(new Date(value))
}

export function ResumeSubmissionsList({ submissions }: { submissions: PublicResumeSubmission[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [isExtraZoomOpen, setIsExtraZoomOpen] = useState(false)
  const openSubmission = submissions.find(submission => submission.id === openId) ?? null

  useEffect(() => {
    if (!openId) return
    const previous = document.body.style.overflow
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (isExtraZoomOpen) setIsExtraZoomOpen(false)
      else setOpenId(null)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', close)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', close) }
  }, [openId, isExtraZoomOpen])

  function closeSubmission() {
    setIsExtraZoomOpen(false)
    setOpenId(null)
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {submissions.map(submission => (
          <button key={submission.id} type="button" onClick={() => setOpenId(submission.id)} className="min-w-0 rounded-xl border bg-white p-3 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md active:scale-[0.99]">
            <div className="w-full overflow-hidden rounded border border-gray-200"><ScaledResumePreview data={submission.data} avatarUrl={submission.avatarUrl} resumeDate={submission.updatedAt} /></div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-50">
                {submission.avatarUrl && <img src={submission.avatarUrl} alt="" className="h-full w-full object-cover" />}
              </div>
              <p className="min-w-0 truncate font-black text-slate-900">{submission.displayName}</p>
            </div>
            {(submission.data.favoriteCivilization || submission.data.playStyle) && (
              <p className="mt-1 truncate text-xs text-gray-500">
                {[submission.data.favoriteCivilization, submission.data.playStyle].filter(Boolean).join(' / ')}
              </p>
            )}
            {submission.data.currentDecksText && <p className="mt-1 line-clamp-2 break-words text-xs text-gray-600">{excerpt(submission.data.currentDecksText, 40)}</p>}
            <p className="mt-2 text-[11px] text-gray-400">更新: {formatDate(submission.updatedAt)}</p>
            <span className="mt-2 block rounded border border-blue-300 px-3 py-1.5 text-center text-xs font-bold text-blue-700">履歴書を見る</span>
          </button>
        ))}
      </div>

      {openSubmission && (
        <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3" onMouseDown={event => { if (event.currentTarget === event.target) closeSubmission() }}>
          <section role="dialog" aria-modal="true" aria-labelledby="resume-submission-preview-title" className="flex h-full max-h-[calc(100dvh-24px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-50">
                {openSubmission.avatarUrl && <img src={openSubmission.avatarUrl} alt="" className="h-full w-full object-cover" />}
              </div>
              <h2 id="resume-submission-preview-title" className="min-w-0 truncate font-black text-slate-900">{openSubmission.displayName}</h2>
              <button type="button" onClick={closeSubmission} aria-label="閉じる" className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl hover:bg-slate-100 active:scale-95">×</button>
            </div>
            <button type="button" onClick={() => setIsExtraZoomOpen(true)} aria-label="履歴書をさらに拡大表示" className="group relative min-h-0 flex-1 bg-slate-100 p-2 text-left sm:p-4">
              <FullscreenResumePreview data={openSubmission.data} avatarUrl={openSubmission.avatarUrl} resumeDate={openSubmission.updatedAt} />
              <span className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-xs font-bold text-white opacity-90 transition group-hover:bg-black/80">押すとさらに拡大</span>
            </button>
            <div className="flex shrink-0 flex-wrap gap-2 border-t bg-white p-3">
              <Link href={`/u/${openSubmission.profileSlug}`} className="inline-flex min-h-11 flex-1 items-center justify-center rounded border border-gray-300 px-3 text-xs font-bold text-gray-700 hover:bg-gray-50 active:scale-[0.99]">公開プロフィールを見る</Link>
              <Link href="/makers/resume-maker" className="inline-flex min-h-11 flex-1 items-center justify-center rounded border border-blue-300 px-3 text-xs font-bold text-blue-700 hover:bg-blue-50 active:scale-[0.99]">自分の履歴書を作る</Link>
            </div>
          </section>
        </div>
      )}

      {openSubmission && isExtraZoomOpen && (
        <div role="presentation" className="fixed inset-0 z-[60] overflow-auto bg-black/95 p-3 sm:p-5" onMouseDown={event => { if (event.currentTarget === event.target) setIsExtraZoomOpen(false) }}>
          <div className="mx-auto w-full max-w-[1240px]">
            <div className="sticky top-0 z-10 mb-2 flex justify-end">
              <button type="button" onClick={() => setIsExtraZoomOpen(false)} aria-label="拡大表示を閉じる" className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl shadow-lg active:scale-95">×</button>
            </div>
            <div className="overflow-hidden bg-white shadow-2xl">
              <ScaledResumePreview data={openSubmission.data} avatarUrl={openSubmission.avatarUrl} resumeDate={openSubmission.updatedAt} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
