'use client'

import Link from 'next/link'
import { useEffect, type CSSProperties } from 'react'
import { useMakerDefaultTitle } from '@/components/MakerDefaultTitleContext'
import { AdstirBannerClient } from '@/components/AdstirBannerClient'

export function SelectMakerToolbar({
  title,
  comment,
  showTitle,
  showComment,
  listUrl,
  complete,
  isSaving,
  isSavingImage,
  message,
  onTitleChange,
  onCommentChange,
  onSave,
  onSaveImage,
  showAd,
}: {
  title: string
  comment: string
  showTitle: boolean
  showComment: boolean
  listUrl: string
  complete: boolean
  isSaving: boolean
  isSavingImage: boolean
  message: string
  onTitleChange: (value: string) => void
  onCommentChange: (value: string) => void
  onSave: () => void
  onSaveImage: () => void
  showAd?: boolean
}) {
  const defaultTitle = useMakerDefaultTitle()
  const defaultTitleLength = Array.from(defaultTitle.trim()).length
  const titlePreferredWidth = Math.min(640, Math.max(260, defaultTitleLength * 18 + 40))
  const querySeparator = listUrl.includes('?') ? '&' : '?'
  const mineUrl = `${listUrl}${querySeparator}tab=mine`
  const allUrl = `${listUrl}${querySeparator}tab=all`

  useEffect(() => {
    if (!showTitle || title.trim() || !defaultTitle.trim()) return
    const timer = window.setTimeout(() => onTitleChange(defaultTitle), 0)
    return () => window.clearTimeout(timer)
  }, [defaultTitle, onTitleChange, showTitle, title])

  function isIosDevice() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  }

  function handleSaveImage() {
    if (isIosDevice()) {
      onSaveImage()
      return
    }

    const downloadPreview = () => {
      const dialog = document.querySelector('[aria-labelledby="select-png-preview-title"]')
      const image = dialog?.querySelector('img[alt$="の保存用画像"]') as HTMLImageElement | null
      if (!image?.src) return false

      const safeName = (title.trim() || 'duema-card-selection').replace(/[\\/:*?"<>|]/g, '_')
      const link = document.createElement('a')
      link.href = image.src
      link.download = `${safeName}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()

      const closeButton = dialog?.querySelector('button[aria-label="画像プレビューを閉じる"]') as HTMLButtonElement | null
      closeButton?.click()
      return true
    }

    const observer = new MutationObserver(() => {
      if (downloadPreview()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    onSaveImage()
    window.setTimeout(() => observer.disconnect(), 15000)
  }

  return (
    <>
      {showAd && <AdstirBannerClient slot="sp_list_top" className="mb-3 mt-0" />}
      <header className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-end">
            {showTitle && (
              <label
                className="min-w-0 shrink-0 text-xs font-bold text-slate-700 md:w-[var(--title-width)]"
                style={{ '--title-width': `${titlePreferredWidth}px` } as CSSProperties}
              >
                投稿タイトル（任意）
                <input data-select-maker-title value={title} maxLength={40} onChange={(event) => onTitleChange(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base font-bold text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" />
              </label>
            )}
            {showComment && (
              <label className="min-w-0 flex-1 text-xs font-bold text-slate-700">
                一言コメント（任意）
                <textarea value={comment} maxLength={200} rows={1} onChange={(event) => onCommentChange(event.target.value)} className="mt-1 min-h-10 w-full resize-y rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-base font-normal text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" />
              </label>
            )}
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 xl:w-auto xl:grid-cols-[repeat(4,max-content)]">
            <button type="button" disabled={!complete || isSaving} onClick={onSave} className="order-1 min-h-10 rounded-lg bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800 disabled:bg-slate-300">{isSaving ? '保存中...' : '保存'}</button>
            <Link href={mineUrl} className="order-3 flex min-h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-center text-sm font-bold text-slate-700 hover:bg-slate-50 sm:order-2">自分の9選</Link>
            <Link href={allUrl} className="order-4 flex min-h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-center text-sm font-bold text-slate-700 hover:bg-slate-50 sm:order-3">みんなの9選</Link>
            <button type="button" disabled={!complete || isSavingImage} onClick={handleSaveImage} className="order-2 min-h-10 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-700 disabled:bg-slate-300 sm:order-4">{isSavingImage ? '画像生成中...' : '画像出力'}</button>
          </div>
        </div>
        {message && <p role="status" className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p>}
      </header>
    </>
  )
}
