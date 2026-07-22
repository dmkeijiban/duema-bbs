'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ScaledResumePreview } from '@/app/makers/resume-maker/ResumePreview'
import { renderResumeExportImage, resumePngFileName } from '@/lib/maker-resume-export'
import { setResumeVisibility } from '@/app/makers/resume-maker/actions'
import { RESUME_SHARE_TEXT } from '@/app/makers/resume-maker/constants'
import type { ResumeData } from '@/lib/maker-resume'

type PngPreview = { src: string; fileName: string; file: File }

export function ResumeMypagePanel({
  data,
  avatarUrl,
  isPublic: initialIsPublic,
  updatedAtLabel,
  resumeDate,
  profileSlug,
}: {
  data: ResumeData
  avatarUrl: string | null
  isPublic: boolean
  updatedAtLabel: string
  resumeDate: string
  profileSlug: string
}) {
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [isToggling, setIsToggling] = useState(false)
  const [toggleMessage, setToggleMessage] = useState('')
  const [isSavingImage, setIsSavingImage] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [pngPreview, setPngPreview] = useState<PngPreview | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  useEffect(() => {
    if (!isPreviewOpen && !pngPreview) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (pngPreview) setPngPreview(null)
      else setIsPreviewOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isPreviewOpen, pngPreview])

  async function handleToggleVisibility() {
    if (isToggling) return
    setIsToggling(true)
    setToggleMessage('変更中…')
    const next = !isPublic
    try {
      const result = await setResumeVisibility(next)
      if (result.ok) setIsPublic(next)
      setToggleMessage(result.message)
    } finally {
      setIsToggling(false)
    }
  }

  async function handleSaveImage() {
    if (isSavingImage) return
    setIsSavingImage(true)
    try {
      const blob = await renderResumeExportImage(data, { url: avatarUrl }, resumeDate)
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
    <>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <button type="button" aria-label="履歴書を拡大表示" onClick={() => setIsPreviewOpen(true)} className="w-28 shrink-0 cursor-zoom-in overflow-hidden rounded border border-gray-200 text-left">
          <ScaledResumePreview data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900">{isPublic ? '公開中' : '非公開'}</p>
          <p className="mt-1 text-xs text-gray-500">最終更新日: {updatedAtLabel}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/makers/resume-maker" className="inline-flex items-center justify-center rounded border border-blue-300 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50">履歴書を編集する</Link>
            <Link href={`/u/${profileSlug}`} className="inline-flex items-center justify-center rounded border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50">公開プロフィールを見る</Link>
            <button type="button" disabled={isSavingImage} onClick={() => void handleSaveImage()} className="inline-flex items-center justify-center rounded border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40">{isSavingImage ? '生成中…' : '画像を保存'}</button>
            <button type="button" disabled={isSharing} onClick={handleShare} className="inline-flex items-center justify-center rounded border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40">{isSharing ? '共有準備中…' : 'Xで共有'}</button>
            <Link href="/makers/resume-maker/submissions" className="inline-flex items-center justify-center rounded border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50">みんなの履歴書を見る</Link>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">履歴書の公開設定</h3>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${isPublic ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{isPublic ? '公開中' : '非公開'}</span>
        </div>
        <p className="mt-1 text-xs text-gray-600">{isPublic ? 'あなたの公開プロフィールと「みんなの履歴書」に表示されています。' : 'あなた以外には表示されません。'}</p>
        {toggleMessage && <p role="status" className="mt-1 text-xs font-bold text-blue-700">{toggleMessage}</p>}
        <button type="button" onClick={() => void handleToggleVisibility()} disabled={isToggling} className={`mt-2 inline-flex min-h-9 items-center justify-center rounded px-4 text-xs font-bold text-white disabled:opacity-60 ${isPublic ? 'bg-slate-500 hover:bg-slate-600' : 'bg-emerald-700 hover:bg-emerald-800'}`}>
          {isToggling ? '変更中…' : isPublic ? '非公開にする' : '公開する'}
        </button>
      </div>

      {isPreviewOpen && (
        <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/75 p-3" onMouseDown={event => { if (event.currentTarget === event.target) setIsPreviewOpen(false) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="resume-mypage-preview-title" className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-2"><h2 id="resume-mypage-preview-title" className="font-black text-slate-900">デュエマ履歴書</h2><button type="button" onClick={() => setIsPreviewOpen(false)} aria-label="拡大プレビューを閉じる" className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-slate-700 hover:bg-slate-100">×</button></div>
            <div className="min-h-0 overscroll-contain overflow-auto bg-slate-100 p-2 sm:p-4"><ScaledResumePreview data={data} avatarUrl={avatarUrl} resumeDate={resumeDate} className="mx-auto" /></div>
          </section>
        </div>
      )}

      {pngPreview && (
        <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/75 p-3" onMouseDown={event => { if (event.currentTarget === event.target) setPngPreview(null) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="resume-mypage-png-title" className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-2"><div><h2 id="resume-mypage-png-title" className="font-black text-slate-900">デュエマ履歴書</h2><p className="text-xs text-slate-500">iPhoneは下のボタンから「画像を保存」を選べます</p></div><button type="button" onClick={() => setPngPreview(null)} aria-label="画像プレビューを閉じる" className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-slate-700 hover:bg-slate-100">×</button></div>
            <div className="min-h-0 overscroll-contain overflow-auto bg-slate-100 p-2 sm:p-4"><img src={pngPreview.src} alt="デュエマ履歴書の保存用画像" className="mx-auto h-auto max-w-full shadow" /></div>
            <div className="border-t bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"><button type="button" onClick={() => void savePreviewImage()} className="flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-700 px-4 font-bold text-white">画像を保存</button></div>
          </section>
        </div>
      )}
    </>
  )
}
