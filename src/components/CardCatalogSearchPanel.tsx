'use client'

import type { ReactNode, RefObject } from 'react'
import type { DeckCard } from '@/lib/deck-maker'
import { CardCatalogGrid } from '@/components/CardCatalogGrid'
import { CARD_SEARCH_SORT_OPTIONS, type CardSearchFilter, type CardSearchSort } from '@/hooks/use-card-catalog-search'

export function CardCatalogSearchPanel({
  cards,
  query,
  loading,
  hasMore,
  onLoadMore,
  onSelect,
  onQueryChange,
  onClear,
  selectedCount,
  selectedBadge,
  renderCardArt,
  clearIcon = '×',
  filterIcon = '☷',
  inputRef,
  filters = [],
  onRemoveFilter,
  onClearFilters,
  sort,
  onSortChange,
}: {
  cards: DeckCard[]
  query: string
  loading: boolean
  hasMore: boolean
  onLoadMore: () => void
  onSelect: (card: DeckCard) => void
  onQueryChange: (query: string) => void
  onClear?: () => void
  selectedCount?: (card: DeckCard) => number
  selectedBadge?: (count: number, card: DeckCard) => string
  renderCardArt?: (card: DeckCard, index: number) => ReactNode
  clearIcon?: ReactNode
  filterIcon?: ReactNode
  inputRef?: RefObject<HTMLInputElement | null>
  filters?: CardSearchFilter[]
  onRemoveFilter?: (filter: CardSearchFilter) => void
  onClearFilters?: () => void
  sort?: CardSearchSort
  onSortChange?: (sort: CardSearchSort) => void
}) {
  return (
    <section aria-labelledby="card-catalog-search-heading" className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-3">
      <div className="sticky top-0 z-20 rounded-t-2xl border-b border-slate-200 bg-white/95 p-2.5 backdrop-blur sm:p-3">
        <h2 id="card-catalog-search-heading" className="sr-only">カード検索</h2>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true">⌕</span>
            <input
              ref={inputRef}
              id="card-search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="カード名で検索"
              aria-label="カード名検索"
              className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-10 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
            {query && (
              <button type="button" onClick={onClear ?? (() => onQueryChange(''))} aria-label="検索文字をクリア" className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-slate-500">
                {clearIcon}
              </button>
            )}
          </div>
          <button type="button" aria-label="絞り込み（準備中）" title="絞り込みは今後対応予定" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-500">
            {filterIcon}
          </button>
        </div>
        {filters.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {filters.map(filter => <button key={`${filter.kind}:${filter.value}`} type="button" onClick={() => onRemoveFilter?.(filter)} className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800" aria-label={`${filter.value}を解除`}>{filter.value} ×</button>)}
          <button type="button" onClick={onClearFilters} className="px-2 py-1 text-xs font-bold text-slate-600">すべて解除</button>
        </div>}
        {onSortChange && <div className="mt-2 flex items-center gap-1.5">
          <label htmlFor="card-search-sort" className="text-xs font-bold text-slate-500">並び替え</label>
          <select id="card-search-sort" value={sort ?? 'relevance'} onChange={(event) => onSortChange(event.target.value as CardSearchSort)} className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-700">
            {CARD_SEARCH_SORT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>}
      </div>
      <CardCatalogGrid
        cards={cards}
        query={query}
        loading={loading}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
        onSelect={onSelect}
        selectedCount={selectedCount}
        selectedBadge={selectedBadge}
        renderCardArt={renderCardArt}
      />
    </section>
  )
}
