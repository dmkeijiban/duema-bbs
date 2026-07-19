'use client'

import { useEffect, useState } from 'react'
import type { MakerGroup } from '@/lib/maker'
import type { PublicSubmission } from '@/lib/maker-submissions'
import HallReleaseLabel from '@/components/HallReleaseLabel'
import { HALL_RELEASE_DESIGN } from '@/lib/hall-release-design'
import { renderTierExportImage, type TierExportBadge } from '@/lib/maker-tier-export'

type ZoomedCard = { name: string; imageUrl: string }

const IMAGE_PROXY_PATH = '/api/makers/dm26-ex2-card-image'

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

function regulationBadge(value: string | null): TierExportBadge | null {
  const label = regulationLabel(value)
  if (!label) return null
  return { label, value: value === 'premium_hall' ? 'premium' : 'hall' }
}

export default function MakerSubmissionBoard({
  submission,
  groups,
  compact = false,
  enableActions = false,
  exportTitle,
  showExportAuthor = true,
  shareUrl,
  showRegulationBadges = true,
  exportLayout = 'tier',
}: {
  submission: PublicSubmission
  groups: MakerGroup[]
  compact?: boolean
  enableActions?: boolean
  exportTitle?: string
  showExportAuthor?: boolean
  shareUrl?: string
  showRegulationBadges?: boolean
  exportLayout?: 'tier' | 'prediction'
}) {
  const hallReleaseBoard = groups.some(group => group.key === 'release')
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
    // 殿堂解除予想は呼び出し元の指定が欠けても、releaseグループから専用レイアウトを判定する。
    const isPredictionExport = exportLayout === 'prediction' || groups.some(group => group.key === 'release')
    return renderTierExportImage({
      header: {
        title: exportTitle ?? submission.title,
        subtitle: showExportAuthor ? `制作者: ${submission.authorName}` : undefined,
        subtitleAlign: 'left',
      },
      layout: isPredictionExport ? 'release' : 'standard',
      rows: groups.map(group => ({
        key: group.key,
        labelLines: [group.label],
        cards: submission.items.filter(item => item.group_key === group.key).map(item => ({
          imageUrl: item.card.image_url,
          badge: showRegulationBadges ? regulationBadge(item.card.regulation) : null,
        })),
      })),
      loadImage: loadExportImage,
    })
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
    <div className={`overflow-hidden rounded-lg border ${hallReleaseBoard ? 'border-amber-300 bg-orange-50' : 'bg-slate-100'} ${compact ? 'text-[9px]' : 'text-sm'}`}>
      {groups.map(group => {
        const items = submission.items.filter(item => item.group_key === group.key)
        const hallRelease = group.key === 'release'
        const gridClassName = hallRelease ? (compact ? HALL_RELEASE_DESIGN.labelWidth.compactClass : HALL_RELEASE_DESIGN.labelWidth.standardClass) : (compact ? 'grid-cols-[28px_1fr]' : 'grid-cols-[54px_1fr]')
        return <div key={group.key} className={`grid border-b last:border-b-0 ${hallRelease ? HALL_RELEASE_DESIGN.rowClassName : ''} ${gridClassName}`}>
          <div className={`flex items-center justify-center font-black ${hallRelease ? HALL_RELEASE_DESIGN.labelClassName : group.color}`}>{hallRelease ? <HallReleaseLabel /> : <span className="whitespace-pre-line text-center">{group.label}</span>}</div>
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
