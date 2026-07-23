'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { FullscreenResumeRenderer, ResumeRenderer, ScaledResumeRenderer } from '@/app/makers/resume-maker/ResumeRenderer'
import { renderResumeExportImage, resumePngFileName } from '@/lib/maker-resume-export'
import { RESUME_SHARE_TEXT } from '@/app/makers/resume-maker/constants'
import type { ResumeData } from '@/lib/maker-resume'

type PngPreview = { src: string; fileName: string; file: File }

export function ResumeProfileCard({ data, avatarUrl, resumeDate, isOwner, isPublic, showActions = true }: { data: ResumeData; avatarUrl: string | null; resumeDate: string; isOwner: boolean; isPublic: boolean; showActions?: boolean }) {
  const [zoomed, setZoomed] = useState(false)
  const [isSavingImage, setIsSavingImage] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [pngPreview, setPngPreview] = useState<PngPreview | null>(null)
  const exportPreviewRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!zoomed && !pngPreview) return
    const previous = document.body.style.overflow
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setZoomed(false); setPngPreview(null) } }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', close)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', close) }
  }, [zoomed, pngPreview])

  async function handleSaveImage() {
    if (isSavingImage) return
    setIsSavingImage(true)
    try {
      const blob = await renderResumeExportImage(exportPreviewRef.current)
      const fileName = resumePngFileName(data.handleName)
      const file = new File([blob], fileName, { type: blob.type || 'image/png' })
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      })
      setPngPreview({ src, fileName, file })
    } finally {
      setIsSavingImage(false)
    }
  }

  async function savePreviewImage() {
    if (!pngPreview) return
    const shareData: ShareData = { files: [pngPreview.file], title: 'デュエマ履歴書' }
    const canShareFile = typeof navigator.share === 'function' && (typeof navigator.canShare !== 'function' || navigator.canShare(shareData))
    if (canShareFile) {
      try { await navigator.share(shareData); return } catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return }
    }
    const link = document.createElement('a')
    link.href = pngPreview.src
    link.download = pngPreview.fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  function handleShare() {
    if (isSharing) return
    setIsSharing(true)
    const shareWindow = window.open('', '_blank')
    try {
      const intent = `https://twitter.com/intent/tweet?${new URLSearchParams({ text: RESUME_SHARE_TEXT, url: 'https://www.duema-bbs.com/makers/resume-maker' })}`
      if (shareWindow) shareWindow.location.href = intent
      else window.open(intent, '_blank', 'noopener,noreferrer')
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <section className="mt-4 rounded-sm border border-gray-200 bg-white px-4 py-4">
      <div aria-hidden="true" className="pointer-events-none fixed left-[-10000px] top-0">
        <ResumeRenderer data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} exportRef={exportPreviewRef} />
      </div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800">デュエマ履歴書</h2>
        {isOwner && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${isPublic ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{isPublic ? '公開中' : '非公開'}</span>}
      </div>
      <button type="button" onClick={() => setZoomed(true)} aria-label="デュエマ履歴書を拡大表示" className="mt-3 block w-40 overflow-hidden rounded border border-gray-200 transition-transform hover:scale-[1.02] sm:w-48">
        <ScaledResumeRenderer data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} />
      </button>
      {showActions && (
        <div className="mt-3 flex flex-wrap gap-2">
          {isOwner && <button type="button" disabled={isSavingImage} onClick={() => void handleSaveImage()} className="inline-flex items-center justify-center rounded border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40">{isSavingImage ? '生成中…' : '画像を保存'}</button>}
          {isOwner && <button type="button" disabled={isSharing} onClick={handleShare} className="inline-flex items-center justify-center rounded border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40">{isSharing ? '共有準備中…' : 'Xで共有'}</button>}
          {isOwner && <Link href="/makers/resume-maker" className="inline-flex items-center justify-center rounded border border-blue-300 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50">編集する</Link>}
          {!isOwner && <Link href="/makers/resume-maker" className="inline-flex items-center justify-center rounded border border-blue-300 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50">自分の履歴書を作る</Link>}
          <Link href="/makers/resume-maker/submissions" className="inline-flex items-center justify-center rounded border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50">みんなの履歴書を見る</Link>
        </div>
      )}
      {zoomed && (
        <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3" onMouseDown={event => { if (event.currentTarget === event.target) setZoomed(false) }}>
          <section role="dialog" aria-modal="true" aria-label="デュエマ履歴書" className="flex h-full max-h-[calc(100dvh-24px)] w-full max-w-[900px] flex-col overflow-hidden">
            <div className="mb-2 flex shrink-0 justify-end"><button type="button" onClick={() => setZoomed(false)} aria-label="閉じる" className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl">×</button></div>
            <div className="min-h-0 flex-1"><FullscreenResumeRenderer data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} /></div>
          </section>
        </div>
      )}
      {pngPreview && (
        <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/75 p-3" onMouseDown={event => { if (event.currentTarget === event.target) setPngPreview(null) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="resume-profile-png-title" className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-2"><div><h2 id="resume-profile-png-title" className="font-black text-slate-900">デュエマ履歴書</h2><p className="text-xs text-slate-500">iPhoneは下のボタンから「画像を保存」を選べます</p></div><button type="button" onClick={() => setPngPreview(null)} aria-label="画像プレビューを閉じる" className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-slate-700 hover:bg-slate-100">×</button></div>
            <div className="min-h-0 overscroll-contain overflow-auto bg-slate-100 p-2 sm:p-4"><img src={pngPreview.src} alt="デュエマ履歴書の保存用画像" className="mx-auto h-auto max-w-full shadow" /></div>
            <div className="border-t bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"><button type="button" onClick={() => void savePreviewImage()} className="flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-700 px-4 font-bold text-white">画像を保存</button></div>
          </section>
        </div>
      )}
    </section>
  )
}
