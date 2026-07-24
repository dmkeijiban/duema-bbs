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
//
// 'special' is NOT a cards-array zone: adding a card classified 'special' through
// normal search+add always lands it in main, same as any other card that isn't
// GR/hyperspatial. The special slot is a single deck-level `specialCardId` pick
// (see isSpecialSlotCard below), entirely separate from this array — confirmed by
// the research doc (a searched-and-added 零龍/FORBIDDEN-STAR-equivalent card lands
// in main; the special-slot pick is a different, independent mechanism that can
// reference the very same card id).
export function resolveAutoZone(deckZoneClass: DeckZoneClass | null | undefined, format: DeckFormat): DeckZone {
  if (format !== 'advance') return 'main'
  if (deckZoneClass === 'gr') return 'gr'
  if (deckZoneClass === 'hyperspatial') return 'hyperspatial'
  return 'main'
}
// A card is eligible for the special slot (the single ドルマゲドン/零龍-equivalent
// pick) exactly when deck_zone_class classifies it 'special' — currently only
// 最終禁断フィールド and 零龍クリーチャー card types. This never affects where the
// card lands if added to the deck via normal search (see resolveAutoZone above).
export function isSpecialSlotCard(deckZoneClass: DeckZoneClass | null | undefined) {
  return deckZoneClass === 'special'
}
// Regression guard: it's tempting to gate specialCardId by format the same way
// GR/hyperspatial cards-array entries are gated when saving outside advance
// format, but that's the wrong behavior here — the special slot must survive a
// save made while viewing 'original', so switching back to advance (even after
// a reload) restores it. This function is intentionally the identity function;
// its only job is to be the single place both the client (DeckMaker.tsx) and
// the server (actions.ts) call, so "don't null this based on format" stays
// encoded in one obviously-named spot instead of being re-derived ad hoc.
export function persistedSpecialCardId(specialCardId: string | null): string | null {
  return specialCardId
}
// Display-only gate for the special slot (public deck detail page, PNG export):
// shown exactly when the format is advance AND a card is actually selected.
// This is deliberately separate from persistedSpecialCardId above — the value
// itself is never cleared by format, only its visibility is.
export function shouldShowSpecialSlot(format: string, specialCardId: string | null | undefined): boolean {
  return format === 'advance' && Boolean(specialCardId)
}

// Guards a state-initializing effect so it applies its snapshot exactly once
// per component instance, never again on a later re-invocation caused by a
// prop identity change (e.g. a Server Action's revalidatePath refreshing the
// page's server-rendered props into an already-mounted client component).
// Without this, restoring `entries`/`format`/`specialCardId` from the initial
// deck snapshot on every such refresh would silently clobber whatever the
// user just changed and saved.
export function consumeMountOnce(ref: { current: boolean }): boolean {
  if (ref.current) return false
  ref.current = true
  return true
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
