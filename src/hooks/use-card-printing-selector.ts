'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { printingKey, type DeckCard } from '@/lib/deck-maker'

export function useCardPrintingSelector({ normalizeCard = (card: DeckCard) => card, onLoadError, onOptionsLoaded }: {
  normalizeCard?: (card: DeckCard) => DeckCard
  onLoadError?: () => void
  onOptionsLoaded?: (cards: DeckCard[]) => void
} = {}) {
  const [selectedCard, setSelectedCard] = useState<DeckCard | null>(null)
  const [printingOptions, setPrintingOptions] = useState<DeckCard[]>([])
  const [loading, setLoading] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const cache = useRef(new Map<string, DeckCard[]>())

  const closeCard = useCallback(() => {
    abort.current?.abort()
    setSelectedCard(null)
    setPrintingOptions([])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!selectedCard) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') closeCard() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [closeCard, selectedCard])

  const openCard = useCallback((card: DeckCard) => {
    abort.current?.abort()
    const cached = cache.current.get(card.id)
    setSelectedCard(card)
    setPrintingOptions(cached ?? [card])
    setLoading(!cached)
    if (cached) { onOptionsLoaded?.(cached); return }

    const controller = new AbortController()
    abort.current = controller
    fetch(`/api/cards/${encodeURIComponent(card.id)}/printings`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('printings_failed')))
      .then(data => {
        const cards = Array.isArray(data.cards) ? (data.cards as DeckCard[]).map(normalizeCard) : []
        if (!cards.length) return
        const unique = new Map<string, DeckCard>()
        for (const printing of cards) unique.set(printingKey(printing), printing)
        if (!unique.has(printingKey(card))) unique.set(printingKey(card), card)
        const options = [...unique.values()]
        cache.current.set(card.id, options)
        onOptionsLoaded?.(options)
        setPrintingOptions(options)
        setSelectedCard(options.find(option => printingKey(option) === printingKey(card)) ?? card)
      })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) onLoadError?.() })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
  }, [normalizeCard, onLoadError, onOptionsLoaded])

  return { selectedCard, printingOptions, loading, openCard, closeCard, selectPrinting: setSelectedCard }
}
