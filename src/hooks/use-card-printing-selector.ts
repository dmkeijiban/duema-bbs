'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { printingKey, type DeckCard } from '@/lib/deck-maker'

export const CARD_PRINTING_CHANGE_EVENT = 'duema-bbs:card-printing-change'

const printingOptionsCache = new Map<string, DeckCard[]>()
const printingOptionsRequests = new Map<string, Promise<DeckCard[]>>()

function loadPrintingOptions(card: DeckCard, normalizeCard: (card: DeckCard) => DeckCard) {
  const cached = printingOptionsCache.get(card.id)
  if (cached) return Promise.resolve(cached)

  const pending = printingOptionsRequests.get(card.id)
  if (pending) return pending

  const request = fetch(`/api/cards/${encodeURIComponent(card.id)}/printings`)
    .then(response => response.ok ? response.json() : Promise.reject(new Error('printings_failed')))
    .then(data => {
      const cards = Array.isArray(data.cards) ? (data.cards as DeckCard[]).map(normalizeCard) : []
      const unique = new Map<string, DeckCard>()
      for (const printing of cards) unique.set(printingKey(printing), printing)
      if (!unique.has(printingKey(card))) unique.set(printingKey(card), card)
      const options = [...unique.values()]
      printingOptionsCache.set(card.id, options)
      return options
    })
    .finally(() => printingOptionsRequests.delete(card.id))

  printingOptionsRequests.set(card.id, request)
  return request
}

export function useCardPrintingSelector({ normalizeCard = (card: DeckCard) => card, onLoadError, onOptionsLoaded }: {
  normalizeCard?: (card: DeckCard) => DeckCard
  onLoadError?: () => void
  onOptionsLoaded?: (cards: DeckCard[]) => void
} = {}) {
  const [selectedCard, setSelectedCard] = useState<DeckCard | null>(null)
  const [printingOptions, setPrintingOptions] = useState<DeckCard[]>([])
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)

  const closeCard = useCallback(() => {
    requestId.current += 1
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
    const currentRequestId = requestId.current + 1
    requestId.current = currentRequestId
    const cached = printingOptionsCache.get(card.id)
    setSelectedCard(card)
    setPrintingOptions(cached ?? [card])
    setLoading(!cached)
    if (cached) { onOptionsLoaded?.(cached); return }

    loadPrintingOptions(card, normalizeCard)
      .then(options => {
        if (requestId.current !== currentRequestId) return
        onOptionsLoaded?.(options)
        setPrintingOptions(options)
        setSelectedCard(options.find(option => printingKey(option) === printingKey(card)) ?? card)
      })
      .catch(() => { if (requestId.current === currentRequestId) onLoadError?.() })
      .finally(() => { if (requestId.current === currentRequestId) setLoading(false) })
  }, [normalizeCard, onLoadError, onOptionsLoaded])

  const selectPrinting = useCallback((card: DeckCard) => {
    if (selectedCard && printingKey(selectedCard) !== printingKey(card)) {
      window.dispatchEvent(new CustomEvent(CARD_PRINTING_CHANGE_EVENT, {
        detail: { previousCard: selectedCard, nextCard: card },
      }))
    }
    setSelectedCard(card)
  }, [selectedCard])

  return { selectedCard, printingOptions, loading, openCard, closeCard, selectPrinting }
}
