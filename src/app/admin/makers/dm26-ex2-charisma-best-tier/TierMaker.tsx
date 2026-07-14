'use client'

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { emptyMakerDraft, type MakerCard, type MakerDraft, type MakerGroup, type MakerSubmissionMeta } from '@/lib/maker'
import { recordMakerEvent } from '@/lib/maker-events'
import { getMakerAnonymousId, type MakerEventType } from '@/lib/maker-events-shared'
import MakerCommunityTier, { type MakerAggregate } from '@/components/MakerCommunityTier'
import { saveTierSubmission } from './actions'

const SHOW_CARD_DETAIL_FILTERS = false

const EXPORT_FORMAT = 'auto'
const EXPORT_CARDS_PER_LINE = 6
const EXPORT_CARD_WIDTH = 140
const EXPORT_CARD_HEIGHT = EXPORT_CARD_WIDTH * 88 / 63

function normalizeSearchText(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[・･\s　\-‐‑‒–—―ー]/g, '')
}

export type TierAggregate = MakerAggregate

type TierMakerProps = {
  cards: MakerCard[]
  groups: MakerGroup[]
  initialDraft: MakerDraft
  unrated: boolean
  canSave: boolean
  aggregates: TierAggregate[]
  imageProxyPath?: string
  saveAction?: (payload: Record<string, string[]>, meta?: MakerSubmissionMeta) => Promise<{ ok: boolean; message: string; redirectTo?: string }>
  submissionFields?: { defaultTitle: string; defaultComment?: string }
  saveButtonLabel?: string
  hasSavedSubmission?: boolean
  // 指定した企画slugへ利用イベントを記録する（公開ページのみ指定。未指定なら計測しない）
  eventSlug?: string
  beforeLogin?: () => Promise<void>
  storageSlug?: string
  exportTitle?: string
  exportFilename?: string
  shareText?: string
  shareUrl?: string
  communityTitle?: string
  communityButtonLabel?: string
  poolFilters?: { value: string; label: string }[]
  aggregateMode?: 'tier' | 'selection'
  exportBrand?: string
  responseLabel?: string
  groupRowClassName?: string
  groupGridClassName?: string
  groupLabelClassName?: string
  groupLabelText?: Record<string, string>
  cardBadgePositionClassName?: string
  cardBadgeTextClassName?: string
  selectionImageZoom?: boolean
  communityHref?: string
  registrationLabel?: string
  registrationHeading?: string
  autoRegisterOnImageSave?: boolean
}

function CardImage({ card, contain = false }: { card: MakerCard; contain?: boolean }) {
  if (card.imageUrl) {
    return (
      <img
        src={card.imageUrl}
        alt={card.name}
        loading="lazy"
        className={`h-full w-full ${contain ? 'object-contain' : 'object-cover'}`}
      />
    )
  }

  return (
    <div className="flex h-full items-center justify-center bg-slate-200 p-1 text-center text-[9px] font-bold text-slate-500">
      {card.name}
    </div>
  )
}

function restoreDraft(value: unknown, groups: MakerGroup[], validCardIds: Set<string>): MakerDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const source = value as Record<string, unknown>
  const restored = emptyMakerDraft(groups)
  const seen = new Set<string>()

  for (const group of groups) {
    const ids = source[group.key]
    if (!Array.isArray(ids)) continue

    for (const id of ids) {
      if (typeof id !== 'string' || !validCardIds.has(id) || seen.has(id)) continue
      seen.add(id)
      restored[group.key].push(id)
    }
  }

  return restored
}

