'use client'

import { useEffect, useState } from 'react'
import { renderSelectExportImage } from '@/lib/maker-select-export'
import { exactCardImageUrl } from '@/lib/card-catalog-shared'

type SelectCard = { id: string; name: string; imageUrl: string | null }

function loadExportImage(slug: string, card: SelectCard): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = exactCardImageUrl(card, slug)
  })
}

export default function SelectSubmissionBoard({
  slug,
  cards,
  compact = false,
  enableActions = false,
  exportTitle,
  shareUrl,
}: {
  slug: string
  cards: SelectCard[]
  compact?: boolean
  enableActions?: boolean
  exportTitle: string
  shareUrl?: string
}) {
  const [zoomedCard, setZoomedCard] = useState<SelectCard | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!zoomedCard && !previewUrl) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setZoomedCard(null)
      setPreviewUrl(current => {
        if (current) URL.revokeObjectURL(current)
        return null
      })
    }
    addEventListener('keydown', onKeyDown)
    return () => removeEventListener('keydown', onKeyDown)
  }, [previewUrl, zoomedCard])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  async function saveImage() {
    if (isSaving) return
    setIsSaving(true)
    setError('')
    try {
      const blob = await renderSelectExportImage({
        title: exportTitle,
        cards,
        hasImage: card => Boolean(card.imageUrl),
        loadImage: card => loadExportImage(slug, card),
      })
      const url = URL.createObjectURL(blob)
      setPreviewUrl(current => {
        if (current) URL.revokeObjectURL(current)
        return url
      })
    } catch (saveError) {
      console.error('カード選択の画像生成に失敗しました', saveError)
      setError('画像を生成できませんでした。時間をおいて再度お試しください。')
    } finally {
      setIsSaving(false)
    }
  }

  function cardImage(card: SelectCard) {
    return card.imageUrl
      ? <img src={card.imageUrl} alt={card.name} loading="lazy" decoding="async" className="h-full w-full object-contain" />
      : <span className="flex h-full items-center justify-center p-1 text-center text-xs text-slate-500">{card.name}</span>
  }

  return <>
    <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-3'}`}>
      {cards.map(card => enableActions ? <button
        key={card.id}
        type="button"
        disabled={!card.imageUrl}
        onClick={() => card.imageUrl && setZoomedCard(card)}
        aria-label={card.imageUrl ? `${card.name}を拡大表示` : undefined}
        className={`relative aspect-[5/7] overflow-hidden rounded-lg border border-slate-200 bg-slate-100 ${card.imageUrl ? 'cursor-zoom-in' : 'cursor-default'}`}
      >
        {cardImage(card)}
      </button> : <div
        key={card.id}
        className="relative aspect-[5/7] overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
      >
        {cardImage(card)}
      </div>)}
    </div>

    {enableActions && <div className="mt-4">
      <div className="grid grid-cols-2 gap-3">
        <button type="button" disabled={isSaving} onClick={saveImage} className="flex min-h-12 items-center justify-center rounded-lg border border-blue-700 bg-white px-3 py-3 text-center font-bold text-blue-700 disabled:opacity-50">
          {isSaving ? '画像生成中...' : '画像保存'}
        </button>
        {shareUrl && <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center rounded-lg bg-black px-3 py-3 text-center font-bold text-white">Xで共有</a>}
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>}

    {zoomedCard?.imageUrl && <div role="dialog" aria-modal="true" aria-label={`${zoomedCard.name}の拡大画像`} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4" onClick={() => setZoomedCard(null)}>
      <div className="relative max-h-full max-w-lg" onClick={event => event.stopPropagation()}>
        <button type="button" onClick={() => setZoomedCard(null)} className="absolute -right-2 -top-12 rounded bg-white px-4 py-2 font-bold text-black">閉じる</button>
        <img src={zoomedCard.imageUrl} alt={zoomedCard.name} className="max-h-[82vh] max-w-full rounded object-contain" />
      </div>
    </div>}

    {previewUrl && <div role="dialog" aria-modal="true" aria-label="保存用画像" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3" onClick={() => setPreviewUrl(null)}>
      <div className="max-h-full w-full max-w-3xl overflow-auto rounded-xl bg-white p-3" onClick={event => event.stopPropagation()}>
        <p className="mb-2 text-center text-sm font-bold">画像を長押しして写真へ保存できます</p>
        <img src={previewUrl} alt={`${exportTitle}の保存用画像`} className="mx-auto h-auto max-w-full" />
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="rounded border px-4 py-2 font-bold">新しいタブで開く</a>
          <button type="button" onClick={() => setPreviewUrl(null)} className="rounded bg-black px-4 py-2 font-bold text-white">閉じる</button>
        </div>
      </div>
    </div>}
  </>
}
