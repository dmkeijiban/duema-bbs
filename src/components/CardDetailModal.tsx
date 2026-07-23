'use client'

import type { ReactNode } from 'react'
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
  if (!card) return null

  const displayCount = count ?? 0
  const canRemove = displayCount > 0
  const canAdd = !maxReached && displayCount < 4

  function removeOne() {
    if (!canRemove || !card) return
    onRemove?.(card)
  }

  function addOne() {
    if (!canAdd || !card) return
    onAdd?.(card)
  }

  return <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-3" onMouseDown={event => { if (event.currentTarget === event.target) onClose() }}>
    <section role="dialog" aria-modal="true" aria-label={`${card.name}のカード操作`} className="relative flex h-[calc(100dvh-16px)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-24px)]">
      <button type="button" onClick={onClose} aria-label="カード操作を閉じる" className="absolute right-2 top-2 z-10 flex h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-white/95 text-xl font-bold text-slate-800 shadow active:scale-95">×</button>
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-hidden px-3 pb-2 pt-3 sm:px-5 sm:pt-4">
        <h2 className="sr-only">{card.name}</h2>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="w-[min(330px,calc((100dvh-330px)*5/7))] max-w-full">{renderCardArt(card, true)}</div>
        </div>

        {(onAdd || onRemove) && <div className="relative z-[1] mt-2 flex shrink-0 items-center justify-center gap-5 bg-white">
          <button type="button" data-disable-interaction-feedback="true" onPointerDown={event => event.preventDefault()} onClick={removeOne} disabled={!canRemove} aria-label={`${card.name}を1枚減らす`} className="flex h-14 w-14 touch-manipulation select-none items-center justify-center rounded-xl border border-slate-300 text-3xl font-bold transition-transform active:scale-90 disabled:text-slate-300 disabled:active:scale-100">−</button>
          <div className="min-w-20 text-center" aria-live="polite"><span className="text-3xl font-black tabular-nums">{displayCount}</span></div>
          <button type="button" data-disable-interaction-feedback="true" onPointerDown={event => event.preventDefault()} onClick={addOne} disabled={!canAdd} aria-label={`${card.name}を1枚増やす`} className="flex h-14 w-14 touch-manipulation select-none items-center justify-center rounded-xl bg-emerald-700 text-3xl font-bold text-white transition-transform active:scale-90 disabled:bg-slate-400 disabled:active:scale-100">＋</button>
        </div>}

        {onChoose && <button type="button" onClick={() => onChoose(card)} className="mt-2 min-h-10 w-full shrink-0 rounded-xl bg-emerald-700 px-4 font-black text-white">{chooseLabel}</button>}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-3 pb-2 pt-2 sm:px-5 sm:pb-3">
        {loading && <p className="mb-1 text-center text-xs font-bold text-slate-500">別イラストを読み込み中…</p>}
        <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1">
          {versions.map(version => {
            const active = printingKey(version) === printingKey(card)
            return <button key={printingKey(version)} type="button" onClick={() => onSelectVersion(version)} aria-pressed={active} className={`w-20 shrink-0 touch-manipulation overflow-hidden rounded-lg transition sm:w-24 ${active ? 'ring-2 ring-blue-600' : 'opacity-55 ring-1 ring-slate-300 hover:opacity-100'}`}>
              {renderCardArt(version)}
            </button>
          })}
        </div>
      </div>
    </section>
  </div>
}
