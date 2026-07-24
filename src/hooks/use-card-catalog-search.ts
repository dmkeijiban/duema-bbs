'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DeckCard } from '@/lib/deck-maker'
import { CARD_CATALOG_CACHE_VERSION, dedupeLogicalCards } from '@/lib/card-catalog-shared'

export const CARD_SEARCH_PAGE_SIZE = 48
export type CardSearchFilter = { kind: 'civilization' | 'race' | 'cardType' | 'setName'; value: string }
export type CardSearchSort = 'relevance' | 'usage_desc' | 'kana_asc' | 'kana_desc' | 'cost_asc' | 'cost_desc'
export const CARD_SEARCH_SORT_OPTIONS: { value: CardSearchSort; label: string }[] = [
  { value: 'relevance', label: '関連度順' },
  { value: 'usage_desc', label: '採用枚数順' },
  { value: 'kana_asc', label: '50音順（昇順）' },
  { value: 'kana_desc', label: '50音順（降順）' },
  { value: 'cost_asc', label: 'コスト順（昇順）' },
  { value: 'cost_desc', label: 'コスト順（降順）' },
]

type SearchResponse = {
  cards: DeckCard[]
  total: number
  hasMore: boolean
  nextOffset: number
}

export function useCardCatalogSearch({ makerSlug }: { makerSlug?: string } = {}) {
  const [query, setQueryState] = useState('')
  const [cards, setCards] = useState<DeckCard[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<CardSearchFilter[]>([])
  const [sort, setSort] = useState<CardSearchSort>('relevance')
  const requestId = useRef(0)
  const abort = useRef<AbortController | null>(null)
  const cache = useRef(new Map<string, SearchResponse>())

  const filterKey = filters.map(filter => `${filter.kind}:${filter.value}`).sort().join('|')
  const cacheKey = `${CARD_CATALOG_CACHE_VERSION}:${makerSlug ?? ''}:${query.trim()}:${filterKey}:${sort}`

  const addFilter = useCallback((filter: CardSearchFilter) => {
    setFilters(current => current.some(item => item.kind === filter.kind && item.value === filter.value) ? current : [...current, filter])
  }, [])
  const removeFilter = useCallback((filter: CardSearchFilter) => setFilters(current => current.filter(item => item.kind !== filter.kind || item.value !== filter.value)), [])
  const clearFilters = useCallback(() => setFilters([]), [])

  const applyFilters = useCallback((params: URLSearchParams) => {
    for (const filter of filters) params.append(filter.kind, filter.value)
  }, [filters])

  const setQuery = useCallback((value: string) => {
    requestId.current += 1
    abort.current?.abort()
    setHasMore(false)
    setNextOffset(0)
    setQueryState(value)
  }, [])

  useEffect(() => {
    const id = ++requestId.current
    const cached = cache.current.get(cacheKey)
    abort.current?.abort()
    if (cached) {
      setCards(cached.cards); setHasMore(cached.hasMore); setNextOffset(cached.nextOffset); setLoading(false)
      return
    }
    setHasMore(false); setNextOffset(0)
    const timer = window.setTimeout(() => {
      const controller = new AbortController()
      abort.current = controller
      setLoading(true)
      const params = new URLSearchParams({ q: query.trim(), offset: '0', limit: String(CARD_SEARCH_PAGE_SIZE) })
      params.set('order', CARD_CATALOG_CACHE_VERSION)
      params.set('sort', sort)
      if (makerSlug) params.set('makerSlug', makerSlug)
      applyFilters(params)
      // The fast-initial path has its own fixed usage-count fallback ordering; skip
      // it once the user picks an explicit sort so that choice is respected.
      if (!query.trim() && sort === 'relevance') params.set('fastInitial', '1')
      fetch(`/api/cards/search?${params}`, { signal: controller.signal })
        .then(response => response.ok ? response.json() : Promise.reject(new Error('search_failed')))
        .then(data => {
          if (id !== requestId.current) return
          const response: SearchResponse = {
            cards: dedupeLogicalCards(Array.isArray(data.cards) ? data.cards as DeckCard[] : []),
            total: Number.isInteger(data.total) ? data.total : 0,
            hasMore: data.hasMore === true,
            nextOffset: Number.isInteger(data.nextOffset) ? data.nextOffset : 0,
          }
          if (cache.current.size >= 40) cache.current.delete(cache.current.keys().next().value ?? '')
          cache.current.set(cacheKey, response)
          setCards(response.cards); setHasMore(response.hasMore); setNextOffset(response.nextOffset)
        })
        .catch(error => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          if (id === requestId.current) { setCards([]); setHasMore(false); setNextOffset(0) }
        })
        .finally(() => { if (id === requestId.current) setLoading(false) })
    }, query.trim() ? 70 : 0)
    return () => { clearTimeout(timer); abort.current?.abort() }
  }, [applyFilters, cacheKey, makerSlug, query, sort])

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return
    const id = requestId.current
    const controller = new AbortController()
    abort.current = controller
    setLoading(true)
    const params = new URLSearchParams({ q: query.trim(), offset: String(nextOffset), limit: String(CARD_SEARCH_PAGE_SIZE) })
    params.set('order', CARD_CATALOG_CACHE_VERSION)
    params.set('sort', sort)
    if (makerSlug) params.set('makerSlug', makerSlug)
    applyFilters(params)
    fetch(`/api/cards/search?${params}`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('search_failed')))
      .then(data => {
        if (id !== requestId.current || controller.signal.aborted) return
        const incoming = Array.isArray(data.cards) ? data.cards as DeckCard[] : []
        setCards(current => {
          const merged = dedupeLogicalCards([...current, ...incoming])
          cache.current.set(cacheKey, { cards: merged, total: Number.isInteger(data.total) ? data.total : merged.length, hasMore: data.hasMore === true, nextOffset: Number.isInteger(data.nextOffset) ? data.nextOffset : nextOffset + incoming.length })
          return merged
        })
        setHasMore(data.hasMore === true)
        setNextOffset(Number.isInteger(data.nextOffset) ? data.nextOffset : nextOffset + incoming.length)
      })
      .catch(error => { if (!(error instanceof DOMException && error.name === 'AbortError')) setHasMore(false) })
      .finally(() => { if (id === requestId.current && !controller.signal.aborted) setLoading(false) })
  }, [applyFilters, cacheKey, hasMore, loading, makerSlug, nextOffset, query, sort])

  return { query, setQuery, cards, hasMore, loading, loadMore, filters, addFilter, removeFilter, clearFilters, sort, setSort }
}
