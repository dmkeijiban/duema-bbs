'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DeckCard } from '@/lib/deck-maker'

export const CARD_SEARCH_PAGE_SIZE = 48
const CARD_SEARCH_CACHE_VERSION = 'official-order-v2'
const resultKey = (card: DeckCard) => `${card.id}:${card.printingId ?? card.sourceKey ?? 'representative'}`

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
  const requestId = useRef(0)
  const abort = useRef<AbortController | null>(null)
  const cache = useRef(new Map<string, SearchResponse>())

  const cacheKey = `${CARD_SEARCH_CACHE_VERSION}:${makerSlug ?? ''}:${query.trim()}`

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
      params.set('order', CARD_SEARCH_CACHE_VERSION)
      if (makerSlug) params.set('makerSlug', makerSlug)
      if (!query.trim()) params.set('fastInitial', '1')
      fetch(`/api/cards/search?${params}`, { signal: controller.signal })
        .then(response => response.ok ? response.json() : Promise.reject(new Error('search_failed')))
        .then(data => {
          if (id !== requestId.current) return
          const response: SearchResponse = {
            cards: Array.isArray(data.cards) ? data.cards : [],
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
  }, [cacheKey, makerSlug, query])

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return
    const id = requestId.current
    const controller = new AbortController()
    abort.current = controller
    setLoading(true)
    const params = new URLSearchParams({ q: query.trim(), offset: String(nextOffset), limit: String(CARD_SEARCH_PAGE_SIZE) })
    params.set('order', CARD_SEARCH_CACHE_VERSION)
    if (makerSlug) params.set('makerSlug', makerSlug)
    fetch(`/api/cards/search?${params}`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('search_failed')))
      .then(data => {
        if (id !== requestId.current || controller.signal.aborted) return
        const incoming = Array.isArray(data.cards) ? data.cards as DeckCard[] : []
        setCards(current => {
          const unique = new Map(current.map(card => [resultKey(card), card]))
          for (const card of incoming) unique.set(resultKey(card), card)
          const merged = [...unique.values()]
          cache.current.set(cacheKey, { cards: merged, total: Number.isInteger(data.total) ? data.total : merged.length, hasMore: data.hasMore === true, nextOffset: Number.isInteger(data.nextOffset) ? data.nextOffset : nextOffset + incoming.length })
          return merged
        })
        setHasMore(data.hasMore === true)
        setNextOffset(Number.isInteger(data.nextOffset) ? data.nextOffset : nextOffset + incoming.length)
      })
      .catch(error => { if (!(error instanceof DOMException && error.name === 'AbortError')) setHasMore(false) })
      .finally(() => { if (id === requestId.current && !controller.signal.aborted) setLoading(false) })
  }, [cacheKey, hasMore, loading, makerSlug, nextOffset, query])

  return { query, setQuery, cards, hasMore, loading, loadMore }
}
