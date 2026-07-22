'use client'

import { useEffect, useState, type ReactNode } from 'react'
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

export function CardDetailModal(props: CardDetailModalProps) {
  const {
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
  } = props
  const [visibleCount, setVisibleCount] = useState(count ?? 0)

  useEffect(() => {
    setVisibleCount(count ?? 0)
  }, [card, count])

  if (!card) return null

  const canRemove = visibleCount > 0
  const canAdd = !maxReached

  function removeOne() {
    if (!canRemove) return
    setVisibleCount(current => Math.max(0, current - 1))
    onRemove?.(card!)
  }

  function addOne() {
    if (!canAdd) return
    setVisibleCount(current => current + 1)
    onAdd?.(card!)
  }

  return <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3" onMouseDown={event => { if (event.currentTarget === event.target) onClose() }}>
    <section role="dialog" aria-modal="true" aria-label={`${card.name}のカード操作`} className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <button type="button" onClick={onClose} aria-label="カード詳細を閉じる" className="absolute right-2 top-2 z-20 flex h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-white/95 text-xl font-bold text-slate-800 shadow active:scale-95">×</button>
      <div className="min-h-0 overflow-y-auto p-4 pt-5 sm:p-5">
        <h2 className="mb-3 pr-12 text-center text-base font-black text-slate-900">{card.name}</h2>
        <div className="mx-auto w-full max-w-[min(360px,calc((100dvh-260px)*5/7))]">{renderCardArt(card, true)}</div>

        {(loading || versions.length > 1) && <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-black text-slate-800">収録バージョン</p>
            <p className="text-xs font-bold text-slate-500">{loading ? '読み込み中…' : `${versions.length}種類`}</p>
          </div>
          {loading && versions.length <= 1 ? <div className="flex gap-2 overflow-hidden" aria-label="収録バージョンを読み込み中">
            {[0, 1, 2, 3].map(index => <div key={index} className="aspect-[5/7] w-[72px] shrink-0 animate-pulse rounded-lg bg-slate-200" />)}
          </div> : <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {versions.map(version => {
              const selected = printingKey(version) === printingKey(card)
              return <button
                key={printingKey(version)}
                type="button"
                onClick={() => onSelectVersion(version)}
                aria-label={`${version.name}の別バージョンを選択`}
                aria-pressed={selected}
                className={`touch-manipulation overflow-hidden rounded-lg border-2 bg-slate-100 p-0.5 outline-none active:scale-95 ${selected ? 'border-emerald-600 ring-2 ring-emerald-100' : 'border-transparent hover:border-slate-300'}`}
              >
                {renderCardArt(version)}
              </button>
            })}
          </div>}
        </div>}

        {onChoose && <button type="button" onClick={() => onChoose(card)} className="mt-3 min-h-11 w-full touch-manipulation rounded-xl bg-emerald-700 px-4 font-black text-white active:scale-[0.99]">{chooseLabel}</button>}
        {(onAdd || onRemove) && <div className="mt-4 flex items-center justify-center gap-5">
          <button type="button" onClick={removeOne} disabled={!canRemove} aria-label={`${card.name}を1枚減らす`} className="flex h-14 w-14 touch-manipulation items-center justify-center rounded-xl border border-slate-300 text-3xl font-bold transition-transform active:scale-90 disabled:text-slate-300 disabled:active:scale-100">−</button>
          <div className="min-w-20 text-center" aria-live="polite"><span className="text-3xl font-black tabular-nums">{visibleCount}</span></div>
          <button type="button" onClick={addOne} disabled={!canAdd} aria-label={`${card.name}を1枚増やす`} className="flex h-14 w-14 touch-manipulation items-center justify-center rounded-xl bg-emerald-700 text-3xl font-bold text-white transition-transform active:scale-90 disabled:bg-slate-400 disabled:active:scale-100">＋</button>
        </div>}
      </div>
    </section>
  </div>
}
