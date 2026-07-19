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

// 保存時に選んだ収録版の画像を、作成画面・一覧・詳細・画像出力の全経路で同一に表示するための
// 共通URL解決。imageUrl（保存済み/取得済みの完全一致画像）があれば公式画像プロキシへ、
// なければ card_id からの代表画像フォールバック（旧データ用）へ回す。
export function exactCardImageUrl(card: { id: string; imageUrl: string | null }, slug: string) {
  return card.imageUrl
    ? `/api/card-image?url=${encodeURIComponent(card.imageUrl)}`
    : `/api/makers/${slug}/card-image?id=${encodeURIComponent(card.id)}`
}
