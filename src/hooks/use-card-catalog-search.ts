'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DeckCard } from '@/lib/deck-maker'

export const CARD_SEARCH_PAGE_SIZE = 48

type SearchResponse = {
  cards: DeckCard[]
  total: number
  hasMore: boolean
  nextOffset: number
}

export function useCardCatalogSearch({ makerSlug }: { makerSlug?: string } = {}) {
  const [query, setQuery] = useState('')
  const [cards, setCards] = useState<DeckCard[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)
  const abort = useRef<AbortController | null>(null)
  const cache = useRef(new Map<string, SearchResponse>())

  const cacheKey = `${makerSlug ?? ''}:${query.trim()}`

  useEffect(() => {
    const id = ++requestId.current
    const cached = cache.current.get(cacheKey)
    abort.current?.abort()
    if (cached) {
      setCards(cached.cards); setTotal(cached.total); setHasMore(cached.hasMore); setNextOffset(cached.nextOffset); setLoading(false)
      return
    }
    setHasMore(false); setNextOffset(0)
    const timer = window.setTimeout(() => {
      const controller = new AbortController()
      abort.current = controller
      setLoading(true)
      const params = new URLSearchParams({ q: query.trim(), offset: '0', limit: String(CARD_SEARCH_PAGE_SIZE) })
      if (makerSlug) params.set('makerSlug', makerSlug)
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
          setCards(response.cards); setTotal(response.total); setHasMore(response.hasMore); setNextOffset(response.nextOffset)
        })
        .catch(error => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          if (id === requestId.current) { setCards([]); setTotal(0); setHasMore(false); setNextOffset(0) }
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
    if (makerSlug) params.set('makerSlug', makerSlug)
    fetch(`/api/cards/search?${params}`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('search_failed')))
      .then(data => {
        if (id !== requestId.current || controller.signal.aborted) return
        const incoming = Array.isArray(data.cards) ? data.cards as DeckCard[] : []
        setCards(current => {
          const unique = new Map(current.map(card => [card.id, card]))
          for (const card of incoming) unique.set(card.id, card)
          const merged = [...unique.values()]
          cache.current.set(cacheKey, { cards: merged, total: Number.isInteger(data.total) ? data.total : total, hasMore: data.hasMore === true, nextOffset: Number.isInteger(data.nextOffset) ? data.nextOffset : nextOffset + incoming.length })
          return merged
        })
        setTotal(Number.isInteger(data.total) ? data.total : total)
        setHasMore(data.hasMore === true)
        setNextOffset(Number.isInteger(data.nextOffset) ? data.nextOffset : nextOffset + incoming.length)
      })
      .catch(error => { if (!(error instanceof DOMException && error.name === 'AbortError')) setHasMore(false) })
      .finally(() => { if (id === requestId.current && !controller.signal.aborted) setLoading(false) })
  }, [cacheKey, hasMore, loading, makerSlug, nextOffset, query, total])

  return { query, setQuery, cards, total, hasMore, loading, loadMore }
}
