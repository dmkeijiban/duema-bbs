'use client'

import type { ReactNode } from 'react'
import type { DeckCard } from '@/lib/deck-maker'
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

export function CardDetailModal(props: CardDetailModalProps) {
  const {
    card,
    count,
    maxReached = false,
    onClose,
    onChoose,
    chooseLabel = 'このカードを選ぶ',
    onAdd,
    onRemove,
    onMove,
    renderCardArt,
  } = props

  if (!card) return null

  return <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3" onMouseDown={event => { if (event.currentTarget === event.target) onClose() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="shared-card-dialog-title" className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <button type="button" onClick={onClose} aria-label="カード詳細を閉じる" className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-xl font-bold text-slate-800 shadow">×</button>
      <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
        <h2 id="shared-card-dialog-title" className="mb-3 pr-12 text-center text-base font-black text-slate-900">{card.name}</h2>
        <div className="mx-auto w-full max-w-[min(360px,calc((100dvh-190px)*5/7))]">{renderCardArt(card, true)}</div>
        {onChoose && <button type="button" onClick={() => onChoose(card)} className="mt-3 min-h-11 w-full rounded-xl bg-emerald-700 px-4 font-black text-white">{chooseLabel}</button>}
        {(onAdd || onRemove) && <div className="mt-3 flex items-center justify-center gap-5">
          <button type="button" onClick={() => onRemove?.(card)} disabled={!count} aria-label={`${card.name}を1枚減らす`} className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 text-2xl font-bold disabled:text-slate-300">−</button>
          <div className="min-w-20 text-center"><span className="text-3xl font-black">{count ?? 0}</span></div>
          <button type="button" onClick={() => onAdd?.(card)} disabled={maxReached} aria-label={`${card.name}を1枚増やす`} className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700 text-2xl font-bold text-white disabled:bg-slate-400">＋</button>
        </div>}
        {onMove && Boolean(count) && <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onMove(-1)} className="min-h-10 rounded-lg border border-slate-300 text-sm font-bold text-slate-700">左へ移動</button>
          <button type="button" onClick={() => onMove(1)} className="min-h-10 rounded-lg border border-slate-300 text-sm font-bold text-slate-700">右へ移動</button>
        </div>}
      </div>
    </section>
  </div>
}
