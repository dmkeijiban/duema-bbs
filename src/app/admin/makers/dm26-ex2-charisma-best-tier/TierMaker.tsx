'use client'

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { emptyMakerDraft, type MakerCard, type MakerDraft, type MakerGroup } from '@/lib/maker'
import { saveTierSubmission } from './actions'

const STORAGE_KEY = 'maker-draft:dm26-ex2-charisma-best-tier:v1'
const EXPORT_TITLE = 'DM26-EX2 悪感謝祭 カリスマBEST Tier表'
const SHOW_CARD_DETAIL_FILTERS = false

export type TierAggregate = {
  cardId: string
  counts: Record<string, number>
  ratingCount: number
  averageTier: number | null
}

type TierMakerProps = {
  cards: MakerCard[]
  groups: MakerGroup[]
  initialDraft: MakerDraft
  unrated: boolean
  canSave: boolean
  aggregates: TierAggregate[]
  imageProxyPath?: string
  saveAction?: (payload: Record<string, string[]>) => Promise<{ ok: boolean; message: string }>
  saveButtonLabel?: string
  hasSavedSubmission?: boolean
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
  image.src = `${imageProxyPath}?url=${encodeURIComponent(url)}`
  await image.decode()
  return image
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function TierMaker({ cards, groups, initialDraft, unrated, canSave, aggregates, imageProxyPath = '/api/admin/makers/dm26-ex2-card-image', saveAction = saveTierSubmission, saveButtonLabel, hasSavedSubmission = false }: TierMakerProps) {
  const [draft, setDraft] = useState(initialDraft)
  const [selected, setSelected] = useState<MakerCard | null>(null)
  const [query, setQuery] = useState('')
  const [civilization, setCivilization] = useState('')
  const [cost, setCost] = useState('')
  const [cardType, setCardType] = useState('')
  const [message, setMessage] = useState('')
  const [showCommunity, setShowCommunity] = useState(false)
  const [showLoginRequired, setShowLoginRequired] = useState(false)
  const [localDraftConflict, setLocalDraftConflict] = useState<MakerDraft | null>(null)
  const [isSavingImage, setIsSavingImage] = useState(false)
  const [isSharingToX, setIsSharingToX] = useState(false)
  const [pending, startTransition] = useTransition()
  const skipFirstDraftPersist = useRef(true)
  const exportImageCache = useRef(new Map<string, Promise<HTMLImageElement>>())
  const pngCache = useRef<{ key: string; blob: Blob } | null>(null)
  const pngGeneration = useRef<{ key: string; promise: Promise<Blob> } | null>(null)

  const cardsById = useMemo(() => new Map(cards.map(card => [card.id, card])), [cards])
  const validCardIds = useMemo(() => new Set(cards.map(card => card.id)), [cards])
  const usedCardIds = useMemo(() => new Set(Object.values(draft).flat()), [draft])
  const draftKey = useMemo(() => JSON.stringify(draft), [draft])
  const latestDraftKey = useRef(draftKey)
  latestDraftKey.current = draftKey
  const aggregateByCard = useMemo(() => new Map(aggregates.map(row => [row.cardId, row])), [aggregates])
  const communityCards = useMemo(
    () => cards
      .filter(card => aggregateByCard.has(card.id))
      .sort((a, b) => (aggregateByCard.get(b.id)?.averageTier ?? 0) - (aggregateByCard.get(a.id)?.averageTier ?? 0)),
    [cards, aggregateByCard],
  )

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return

    try {
      const restored = restoreDraft(JSON.parse(stored), groups, validCardIds)
      if (restored) {
        if (hasSavedSubmission) setLocalDraftConflict(restored)
        else queueMicrotask(() => setDraft(restored))
      }
    } catch (error) {
      console.warn('Tier表の下書きを復元できませんでした', error)
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [groups, hasSavedSubmission, validCardIds])

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
  }, [draft])

  useEffect(() => {
    if (pngCache.current?.key !== draftKey) pngCache.current = null
    if (pngGeneration.current?.key !== draftKey) pngGeneration.current = null
  }, [draftKey])

  useEffect(() => {
    if (!selected && !showLoginRequired) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setSelected(null)
      setShowLoginRequired(false)
    }

    addEventListener('keydown', onKeyDown)
    return () => removeEventListener('keydown', onKeyDown)
  }, [selected, showLoginRequired])

  const visibleCards = cards.filter(card => {
    if (usedCardIds.has(card.id)) return false
    if (query && !card.name.toLowerCase().includes(query.toLowerCase())) return false
    if (civilization && !card.civilization.includes(civilization)) return false
    if (cost && card.cost !== Number(cost)) return false
    if (cardType && card.cardType !== cardType) return false
    return true
  })

  const civilizationOptions = [...new Set(cards.flatMap(card => card.civilization))]
  const costOptions = [...new Set(cards.map(card => card.cost).filter((value): value is number => value !== null))].sort((a, b) => a - b)
  const cardTypeOptions = [...new Set(cards.map(card => card.cardType).filter((value): value is string => Boolean(value)))]

  function moveCard(cardId: string, groupKey: string | null) {
    setDraft(current => {
      const next = Object.fromEntries(
        Object.entries(current).map(([key, ids]) => [key, ids.filter(id => id !== cardId)]),
      ) as MakerDraft
      if (groupKey && next[groupKey]) next[groupKey] = [...next[groupKey], cardId]
      return next
    })
    setSelected(null)
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
        const result = await saveAction(draft)
        setMessage(result.message)
      } catch (error) {
        console.error('Tier表の保存に失敗しました', error)
        setMessage('保存に失敗しました。時間をおいて再度お試しください。')
      }
    })
  }

  function goToLogin() {
    const next = `${location.pathname}${location.search}`
    location.assign(`/login?next=${encodeURIComponent(next)}`)
  }

  async function createTierPng(): Promise<Blob> {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable')

    const left = 30
    const totalWidth = 1140
    const labelWidth = 105
    const horizontalPadding = 12
    const gap = 6
    const top = 120
    const bottomPadding = 28
    const palette: Record<string, { background: string; border: string; label: string }> = {
      s: { background: '#fff1f2', border: '#fca5a5', label: '#be123c' },
      a: { background: '#fff7ed', border: '#fdba74', label: '#c2410c' },
      b: { background: '#fffbeb', border: '#fcd34d', label: '#a16207' },
      c: { background: '#ecfdf5', border: '#6ee7b7', label: '#047857' },
      d: { background: '#eff6ff', border: '#93c5fd', label: '#1d4ed8' },
    }

    const rowLayouts = groups.map(group => {
      const ids = draft[group.key] ?? []
      const availableWidth = totalWidth - labelWidth - horizontalPadding * 2
      const cardWidth = ids.length
        ? Math.max(24, Math.min(92, Math.floor((availableWidth - gap * Math.max(0, ids.length - 1)) / ids.length)))
        : 0
      const cardHeight = cardWidth * 88 / 63
      const rowHeight = ids.length ? Math.ceil(cardHeight + 20) : 76
      return { group, ids, cardWidth, cardHeight, rowHeight }
    })

    canvas.height = top + rowLayouts.reduce((sum, row) => sum + row.rowHeight + 5, 0) + bottomPadding
    context.fillStyle = '#f8fafc'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#0f172a'
    context.font = 'bold 38px sans-serif'
    context.fillText(EXPORT_TITLE, 40, 58)
    context.font = '20px sans-serif'
    context.fillStyle = '#475569'
    context.fillText('デュエマ掲示板  www.duema-bbs.com', 40, 92)

    let y = top

    for (const row of rowLayouts) {
      const colors = palette[row.group.key.toLowerCase()] ?? {
        background: '#f8fafc',
        border: '#cbd5e1',
        label: '#111827',
      }
      context.fillStyle = colors.background
      context.fillRect(left, y, totalWidth, row.rowHeight)
      context.strokeStyle = colors.border
      context.lineWidth = 1.5
      context.strokeRect(left, y, totalWidth, row.rowHeight)
      context.fillStyle = colors.label
      context.font = 'bold 42px sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(row.group.label, left + labelWidth / 2, y + row.rowHeight / 2)

      let x = left + labelWidth + horizontalPadding
      const cardY = y + Math.max(8, (row.rowHeight - row.cardHeight) / 2)

      for (const cardId of row.ids) {
        const card = cardsById.get(cardId)
        if (!card) continue

        if (card.imageUrl) {
          try {
            let imagePromise = exportImageCache.current.get(card.imageUrl)
            if (!imagePromise) {
              imagePromise = loadExportImage(card.imageUrl, imageProxyPath)
              exportImageCache.current.set(card.imageUrl, imagePromise)
            }
            const image = await imagePromise.catch(error => {
              exportImageCache.current.delete(card.imageUrl as string)
              throw error
            })
            context.drawImage(image, x, cardY, row.cardWidth, row.cardHeight)
          } catch {
            context.fillStyle = '#e2e8f0'
            context.fillRect(x, cardY, row.cardWidth, row.cardHeight)
          }
        }

        x += row.cardWidth + gap
      }

      y += row.rowHeight + 5
    }

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG generation failed')), 'image/png')
    })
  }

  function getTierPng(): Promise<Blob> {
    const key = draftKey
    if (pngCache.current?.key === key) return Promise.resolve(pngCache.current.blob)
    if (pngGeneration.current?.key === key) return pngGeneration.current.promise

    const promise = createTierPng().then(blob => {
      if (latestDraftKey.current === key) pngCache.current = { key, blob }
      return blob
    }).finally(() => {
      if (pngGeneration.current?.key === key) pngGeneration.current = null
    })
    pngGeneration.current = { key, promise }
    return promise
  }

  async function saveImage() {
    if (isSavingImage) return
    setIsSavingImage(true)
    setMessage('')
    try {
      const blob = await getTierPng()
      downloadBlob(blob, 'dm26-ex2-tier.png')
      setMessage('Tier表画像を保存しました。')
    } catch (error) {
      console.error('Tier表画像の生成に失敗しました', error)
      setMessage('画像を生成できませんでした。時間をおいて再度お試しください。')
    } finally {
      setIsSavingImage(false)
    }
  }

  async function shareToX() {
    if (isSharingToX) return
    const popup = window.open('about:blank', '_blank')
    if (!popup) {
      setMessage('Xの投稿画面を開けませんでした。ブラウザのポップアップ設定を確認してください。')
      return
    }
    popup.opener = null
    setIsSharingToX(true)
    setMessage('')

    try {
      const blob = await getTierPng()
      const text = 'DM26-EX2 悪感謝祭 カリスマBESTのTier表を作りました！\n#デュエマ'
      downloadBlob(blob, 'dm26-ex2-tier.png')
      popup.location.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.href)}`
      setMessage('画像を保存しました。開いたXの投稿画面に画像を添付してください。')
    } catch (error) {
      console.error('X共有に失敗しました', error)
      popup.close()
      setMessage('画像を生成できませんでした。時間をおいて再度お試しください。')
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
              className={`grid grid-cols-[52px_1fr] rounded-xl border transition-[min-height] ${isEmpty ? 'min-h-[72px]' : 'min-h-28'} ${group.color}`}
            >
              <div className="flex items-center justify-center text-2xl font-black">{group.label}</div>
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
                        <div className="aspect-[63/88]"><CardImage card={card} /></div>
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

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { if (confirm('全てリセットしますか？')) setDraft(emptyMakerDraft(groups)) }}
            className="rounded border bg-white px-3 py-2 text-sm font-bold"
          >
            リセット
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? '保存中...' : saveButtonLabel ?? '登録'}
          </button>
          <button type="button" disabled={isSavingImage} onClick={saveImage} className="min-w-[112px] rounded border border-blue-600 bg-white px-4 py-2 text-sm font-bold text-blue-700 disabled:opacity-50">{isSavingImage ? '画像生成中...' : '画像保存'}</button>
          <button type="button" disabled={isSharingToX} onClick={shareToX} className="min-w-[112px] rounded bg-black px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{isSharingToX ? '共有準備中...' : 'Xで共有'}</button>
          <button type="button" onClick={() => setShowCommunity(value => !value)} className="rounded border bg-white px-4 py-2 text-sm font-bold">📊 みんなのTierを見る</button>
          {message && <span className="self-center text-sm">{message}</span>}
        </div>

        {showCommunity && (
          <section className="rounded-xl border bg-white p-4">
            <h2 className="text-lg font-black">みんなのTier</h2>
            <p className="mt-1 text-xs text-gray-500">カードごとの回答割合です。</p>
            {communityCards.length === 0 ? (
              <p className="mt-4 rounded bg-slate-50 p-4 text-sm text-gray-500">まだ集計できる回答がありません。</p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {communityCards.map(card => {
                  const aggregate = aggregateByCard.get(card.id)
                  if (!aggregate) return null

                  return (
                    <article key={card.id} className="flex gap-3 rounded border p-3">
                      <div className="h-28 w-20 shrink-0 overflow-hidden rounded border bg-slate-100"><CardImage card={card} contain /></div>
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-sm font-bold">{card.name}</h3>
                        <p className="mt-1 text-xs text-gray-500">回答 {aggregate.ratingCount}人 / 平均 {aggregate.averageTier?.toFixed(2) ?? '-'}</p>
                        <div className="mt-2 space-y-1">
                          {groups.map(group => {
                            const count = aggregate.counts[group.key] ?? 0
                            const percent = aggregate.ratingCount ? Math.round(count / aggregate.ratingCount * 100) : 0
                            return (
                              <div key={group.key} className="grid grid-cols-[24px_1fr_38px] items-center gap-1 text-[11px]">
                                <b>{group.label}</b>
                                <div className="h-2 overflow-hidden rounded bg-slate-100"><div className="h-full bg-slate-700" style={{ width: `${percent}%` }} /></div>
                                <span className="text-right tabular-nums">{percent}%</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        )}
      </section>

      <aside className="h-fit rounded-xl border bg-white p-3 lg:sticky lg:top-3">
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="カード名検索" className="w-full rounded border p-2 text-sm" />
        {SHOW_CARD_DETAIL_FILTERS && <div className="mt-2 grid grid-cols-3 gap-1">
          <select aria-label="文明" value={civilization} onChange={event => setCivilization(event.target.value)} className="rounded border p-1 text-xs"><option value="">文明</option>{civilizationOptions.map(value => <option key={value}>{value}</option>)}</select>
          <select aria-label="コスト" value={cost} onChange={event => setCost(event.target.value)} className="rounded border p-1 text-xs"><option value="">コスト</option>{costOptions.map(value => <option key={value}>{value}</option>)}</select>
          <select aria-label="種類" value={cardType} onChange={event => setCardType(event.target.value)} className="rounded border p-1 text-xs"><option value="">種類</option>{cardTypeOptions.map(value => <option key={value}>{value}</option>)}</select>
        </div>}
        <div className="mt-3 grid max-h-[70vh] grid-cols-3 gap-2 overflow-auto">
          {visibleCards.map(card => (
            <button type="button" key={card.id} onClick={() => setSelected(card)} aria-label={card.name} className="overflow-hidden rounded border">
              <div className="aspect-[63/88]"><CardImage card={card} /></div>
            </button>
          ))}
        </div>
        {cards.length === 0 && <p className="py-10 text-center text-xs text-gray-400">企画カードは未登録です</p>}
      </aside>

      {selected && (
        <div onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null) }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="tier-card-title" className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5">
            <h3 id="tier-card-title" className="font-black">{selected.name}</h3>
            <div className="mx-auto mt-3 aspect-[63/88] max-h-[45vh] w-40 overflow-hidden rounded border bg-white sm:w-48"><CardImage card={selected} contain /></div>
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
                <p className="mt-3 text-sm leading-6 text-gray-600">Tier表の回答を登録するにはログインしてください。入力内容は下書きとして保存され、ログイン後に復元されます。</p>
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

      {localDraftConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="draft-conflict-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <h2 id="draft-conflict-title" className="text-xl font-black">下書きを復元しますか？</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">この端末の下書きと、登録済みの回答があります。どちらを編集するか選んでください。選択するまで登録済み回答は上書きされません。</p>
            <div className="mt-6 space-y-2">
              <button type="button" onClick={() => { setDraft(localDraftConflict); setLocalDraftConflict(null) }} className="w-full rounded-xl bg-blue-700 px-4 py-3 font-bold text-white">端末の下書きを復元</button>
              <button type="button" onClick={() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(initialDraft)); setLocalDraftConflict(null) }} className="w-full rounded-xl border px-4 py-3 font-bold">登録済み回答を使う</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