async function loadExportImage(url: string, imageProxyPath: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.decoding = 'async'
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('カード画像の読み込みに失敗しました'))
  })
  image.src = `${imageProxyPath}?url=${encodeURIComponent(url)}`
  try {
    // iOS Safari では decode() が画像取得成功時でも reject することがある
    await image.decode()
  } catch {
    await loaded
  }
  return image
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(',')
  const mime = header?.match(/data:([^;]+)/)?.[1] ?? 'image/png'
  const binary = atob(body ?? '')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  try {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (blob) return blob
  } catch {
    // toBlob 自体が例外を投げる環境があるため toDataURL にフォールバック
  }
  return dataUrlToBlob(canvas.toDataURL('image/png'))
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
  // 即時 revoke すると Safari がダウンロード前に URL を失うことがある
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isIOSDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export default function TierMaker({ cards, groups, initialDraft, unrated, canSave, aggregates, imageProxyPath = '/api/admin/makers/dm26-ex2-card-image', saveAction = saveTierSubmission, submissionFields, saveButtonLabel, hasSavedSubmission = false, eventSlug, beforeLogin, storageSlug = 'dm26-ex2-charisma-best-tier', exportTitle = 'DM26-EX2 悪感謝祭 カリスマBEST Tier表', exportFilename = 'dm26-ex2-tier-auto.png', shareText = '悪感謝祭カリスマBEST Tier表メーカー', shareUrl, communityTitle = 'みんなのTier', communityButtonLabel = '📊 みんなのTierを見る', poolFilters = [], aggregateMode = 'tier', exportBrand, responseLabel = 'Tier表', groupRowClassName, groupGridClassName = 'grid-cols-[52px_1fr]', groupLabelClassName, groupLabelText, cardBadgePositionClassName = 'left-1 top-1', cardBadgeTextClassName = 'text-white', selectionImageZoom = false, communityHref, registrationLabel = '作品', registrationHeading, autoRegisterOnImageSave = false }: TierMakerProps) {
  const STORAGE_KEY = `maker-draft:${storageSlug}:v1`
  const DRAFT_CHOICE_KEY = `maker-draft-choice:${storageSlug}:v1`
  const [draft, setDraft] = useState(initialDraft)
  const [selected, setSelected] = useState<MakerCard | null>(null)
  const [query, setQuery] = useState('')
  const [civilization, setCivilization] = useState('')
  const [cost, setCost] = useState('')
  const [cardType, setCardType] = useState('')
  const [poolFilter, setPoolFilter] = useState('')
  const [message, setMessage] = useState('')
  const [submissionTitle, setSubmissionTitle] = useState(submissionFields?.defaultTitle ?? '')
  const [submissionComment, setSubmissionComment] = useState(submissionFields?.defaultComment ?? '')
  const [showCommunity, setShowCommunity] = useState(false)
  const [showLoginRequired, setShowLoginRequired] = useState(false)
  const [localDraftConflict, setLocalDraftConflict] = useState<MakerDraft | null>(null)
  const [isSavingImage, setIsSavingImage] = useState(false)
  const [isSharingToX, setIsSharingToX] = useState(false)
  const [exportPreviewUrl, setExportPreviewUrl] = useState<string | null>(null)
  const [zoomedCard, setZoomedCard] = useState<MakerCard | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pending, startTransition] = useTransition()
  const skipFirstDraftPersist = useRef(true)
  const hasTrackedTierCreated = useRef(false)
  const hasOpenedCommunityFromHash = useRef(false)
  const exportImageCache = useRef(new Map<string, Promise<HTMLImageElement>>())
  const pngCache = useRef(new Map<string, Blob>())
  const pngGeneration = useRef(new Map<string, Promise<Blob>>())
  const lastAutoRegisteredKey = useRef<string | null>(null)

  const cardsById = useMemo(() => new Map(cards.map(card => [card.id, card])), [cards])
  const validCardIds = useMemo(() => new Set(cards.map(card => card.id)), [cards])
  const usedCardIds = useMemo(() => new Set(Object.values(draft).flat()), [draft])
  const draftKey = useMemo(() => JSON.stringify(draft), [draft])
  const latestDraftKey = useRef(draftKey)
  latestDraftKey.current = draftKey

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return

    try {
      const restored = restoreDraft(JSON.parse(stored), groups, validCardIds)
      if (restored) {
        const hasResolvedConflict = localStorage.getItem(DRAFT_CHOICE_KEY) === 'resolved'
        if (hasSavedSubmission && !hasResolvedConflict) setLocalDraftConflict(restored)
        else queueMicrotask(() => setDraft(restored))
      }
    } catch (error) {
      console.warn('Tier表の下書きを復元できませんでした', error)
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [DRAFT_CHOICE_KEY, STORAGE_KEY, groups, hasSavedSubmission, validCardIds])

  useEffect(() => {
    if (skipFirstDraftPersist.current) {
      skipFirstDraftPersist.current = false
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    } catch (error) {
      console.warn('Tier表の下書きを保存できませんでした', error)
    }
  }, [STORAGE_KEY, draft])

  useEffect(() => {
    pngCache.current.clear()
    pngGeneration.current.clear()
  }, [draftKey])

  useEffect(() => {
    if (!selected && !showLoginRequired && !exportPreviewUrl && !zoomedCard) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setSelected(null)
      setShowLoginRequired(false)
      setZoomedCard(null)
      setExportPreviewUrl(current => {
        if (current) URL.revokeObjectURL(current)
        return null
      })
    }

    addEventListener('keydown', onKeyDown)
    return () => removeEventListener('keydown', onKeyDown)
  }, [selected, showLoginRequired, exportPreviewUrl, zoomedCard])

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  const normalizedQuery = normalizeSearchText(query)
  const visibleCards = cards.filter(card => {
    if (usedCardIds.has(card.id)) return false
    const searchText = card.searchText ?? `${card.name} ${card.cardNumber ?? ''}`
    if (normalizedQuery && !normalizeSearchText(searchText).includes(normalizedQuery)) return false
    if (civilization && !card.civilization.includes(civilization)) return false
    if (cost && card.cost !== Number(cost)) return false
    if (cardType && card.cardType !== cardType) return false
    if (poolFilter && card.badge?.value !== poolFilter) return false
    return true
  })

  const civilizationOptions = [...new Set(cards.flatMap(card => card.civilization))]
  const costOptions = [...new Set(cards.map(card => card.cost).filter((value): value is number => value !== null))].sort((a, b) => a - b)
  const cardTypeOptions = [...new Set(cards.map(card => card.cardType).filter((value): value is string => Boolean(value)))]

  // 利用状況の統計イベント。失敗してもUIには影響させない（fire-and-forget）。
  function trackEvent(eventType: MakerEventType) {
    if (!eventSlug) return
    try {
      const anonymousId = getMakerAnonymousId()
      void recordMakerEvent({ slug: eventSlug, eventType, anonymousId }).catch(() => {})
    } catch {
      // 計測失敗は無視する
    }
  }

  useEffect(() => {
    if (window.location.hash !== '#community-tier' || hasOpenedCommunityFromHash.current) return
    hasOpenedCommunityFromHash.current = true
    setShowCommunity(true)
    trackEvent('aggregate_viewed')
    window.requestAnimationFrame(() => {
      document.getElementById('community-tier')?.scrollIntoView({ block: 'start' })
    })
    // 初回マウント時だけURLを確認する。trackEventはeventSlug以外の状態に依存しない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function moveCard(cardId: string, groupKey: string | null) {
    setDraft(current => {
      const next = Object.fromEntries(
        Object.entries(current).map(([key, ids]) => [key, ids.filter(id => id !== cardId)]),
      ) as MakerDraft
      if (groupKey && next[groupKey]) next[groupKey] = [...next[groupKey], cardId]
      return next
    })
    setSelected(null)

    // 最初にカードをTierへ配置した時点で「Tier作成」1回として記録（ページ表示ごとに1回、短時間の重複はサーバー側で除外）
    if (groupKey && !hasTrackedTierCreated.current) {
      hasTrackedTierCreated.current = true
      trackEvent('tier_created')
    }
  }

  function reorderCard(groupKey: string, cardId: string, delta: number) {
    setDraft(current => {
      const ids = current[groupKey]
      if (!ids) return current

      const nextIds = [...ids]
      const currentIndex = nextIds.indexOf(cardId)
      const nextIndex = currentIndex + delta
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= nextIds.length) return current

      ;[nextIds[currentIndex], nextIds[nextIndex]] = [nextIds[nextIndex], nextIds[currentIndex]]
      return { ...current, [groupKey]: nextIds }
    })
  }

  function save() {
    if (!canSave) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
      } catch (error) {
        console.warn('Tier表の下書きを保存できませんでした', error)
      }
      setShowLoginRequired(true)
      return
    }

    setMessage('')
    startTransition(async () => {
      try {
        const result = await saveAction(draft, submissionFields ? { title: submissionTitle, comment: submissionComment } : undefined)
        setMessage(result.message)
        if (result.ok && result.redirectTo) location.assign(result.redirectTo)
      } catch (error) {
        console.error('Tier表の保存に失敗しました', error)
        setMessage('保存に失敗しました。時間をおいて再度お試しください。')
      }
    })
  }

  async function goToLogin() {
    await beforeLogin?.().catch(() => {})
    const next = `${location.pathname}${location.search}`
    location.assign(`/login?next=${encodeURIComponent(next)}`)
  }

  async function createTierPng(): Promise<Blob> {
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable')

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
      release: { background: '#fff7ed', border: '#fdba74', label: '#9a3412', labelBackground: '#fbbf24' },
    }

    const rowLayouts = groups.map(group => {
      const ids = draft[group.key] ?? []
      const cardsPerLine = EXPORT_CARDS_PER_LINE
      const cardWidth = ids.length ? EXPORT_CARD_WIDTH : 0
      const cardHeight = ids.length ? EXPORT_CARD_HEIGHT : 0
      const lineCount = ids.length ? Math.ceil(ids.length / cardsPerLine) : 0
      const rowHeight = ids.length
        ? Math.ceil(lineCount * cardHeight + Math.max(0, lineCount - 1) * rowGap + 20)
        : 76
      return { group, ids, cardWidth, cardHeight, cardsPerLine, rowHeight }
    })

    const contentHeight = top + rowLayouts.reduce((sum, row) => sum + row.rowHeight + 5, 0) + bottomPadding
    canvas.height = contentHeight

    const imageUrls = [...new Set(
      rowLayouts.flatMap(row => row.ids.map(cardId => cardsById.get(cardId)?.imageUrl).filter((url): url is string => Boolean(url))),
    )]
    const loadedImages = new Map<string, HTMLImageElement>()
    await Promise.all(imageUrls.map(async url => {
      try {
        let imagePromise = exportImageCache.current.get(url)
        if (!imagePromise) {
          imagePromise = loadExportImage(url, imageProxyPath)
          exportImageCache.current.set(url, imagePromise)
        }
        const image = await imagePromise
        loadedImages.set(url, image)
      } catch {
        exportImageCache.current.delete(url)
      }
    }))

    context.fillStyle = '#f8fafc'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#0f172a'
    context.font = 'bold 38px sans-serif'
    context.fillText(exportTitle, 40, 58)
    if (exportBrand) {
      context.font = 'bold 22px sans-serif'
      context.fillStyle = '#475569'
      context.textAlign = 'right'
      context.fillText(exportBrand, canvas.width - 40, 88)
      context.textAlign = 'left'
    }
    let y = top

    for (const row of rowLayouts) {
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
      const labelLines = (groupLabelText?.[row.group.key] ?? row.group.label).split('\n')
      const labelFontSize = labelLines.length > 1 ? 22 : 42
      const labelLineHeight = labelFontSize * 1.2
      const labelCenterY = y + row.rowHeight / 2
      const labelStartY = labelCenterY - ((labelLines.length - 1) * labelLineHeight) / 2
      context.fillStyle = colors.label
      context.font = `bold ${labelFontSize}px sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      for (const [lineIndex, line] of labelLines.entries()) {
        context.fillText(line, left + labelWidth / 2, labelStartY + lineIndex * labelLineHeight)
      }

      for (const [index, cardId] of row.ids.entries()) {
        const card = cardsById.get(cardId)
        if (!card) continue

        const column = index % row.cardsPerLine
        const line = Math.floor(index / row.cardsPerLine)
        const x = left + labelWidth + horizontalPadding + column * (row.cardWidth + gap)
        const cardY = y + 10 + line * (row.cardHeight + rowGap)

        const image = card.imageUrl ? loadedImages.get(card.imageUrl) : null
        if (image) {
          context.drawImage(image, x, cardY, row.cardWidth, row.cardHeight)
        } else {
          context.fillStyle = '#e2e8f0'
          context.fillRect(x, cardY, row.cardWidth, row.cardHeight)
        }
      }

      y += row.rowHeight + 5
    }

    return await canvasToPngBlob(canvas)
  }

  function getTierPng(): Promise<Blob> {
    const key = `${EXPORT_FORMAT}:${draftKey}`
    const cached = pngCache.current.get(key)
    if (cached) return Promise.resolve(cached)
    const generating = pngGeneration.current.get(key)
    if (generating) return generating

    const expectedDraftKey = draftKey
    const promise = createTierPng().then(blob => {
      if (latestDraftKey.current === expectedDraftKey) pngCache.current.set(key, blob)
      return blob
    }).finally(() => {
      pngGeneration.current.delete(key)
    })
    pngGeneration.current.set(key, promise)
    return promise
  }

  function showErrorToast(text: string) {
    setToast(text)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 6000)
  }

  function openExportPreview(blob: Blob) {
    const url = URL.createObjectURL(blob)
    setExportPreviewUrl(current => {
      if (current) URL.revokeObjectURL(current)
      return url
    })
  }

  function closeExportPreview() {
    setExportPreviewUrl(current => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
  }

  function deliverTierImage(blob: Blob) {
    // iOS Safari はプログラム的な a[download] クリックを無視することがあるため、
    // プレビューを表示して「長押し保存 / 新規タブ表示 / ダウンロード」から選べるようにする
    if (isIOSDevice() || typeof document.createElement('a').download !== 'string') {
      openExportPreview(blob)
      return
    }
    downloadBlob(blob, exportFilename)
  }

  async function saveImage() {
    if (isSavingImage) return
    setIsSavingImage(true)
    setMessage('')
    try {
      const blob = await getTierPng()
      const registrationKey = JSON.stringify([draft, submissionTitle.trim(), submissionComment.trim()])
      if (autoRegisterOnImageSave && lastAutoRegisteredKey.current !== registrationKey) {
        const result = await saveAction(
          draft,
          submissionFields ? { title: submissionTitle, comment: submissionComment } : undefined,
        )
        if (!result.ok) {
          setMessage(`画像は保存できますが、自動登録に失敗しました: ${result.message}`)
        } else {
          lastAutoRegisteredKey.current = registrationKey
          setMessage(`${responseLabel}も自動登録しました`)
        }
      }
      // 画像生成が成功して保存処理へ進んだ時だけ記録（生成失敗時は記録しない）
      trackEvent('image_saved')
      deliverTierImage(blob)
    } catch (error) {
      console.error('Tier表画像の生成に失敗しました', error)
      const cause = error instanceof Error ? error.message : String(error)
      showErrorToast(`画像を生成できませんでした（${cause}）`)
    } finally {
      setIsSavingImage(false)
    }
  }

  async function shareToX() {
    if (isSharingToX) return
    const text = shareText
    // X側に残っている古いOGPキャッシュを避け、専用サムネイルを再取得させる。
    const resolvedShareUrl = shareUrl ? new URL(shareUrl, location.origin).toString() : `${location.origin}/makers/dm26-ex2-charisma-best-tier?share=tier-v3`
    const tweetUrl = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(resolvedShareUrl)}`
    const mobile = isMobileDevice()
    const popup = mobile ? null : window.open(tweetUrl, '_blank', 'noopener,noreferrer')
    if (!mobile && !popup) {
      setMessage('Xの投稿画面を開けませんでした。ブラウザのポップアップ設定を確認してください。')
      return
    }
    setIsSharingToX(true)
    setMessage('')
    // X共有処理を開始した時点で記録する
    trackEvent('x_shared')

    try {
      const blob = await getTierPng()
      deliverTierImage(blob)
      if (mobile) {
        const message = `${text}\n${resolvedShareUrl}`
        location.href = `twitter://post?message=${encodeURIComponent(message)}`
      }
    } catch (error) {
      console.error('X共有に失敗しました', error)
      const cause = error instanceof Error ? error.message : String(error)
      showErrorToast(`画像を生成できませんでした（${cause}）`)
    } finally {
      setIsSharingToX(false)
    }
  }

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-3">
        {groups.map(group => {
          const ids = draft[group.key] ?? []
          const isEmpty = ids.length === 0

          return (
            <div
              key={group.key}
              className={`grid rounded-xl border transition-[min-height] ${groupGridClassName} ${isEmpty ? 'min-h-[72px]' : 'min-h-28'} ${groupRowClassName ?? group.color}`}
            >
              <div className={`flex items-center justify-center text-2xl font-black ${groupLabelClassName ?? ''}`}><span className="whitespace-pre-line">{groupLabelText?.[group.key] ?? group.label}</span></div>
              <div className={`grid grid-cols-4 gap-2 bg-white/80 sm:grid-cols-7 ${isEmpty ? 'p-1.5' : 'p-2'}`}>
                {ids.map(cardId => {
                  const card = cardsById.get(cardId)
                  if (!card) return null

                  return (
                    <div key={cardId} className="group relative">
                      <button
                        type="button"
                        onClick={() => setSelected(card)}
                        aria-label={card.name}
                        className="w-full overflow-hidden rounded border bg-white"
                      >
                        <div className="relative aspect-[63/88]"><CardImage card={card} />{card.badge && <span className={`absolute rounded px-1 py-0.5 text-[9px] font-black shadow ${cardBadgePositionClassName} ${cardBadgeTextClassName} ${card.badge.className}`}>{card.badge.label}</span>}</div>
                      </button>
                      <div className="mt-1 flex justify-center gap-1">
                        <button type="button" aria-label="左へ" onClick={() => reorderCard(group.key, cardId, -1)} className="rounded border px-2">←</button>
                        <button type="button" aria-label="右へ" onClick={() => reorderCard(group.key, cardId, 1)} className="rounded border px-2">→</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {submissionFields && (
          <div className="rounded-xl border bg-white p-4">
            <h2 className="font-black">{registrationHeading ?? `${registrationLabel}を登録`}</h2>
            <label className="mt-3 block text-sm font-bold">タイトル <span className="font-normal text-gray-500">任意</span>
              <input value={submissionTitle} onChange={event => setSubmissionTitle(event.target.value)} maxLength={40} className="mt-1 w-full rounded-lg border px-3 py-2 text-base font-normal" />
            </label>
            <label className="mt-3 block text-sm font-bold">一言コメント <span className="font-normal text-gray-500">任意</span>
              <textarea value={submissionComment} onChange={event => setSubmissionComment(event.target.value)} maxLength={200} rows={3} className="mt-1 w-full resize-y rounded-lg border px-3 py-2 text-base font-normal" placeholder="こだわったポイントなど" />
            </label>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { if (confirm('全てリセットしますか？')) setDraft(emptyMakerDraft(groups)) }}
            className="flex-1 whitespace-nowrap rounded border bg-white px-3 py-2 text-sm font-bold sm:flex-none"
          >
            リセット
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="flex-1 whitespace-nowrap rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
          >
            {pending ? '保存中...' : saveButtonLabel ?? '登録'}
          </button>
          <button type="button" disabled={isSavingImage} onClick={saveImage} className="flex-1 whitespace-nowrap rounded border border-blue-600 bg-white px-4 py-2 text-sm font-bold text-blue-700 disabled:opacity-50 sm:flex-none">{isSavingImage ? '画像生成中...' : '画像保存'}</button>
          <button type="button" disabled={isSharingToX} onClick={shareToX} className="flex-1 whitespace-nowrap rounded bg-black px-4 py-2 text-sm font-bold text-white disabled:opacity-50 sm:flex-none">{isSharingToX ? '共有準備中...' : 'Xで共有'}</button>
          <button type="button" onClick={() => { if (communityHref) { location.assign(communityHref); return } if (!showCommunity) trackEvent('aggregate_viewed'); setShowCommunity(value => !value) }} className="flex-1 whitespace-nowrap rounded border bg-white px-4 py-2 text-sm font-bold sm:flex-none">{communityButtonLabel}</button>
          {message && <span className="self-center text-sm">{message}</span>}
        </div>

        {!communityHref && showCommunity && <MakerCommunityTier cards={cards} groups={groups} aggregates={aggregates} title={communityTitle} mode={aggregateMode} />}
      </section>

      <aside className="h-fit rounded-xl border bg-white p-3 lg:sticky lg:top-3">
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="カード名検索" className="w-full rounded border p-2 text-sm" />
        {poolFilters.length > 0 && <div className="mt-2 flex gap-1">{[{ value: '', label: 'すべて' }, ...poolFilters].map(filter => <button type="button" key={filter.value} onClick={() => setPoolFilter(filter.value)} className={`flex-1 rounded border px-2 py-1.5 text-xs font-bold ${poolFilter === filter.value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'bg-white'}`}>{filter.label}</button>)}</div>}
        {SHOW_CARD_DETAIL_FILTERS && <div className="mt-2 grid grid-cols-3 gap-1">
          <select aria-label="文明" value={civilization} onChange={event => setCivilization(event.target.value)} className="rounded border p-1 text-xs"><option value="">文明</option>{civilizationOptions.map(value => <option key={value}>{value}</option>)}</select>
          <select aria-label="コスト" value={cost} onChange={event => setCost(event.target.value)} className="rounded border p-1 text-xs"><option value="">コスト</option>{costOptions.map(value => <option key={value}>{value}</option>)}</select>
          <select aria-label="種類" value={cardType} onChange={event => setCardType(event.target.value)} className="rounded border p-1 text-xs"><option value="">種類</option>{cardTypeOptions.map(value => <option key={value}>{value}</option>)}</select>
        </div>}
        <div className="mt-3 grid max-h-[70vh] grid-cols-3 gap-2 overflow-auto">
          {visibleCards.map(card => (
            <button type="button" key={card.id} onClick={() => setSelected(card)} aria-label={card.name} className="overflow-hidden rounded border">
              <div className="relative aspect-[63/88]"><CardImage card={card} />{card.badge && <span className={`absolute rounded px-1 py-0.5 text-[9px] font-black shadow ${cardBadgePositionClassName} ${cardBadgeTextClassName} ${card.badge.className}`}>{card.badge.label}</span>}</div>
            </button>
          ))}
        </div>
        {cards.length === 0 && <p className="py-10 text-center text-xs text-gray-400">企画カードは未登録です</p>}
      </aside>

      {selected && (
        <div onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null) }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="tier-card-title" className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5">
            <h3 id="tier-card-title" className="font-black">{selected.name}</h3>
            {selectionImageZoom ? (
              <button type="button" onClick={() => setZoomedCard(selected)} aria-label={`${selected.name}を拡大表示`} className="mx-auto mt-3 block aspect-[63/88] max-h-[45vh] w-40 cursor-zoom-in overflow-hidden rounded border bg-white sm:w-48"><CardImage card={selected} contain /></button>
            ) : (
              <div className="mx-auto mt-3 aspect-[63/88] max-h-[45vh] w-40 overflow-hidden rounded border bg-white sm:w-48"><CardImage card={selected} contain /></div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {groups.map(group => <button type="button" key={group.key} onClick={() => moveCard(selected.id, group.key)} className={`rounded border p-3 font-black ${group.color}`}>{group.label}</button>)}
              {unrated && <button type="button" onClick={() => moveCard(selected.id, null)} className="rounded border p-3 font-bold">未評価へ戻す</button>}
            </div>
            <button type="button" onClick={() => setSelected(null)} className="mt-3 w-full text-sm">閉じる</button>
          </div>
        </div>
      )}

      {showLoginRequired && (
        <div onMouseDown={event => { if (event.target === event.currentTarget) setShowLoginRequired(false) }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="login-required-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="login-required-title" className="text-xl font-black">ログインが必要です</h2>
                <p className="mt-3 text-sm leading-6 text-gray-600">{responseLabel}の回答を登録するにはログインしてください。入力内容は下書きとして保存され、ログイン後に復元されます。</p>
              </div>
              <button type="button" aria-label="閉じる" onClick={() => setShowLoginRequired(false)} className="shrink-0 px-1 text-3xl leading-none text-gray-500">×</button>
            </div>
            <div className="mt-6 space-y-2">
              <button type="button" onClick={goToLogin} className="w-full rounded-xl bg-blue-700 px-4 py-3 font-bold text-white">ログインする</button>
              <button type="button" onClick={() => setShowLoginRequired(false)} className="w-full rounded-xl border px-4 py-3 font-bold">キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {exportPreviewUrl && (
        <div onMouseDown={event => { if (event.target === event.currentTarget) closeExportPreview() }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="export-preview-title" className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h2 id="export-preview-title" className="text-lg font-black">Tier表画像ができました</h2>
              <button type="button" aria-label="閉じる" onClick={closeExportPreview} className="shrink-0 px-1 text-3xl leading-none text-gray-500">×</button>
            </div>
            <p className="mt-2 text-sm leading-6 text-gray-600">画像を長押しして「写真に保存」を選ぶか、下のボタンから保存してください。</p>
            <img src={exportPreviewUrl} alt={exportTitle} className="mt-3 w-full rounded border" />
            <div className="mt-4 space-y-2">
              <a href={exportPreviewUrl} download={exportFilename} className="block w-full rounded-xl bg-blue-700 px-4 py-3 text-center font-bold text-white">画像をダウンロード</a>
              <a href={exportPreviewUrl} target="_blank" rel="noopener noreferrer" className="block w-full rounded-xl border px-4 py-3 text-center font-bold">新しいタブで開く</a>
              <button type="button" onClick={closeExportPreview} className="w-full rounded-xl border px-4 py-3 font-bold">閉じる</button>
            </div>
          </div>
        </div>
      )}

      {zoomedCard && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onMouseDown={event => { if (event.target === event.currentTarget) setZoomedCard(null) }}
        >
          <button type="button" aria-label="拡大画像を閉じる" onClick={() => setZoomedCard(null)} className="absolute right-4 top-4 z-10 rounded-full bg-white/90 px-3 py-1 text-3xl leading-none text-black">×</button>
          {zoomedCard.imageUrl ? (
            <img src={zoomedCard.imageUrl} alt={zoomedCard.name} className="max-h-[92vh] max-w-[94vw] object-contain" />
          ) : (
            <p className="rounded bg-white px-4 py-3 text-sm font-bold">{zoomedCard.name}</p>
          )}
        </div>
      )}

      {toast && (
        <div role="status" className="fixed bottom-4 left-1/2 z-[70] w-max max-w-[92vw] -translate-x-1/2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg">
          {toast}
        </div>
      )}

      {localDraftConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="draft-conflict-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <h2 id="draft-conflict-title" className="text-xl font-black">下書きを復元しますか？</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">この端末の下書きと、登録済みの回答があります。どちらを編集するか選んでください。選択するまで登録済み回答は上書きされません。</p>
            <div className="mt-6 space-y-2">
              <button type="button" onClick={() => { localStorage.setItem(DRAFT_CHOICE_KEY, 'resolved'); setDraft(localDraftConflict); setLocalDraftConflict(null) }} className="w-full rounded-xl bg-blue-700 px-4 py-3 font-bold text-white">端末の下書きを復元</button>
              <button type="button" onClick={() => { localStorage.setItem(DRAFT_CHOICE_KEY, 'resolved'); localStorage.setItem(STORAGE_KEY, JSON.stringify(initialDraft)); setLocalDraftConflict(null) }} className="w-full rounded-xl border px-4 py-3 font-bold">登録済み回答を使う</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
