'use client'

import { startTransition, useEffect, useRef, useState, type ReactNode } from 'react'
import { printingKey, type DeckCard } from '@/lib/deck-maker'
import type { CardSearchFilter } from '@/hooks/use-card-catalog-search'

type CardDetailModalProps = {
  card: DeckCard | null
  versions: DeckCard[]
  loading?: boolean
  count?: number
  maxReached?: boolean
  onClose: () => void
  onSelectVersion: (card: DeckCard) => void
  onChoose?: (card: DeckCard) => void
  chooseLabel?: string
  onAdd?: (card: DeckCard) => void
  onRemove?: (card: DeckCard) => void
  onMove?: (offset: -1 | 1) => void
  onAddFilter?: (filter: CardSearchFilter) => void
  renderCardArt: (card: DeckCard, full?: boolean) => ReactNode
}

export function CardDetailModal({
  card,
  versions,
  loading = false,
  count,
  maxReached = false,
  onClose,
  onSelectVersion,
  onChoose,
  chooseLabel = 'このカードを選ぶ',
  onAdd,
  onRemove,
  renderCardArt,
}: CardDetailModalProps) {
  const [visibleCount, setVisibleCount] = useState(count ?? 0)
  const pendingDelta = useRef(0)
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function flushPending() {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current)
      flushTimer.current = null
    }
    const delta = pendingDelta.current
    pendingDelta.current = 0
    if (!delta || !card) return
    const activeCard = card
    startTransition(() => {
      if (delta > 0) {
        for (let index = 0; index < delta; index += 1) onAdd?.(activeCard)
      } else {
        for (let index = 0; index < Math.abs(delta); index += 1) onRemove?.(activeCard)
      }
    })
  }

  function scheduleFlush() {
    if (flushTimer.current) clearTimeout(flushTimer.current)
    flushTimer.current = setTimeout(flushPending, 120)
  }

  useEffect(() => {
    pendingDelta.current = 0
    if (flushTimer.current) clearTimeout(flushTimer.current)
    flushTimer.current = null
    setVisibleCount(count ?? 0)
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current)
    }
  }, [card, count])

  if (!card) return null

  const canRemove = visibleCount > 0
  const canAdd = !maxReached && visibleCount < 4

  function removeOne() {
    if (!canRemove) return
    setVisibleCount(current => Math.max(0, current - 1))
    pendingDelta.current -= 1
    scheduleFlush()
  }

  function addOne() {
    if (!canAdd) return
    setVisibleCount(current => Math.min(4, current + 1))
    pendingDelta.current += 1
    scheduleFlush()
  }

  function closeModal() {
    flushPending()
    onClose()
  }

  return <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3" onMouseDown={event => { if (event.currentTarget === event.target) closeModal() }}>
    <section role="dialog" aria-modal="true" aria-label={`${card.name}のカード操作`} className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <button type="button" onClick={closeModal} aria-label="カード操作を閉じる" className="absolute right-2 top-2 z-10 flex h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-white/95 text-xl font-bold text-slate-800 shadow active:scale-95">×</button>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <h2 className="sr-only">{card.name}</h2>
        <div className="mx-auto w-full max-w-[330px]">{renderCardArt(card, true)}</div>

        {(onAdd || onRemove) && <div className="mt-3 flex items-center justify-center gap-5">
          <button type="button" onPointerDown={event => event.preventDefault()} onClick={removeOne} disabled={!canRemove} aria-label={`${card.name}を1枚減らす`} className="flex h-14 w-14 touch-manipulation select-none items-center justify-center rounded-xl border border-slate-300 text-3xl font-bold transition-transform active:scale-90 disabled:text-slate-300 disabled:active:scale-100">−</button>
          <div className="min-w-20 text-center" aria-live="polite"><span className="text-3xl font-black tabular-nums">{visibleCount}</span></div>
          <button type="button" onPointerDown={event => event.preventDefault()} onClick={addOne} disabled={!canAdd} aria-label={`${card.name}を1枚増やす`} className="flex h-14 w-14 touch-manipulation select-none items-center justify-center rounded-xl bg-emerald-700 text-3xl font-bold text-white transition-transform active:scale-90 disabled:bg-slate-400 disabled:active:scale-100">＋</button>
        </div>}

        {onChoose && <button type="button" onClick={() => onChoose(card)} className="mt-3 min-h-11 w-full rounded-xl bg-emerald-700 px-4 font-black text-white">{chooseLabel}</button>}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-4 pb-3 pt-3 sm:px-5">
        {loading && <p className="mb-2 text-center text-xs font-bold text-slate-500">別イラストを読み込み中…</p>}
        <div className="flex gap-3 overflow-x-auto overscroll-x-contain pb-2">
          {versions.map(version => {
            const active = printingKey(version) === printingKey(card)
            return <button key={printingKey(version)} type="button" onClick={() => { flushPending(); onSelectVersion(version) }} aria-pressed={active} className={`w-24 shrink-0 touch-manipulation overflow-hidden rounded-lg transition ${active ? 'ring-2 ring-blue-600' : 'opacity-55 ring-1 ring-slate-300 hover:opacity-100'}`}>
              {renderCardArt(version)}
            </button>
          })}
        </div>
      </div>
    </section>
  </div>
}
