import { normalizeCardSearch } from '@/lib/card-name'

export type CardFace = { name: string; imageUrl: string | null; sideIndex: number; sideKind: string | null }
export type DeckCard = { id: string; name: string; nameKana: string | null; imageUrl: string | null; officialPageUrl: string | null; sourceKey: string | null; matchedFace?: CardFace | null }
export type DeckEntry = DeckCard & { count: number }
export const DECK_STORAGE_KEY = 'duema-bbs:deck-maker'
export const DECK_STORAGE_VERSION = 1
export const MAX_DECK_CARDS = 40
export const MAX_SAME_CARD = 4

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
