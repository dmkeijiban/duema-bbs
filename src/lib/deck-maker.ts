import { normalizeCardSearch } from '@/lib/card-name'

export type CardFace = { name: string; imageUrl: string | null; sideIndex: number; sideKind: string | null }
// Server-computed classification (cards.deck_zone_class) that drives automatic zone
// placement. 'normal' means "no special zone" (goes to main). Never inferred from
// the card's name client-side — always trust this value when present.
export type DeckZoneClass = 'normal' | 'gr' | 'hyperspatial' | 'special'
export type DeckCard = { id: string; printingId?: string | null; name: string; nameKana: string | null; imageUrl: string | null; officialPageUrl: string | null; sourceKey: string | null; cost?: number | null; civilization?: string[]; cardType?: string | null; race?: string | null; abilityText?: string | null; setName?: string | null; cardNumber?: string | null; matchedFace?: CardFace | null; deckZoneClass?: DeckZoneClass | null; usageCount?: number | null }
export type DeckFormat = 'original' | 'advance'
export type DeckZone = 'main' | 'gr' | 'hyperspatial' | 'special'
export type DeckEntry = DeckCard & { count: number; zone?: DeckZone }
export const DECK_STORAGE_KEY = 'duema-bbs:deck-maker'
export const DECK_STORAGE_VERSION = 1
export const MAX_DECK_CARDS = 40
export const DECK_ZONE_LIMITS: Record<DeckZone, number> = { main: 40, gr: 12, hyperspatial: 8, special: 1 }
export const MAX_SAME_CARD = 4
// GR is a hard 2-of-a-kind zone under current official rules; every other zone
// keeps the standard 4-of-a-kind limit.
const SAME_CARD_LIMITS: Record<DeckZone, number> = { main: MAX_SAME_CARD, gr: 2, hyperspatial: MAX_SAME_CARD, special: 1 }
export function sameCardLimit(zone: DeckZone) {
  return SAME_CARD_LIMITS[zone] ?? MAX_SAME_CARD
}
// Automatic zone placement from the server-classified deck_zone_class, not from
// whichever tab the user currently has open. Outside the advance format there is
// only one zone, so everything collapses to 'main'.
export function resolveAutoZone(deckZoneClass: DeckZoneClass | null | undefined, format: DeckFormat): DeckZone {
  if (format !== 'advance') return 'main'
  if (deckZoneClass === 'gr') return 'gr'
  if (deckZoneClass === 'hyperspatial') return 'hyperspatial'
  if (deckZoneClass === 'special') return 'special'
  return 'main'
}
export function printingKey(card: DeckCard) {
  return `${card.id}:${card.printingId ?? card.sourceKey ?? 'base'}:${card.matchedFace?.sideIndex ?? 0}`
}

export const LOCAL_DECK_CARDS: DeckCard[] = [
  { id: 'fixture-dm26ex2-spr1', name: '瀑水神 ミヅハノオオミカミ', nameKana: 'ばくすいしん みづはのおおみかみ', imageUrl: 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/001.jpg', officialPageUrl: 'https://dm.takaratomy.co.jp/product/dm26ex2/', sourceKey: 'dm26ex2-spr1' },
  { id: 'fixture-dm26ex2-spr2', name: '世界竜皇 ボルシャック・ヒカリスマ', nameKana: 'せかいりゅうおう ぼるしゃっく ひかりすま', imageUrl: 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/002.jpg', officialPageUrl: 'https://dm.takaratomy.co.jp/product/dm26ex2/', sourceKey: 'dm26ex2-spr2' },
  { id: 'fixture-dm26ex2-spr3', name: '邪眼魔凰デス・フェニックス', nameKana: 'じゃがんまおう です ふぇにっくす', imageUrl: 'https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/003.jpg', officialPageUrl: 'https://dm.takaratomy.co.jp/product/dm26ex2/', sourceKey: 'dm26ex2-spr3' },
]

export function matchesCard(card: DeckCard, query: string) {
  const needle = normalizeCardSearch(query)
  return !needle || normalizeCardSearch(`${card.name}${card.nameKana ?? ''}`).includes(needle)
}

export function deckSize(entries: DeckEntry[]) { return entries.reduce((sum, entry) => sum + entry.count, 0) }
export function entryZone(entry: DeckEntry): DeckZone { return entry.zone ?? 'main' }
export function zoneDeckSize(entries: DeckEntry[], zone: DeckZone) { return entries.reduce((sum, entry) => sum + (entryZone(entry) === zone ? entry.count : 0), 0) }
