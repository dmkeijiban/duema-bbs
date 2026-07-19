'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { DeckCard } from '@/lib/deck-maker'
import { cardLogicalKey } from '@/lib/card-catalog-shared'

const INITIAL_SKELETON_COUNT = 20

export function CardCatalogGrid({ cards, query, loading, hasMore, onLoadMore, onSelect, selectedCount, selectedBadge, renderCardArt }: {
  cards: DeckCard[]
  query: string
  loading: boolean
  hasMore: boolean
  onLoadMore: () => void
  onSelect: (card: DeckCard) => void
  selectedCount?: (card: DeckCard) => number
  selectedBadge?: (count: number) => string
  renderCardArt?: (card: DeckCard, index: number) => ReactNode
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0
  }, [query])

  useEffect(() => {
    if (!sentinel.current || !hasMore || loading) return
    const observer = new IntersectionObserver(entries => { if (entries[0]?.isIntersecting) onLoadMore() }, { root: scroller.current, rootMargin: '800px 0px' })
    observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [hasMore, loading, onLoadMore])

  return <div ref={scroller} data-testid="search-results" className="grid h-[65dvh] min-h-[360px] max-h-[680px] auto-rows-max content-start grid-cols-4 gap-1.5 overflow-y-auto overscroll-contain p-2.5 sm:gap-2 sm:p-3 lg:h-[calc(100dvh-170px)] lg:max-h-none">
    {loading && cards.length === 0 && Array.from({ length: INITIAL_SKELETON_COUNT }, (_, index) => (
      <div key={index} aria-hidden="true" className="aspect-[5/7] animate-pulse rounded-md bg-slate-200 ring-1 ring-slate-200" />
    ))}
    {!loading && cards.length === 0 && <p className="col-span-4 py-8 text-center text-sm text-slate-500">該当カードがありません</p>}
    {cards.map((card, index) => {
      const count = selectedCount?.(card) ?? 0
      return <article key={cardLogicalKey(card)} className="group relative min-w-0 overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200 [content-visibility:auto] [contain-intrinsic-size:auto_210px]">
        <button type="button" onClick={() => onSelect(card)} aria-label={`${card.name}を選択`} className="block w-full">
          {renderCardArt ? renderCardArt(card, index) : <div className="relative aspect-[5/7] overflow-hidden bg-slate-800">
            {card.imageUrl ? <img src={card.imageUrl} alt={card.name} className="h-full w-full object-contain" loading={index < 4 ? 'eager' : 'lazy'} fetchPriority={index < 4 ? 'high' : 'auto'} decoding="async" /> : <div className="flex h-full items-center justify-center p-1 text-center text-[8px] font-bold text-white sm:text-xs">{card.name}</div>}
          </div>}
          {card.matchedFace && <span className="block min-h-8 px-1 py-1 text-left text-[10px] font-bold leading-tight text-slate-800">{card.matchedFace.name}</span>}
        </button>
        {count > 0 && <span className="absolute left-1 top-1 rounded-full bg-black/80 px-1.5 py-0.5 text-[10px] font-black text-white">{selectedBadge ? selectedBadge(count) : count}</span>}
      </article>
    })}
    <div ref={sentinel} aria-hidden="true" className="col-span-4 h-px" />
    {loading && cards.length > 0 && !query.trim() && <p className="col-span-4 py-2 text-center text-xs text-slate-500">カードを読み込み中…</p>}
  </div>
}
