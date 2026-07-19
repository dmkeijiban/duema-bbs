import type { DeckCard } from '@/lib/deck-maker'

// デッキメーカーを正本とするカード検索・収録版識別の共通契約。
// 企画ごとに独自のキーや重複排除を実装しない。
export const CARD_CATALOG_CACHE_VERSION = 'deck-maker-contract-v1'

export function cardLogicalKey(card: DeckCard) {
  return card.id
}

export function cardPrintingKey(card: DeckCard) {
  return `${card.id}:${card.printingId ?? card.sourceKey ?? 'representative'}:${card.matchedFace?.sideIndex ?? 'front'}`
}

export function dedupeLogicalCards(cards: DeckCard[]) {
  const unique = new Map<string, DeckCard>()
  for (const card of cards) {
    const key = cardLogicalKey(card)
    if (!unique.has(key)) unique.set(key, card)
  }
  return [...unique.values()]
}

export function dedupeCardPrintings(cards: DeckCard[]) {
  const unique = new Map<string, DeckCard>()
  for (const card of cards) unique.set(cardPrintingKey(card), card)
  return [...unique.values()]
}
