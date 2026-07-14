'use client'

import { useEffect, useState } from 'react'
import type { MakerGroup } from '@/lib/maker'
import type { PublicSubmission } from '@/lib/maker-submissions'

type ZoomedCard = { name: string; imageUrl: string }

const IMAGE_PROXY_PATH = '/api/makers/dm26-ex2-card-image'
const CARDS_PER_LINE = 6
const CARD_WIDTH = 138
const CARD_HEIGHT = Math.round(CARD_WIDTH * 88 / 63)

function isIOSDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

async function loadExportImage(url: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.decoding = 'async'
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('カード画像の読み込みに失敗しました'))
  })
  image.src = `${IMAGE_PROXY_PATH}?url=${encodeURIComponent(url)}`
  try {
    await image.decode()
  } catch {
    await loaded
  }
  return image
}

async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('PNGの生成に失敗しました')
  return blob
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function safeFilename(title: string) {
  const normalized = title.replace(/[\\/:*?"<>|]/g, '-').trim()
  return `${normalized || 'tier-table'}.png`
}

function makerThumbnailUrl(url: string, width: number) {
  return `${IMAGE_PROXY_PATH}?url=${encodeURIComponent(url)}&width=${width}`
}

function regulationLabel(value: string | null) {
  return value === 'premium_hall' ? 'プレミアム殿堂' : value === 'hall' ? '殿堂' : null
}

export default function MakerSubmissionBoard({
  submission,
  groups,
  compact = false,
  enableActions = false,
  exportTitle,
  shareUrl,
  compactGroupLabel,
  showRegulationBadges = true,
}: {
  submission: PublicSubmission
  groups: MakerGroup[]
  compact?: boolean
  enableActions?: boolean
  exportTitle?: string
  shareUrl?: string
  compactGroupLabel?: string
  showRegulationBadges?: boolean
}) {
  const [zoomedCard, setZoomedCard] = useState<ZoomedCard | null>(null)
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

  async function createPng() {
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    const context = canvas.getContext('2d')
    if (!context) throw new Error('画像生成を利用できません')

    const left = 30
    const totalWidth = canvas.width - left * 2
    const labelWidth = 96
    const horizontalPadding = 12
    const gap = 10
    const rowGap = 10
    const top = 120
    const bottomPadding = 28
    const palette: Record<string, { background: string; border: string; label: string; labelBackground: string }> = {
      s: { background: '#fff1f2', border: '#fca5a5', label: '#be123c', labelBackground: '#fca5a5' },
      a: { background: '#fff7ed', border: '#fdba74', label: '#c2410c', labelBackground: '#fdba74' },
      b: { background: '#fffbeb', border: '#fcd34d', label: '#a16207', labelBackground: '#fcd34d' },
      c: { background: '#ecfdf5', border: '#6ee7b7', label: '#047857', labelBackground: '#6ee7b7' },
      d: { background: '#eff6ff', border: '#93c5fd', label: '#1d4ed8', labelBackground: '#93c5fd' },
    }

    const rows = groups.map(group => {
      const items = submission.items.filter(item => item.group_key === group.key)
      const lineCount = items.length ? Math.ceil(items.length / CARDS_PER_LINE) : 0
      const rowHeight = items.length
        ? lineCount * CARD_HEIGHT + Math.max(0, lineCount - 1) * rowGap + 20
        : 76
      return { group, items, rowHeight }
    })
    canvas.height = top + rows.reduce((sum, row) => sum + row.rowHeight + 5, 0) + bottomPadding

    const imageUrls = [...new Set(rows.flatMap(row => row.items.map(item => item.card.image_url).filter((url): url is string => Boolean(url))))]
    const loadedImages = new Map<string, HTMLImageElement>()
    await Promise.all(imageUrls.map(async url => {
      try {
        loadedImages.set(url, await loadExportImage(url))
      } catch {
        // 読み込めなかったカードだけプレースホルダーで出力する
      }
    }))

    context.fillStyle = '#f8fafc'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#0f172a'
    context.font = 'bold 38px sans-serif'
    context.fillText(exportTitle ?? submission.title, 40, 58)
    context.font = 'bold 22px sans-serif'
    context.fillStyle = '#475569'
    context.fillText(`制作者: ${submission.authorName}`, 40, 91)

    let y = top
    for (const row of rows) {
      const colors = palette[row.group.key.toLowerCase()] ?? {
        background: '#f8fafc',
        border: '#cbd5e1',
        label: '#111827',
        labelBackground: '#cbd5e1',
      }
      context.fillStyle = colors.background
      context.fillRect(left, y, totalWidth, row.rowHeight)
      context.fillStyle = colors.labelBackground
      context.fillRect(left, y, labelWidth, row.rowHeight)
      context.strokeStyle = colors.border
      context.lineWidth = 1.5
      context.strokeRect(left, y, totalWidth, row.rowHeight)
      context.fillStyle = colors.label
      context.font = 'bold 42px sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(row.group.label, left + labelWidth / 2, y + row.rowHeight / 2)

      for (const [index, item] of row.items.entries()) {
        const column = index % CARDS_PER_LINE
        const line = Math.floor(index / CARDS_PER_LINE)
        const x = left + labelWidth + horizontalPadding + column * (CARD_WIDTH + gap)
        const cardY = y + 10 + line * (CARD_HEIGHT + rowGap)
        const image = item.card.image_url ? loadedImages.get(item.card.image_url) : null
        if (image) {
          context.drawImage(image, x, cardY, CARD_WIDTH, CARD_HEIGHT)
        } else {
          context.fillStyle = '#e2e8f0'
          context.fillRect(x, cardY, CARD_WIDTH, CARD_HEIGHT)
        }
        const badge = regulationLabel(item.card.regulation)
        if (badge) {
          context.font = 'bold 15px sans-serif'
          const badgeWidth = context.measureText(badge).width + 14
          context.fillStyle = item.card.regulation === 'premium_hall' ? '#991b1b' : '#facc15'
          context.fillRect(x + CARD_WIDTH - badgeWidth - 4, cardY + CARD_HEIGHT - 25, badgeWidth, 21)
          context.fillStyle = item.card.regulation === 'premium_hall' ? '#ffffff' : '#422006'
          context.textAlign = 'center'
          context.textBaseline = 'middle'
          context.fillText(badge, x + CARD_WIDTH - badgeWidth / 2 - 4, cardY + CARD_HEIGHT - 14.5)
        }
      }
      y += row.rowHeight + 5
    }

    return canvasToPngBlob(canvas)
  }

  async function saveImage() {
    if (isSaving) return
    setIsSaving(true)
    setError('')
    try {
      const blob = await createPng()
      if (isIOSDevice() || typeof document.createElement('a').download !== 'string') {
        const url = URL.createObjectURL(blob)
        setPreviewUrl(current => {
          if (current) URL.revokeObjectURL(current)
          return url
        })
      } else {
        downloadBlob(blob, safeFilename(submission.title))
      }
    } catch (saveError) {
      console.error('登録済みTier表の画像生成に失敗しました', saveError)
      setError('画像を生成できませんでした。時間をおいて再度お試しください。')
    } finally {
      setIsSaving(false)
    }
  }

  return <>
    <div className={`overflow-hidden rounded-lg border bg-slate-100 ${compact ? 'text-[9px]' : 'text-sm'}`}>
      {groups.map(group => {
        const items = submission.items.filter(item => item.group_key === group.key)
        return <div key={group.key} className={`grid border-b last:border-b-0 ${compact ? 'grid-cols-[28px_1fr]' : 'grid-cols-[54px_1fr]'}`}>
          <div className={`flex items-center justify-center font-black ${group.color}`}><span className="whitespace-pre-line text-center">{compact && compactGroupLabel ? compactGroupLabel : group.label}</span></div>
          <div className={`grid bg-white ${compact ? 'min-h-10 grid-cols-8 gap-0.5 p-1' : 'min-h-20 grid-cols-4 gap-2 p-2 sm:grid-cols-7'}`}>
            {items.map(item => {
              const image = item.card.image_url
              const card = image ? { name: item.card.name, imageUrl: image } : null
              const badge = regulationLabel(item.card.regulation)
              return <button
                key={item.card_id}
                type="button"
                disabled={!enableActions || !card}
                onClick={() => card && setZoomedCard(card)}
                aria-label={enableActions && card ? `${item.card.name}を拡大表示` : undefined}
                className={`relative aspect-[63/88] overflow-hidden rounded border bg-slate-200 ${enableActions && card ? 'cursor-zoom-in' : 'cursor-default'}`}
              >
                {image ? <img src={compact ? makerThumbnailUrl(image, 160) : image} alt={item.card.name} loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center p-1 text-center">{item.card.name}</span>}
                {showRegulationBadges && badge && <span className={`absolute bottom-0 right-0 px-1 py-0.5 text-[8px] font-black ${item.card.regulation === 'premium_hall' ? 'bg-red-800 text-white' : 'bg-yellow-300 text-yellow-950'}`}>{badge}</span>}
              </button>
            })}
          </div>
        </div>
      })}
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

    {zoomedCard && <div role="dialog" aria-modal="true" aria-label={`${zoomedCard.name}の拡大画像`} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4" onClick={() => setZoomedCard(null)}>
      <div className="relative max-h-full max-w-lg" onClick={event => event.stopPropagation()}>
        <button type="button" onClick={() => setZoomedCard(null)} className="absolute -right-2 -top-12 rounded bg-white px-4 py-2 font-bold text-black">閉じる</button>
        <img src={zoomedCard.imageUrl} alt={zoomedCard.name} className="max-h-[82vh] max-w-full rounded object-contain" />
      </div>
    </div>}

    {previewUrl && <div role="dialog" aria-modal="true" aria-label="保存用画像" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3" onClick={() => setPreviewUrl(null)}>
      <div className="max-h-full w-full max-w-3xl overflow-auto rounded-xl bg-white p-3" onClick={event => event.stopPropagation()}>
        <p className="mb-2 text-center text-sm font-bold">画像を長押しして写真へ保存できます</p>
        <img src={previewUrl} alt={`${submission.title}の保存用画像`} className="mx-auto h-auto max-w-full" />
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="rounded border px-4 py-2 font-bold">新しいタブで開く</a>
          <button type="button" onClick={() => setPreviewUrl(null)} className="rounded bg-black px-4 py-2 font-bold text-white">閉じる</button>
        </div>
      </div>
    </div>}
  </>
}
