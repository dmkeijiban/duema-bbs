'use client'

import Link from 'next/link'

export function SelectMakerToolbar({
  title,
  comment,
  showTitle,
  showComment,
  listLabel,
  listUrl,
  complete,
  isSavingImage,
  isSharing,
  message,
  onTitleChange,
  onCommentChange,
  onSaveImage,
  onShare,
  onReset,
}: {
  title: string
  comment: string
  showTitle: boolean
  showComment: boolean
  listLabel: string
  listUrl: string
  complete: boolean
  isSavingImage: boolean
  isSharing: boolean
  message: string
  onTitleChange: (value: string) => void
  onCommentChange: (value: string) => void
  onSaveImage: () => void
  onShare: () => void
  onReset: () => void
}) {
  return (
    <header className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[minmax(220px,0.7fr)_minmax(320px,1.3fr)]">
          {showTitle && (
            <label className="min-w-0 text-xs font-bold text-slate-700">
              投稿タイトル（任意）
              <input value={title} maxLength={40} onChange={(event) => onTitleChange(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base font-bold text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" />
            </label>
          )}
          {showComment && (
            <label className="min-w-0 text-xs font-bold text-slate-700">
              一言コメント（任意）
              <textarea value={comment} maxLength={200} rows={1} onChange={(event) => onCommentChange(event.target.value)} className="mt-1 min-h-10 w-full resize-y rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-base font-normal text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" />
            </label>
          )}
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 xl:w-auto xl:min-w-[500px]">
          <button type="button" disabled={!complete || isSavingImage} onClick={onSaveImage} className="min-h-10 rounded-lg bg-blue-700 px-3 text-sm font-bold text-white hover:bg-blue-800 disabled:bg-slate-300">{isSavingImage ? '画像生成中...' : '画像保存'}</button>
          <button type="button" disabled={!complete || isSharing} onClick={onShare} className="min-h-10 rounded-lg bg-black px-3 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-300">{isSharing ? '共有準備中...' : 'X共有'}</button>
          <button type="button" onClick={onReset} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">新しく作る</button>
          <Link href={listUrl} className="flex min-h-10 items-center justify-center rounded-lg border border-slate-300 px-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50">{listLabel}</Link>
        </div>
      </div>
      {message && <p role="status" className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p>}
    </header>
  )
}
