import { DECK_STORAGE_KEY } from '@/lib/deck-maker'

// デッキメーカー（src/app/makers/deck-maker/DeckMaker.tsx）が保存キーを変更した場合はここも合わせる。
const SAVED_DECKS_STORAGE_KEY = 'duema-bbs:deck-maker:saved-decks'
const MAX_DECK_NAME_LENGTH = 60

function normalizeName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, MAX_DECK_NAME_LENGTH)
  return trimmed || null
}

function readCurrentDeckName(): string | null {
  try {
    const raw = localStorage.getItem(DECK_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { deckName?: unknown } | null
    if (!parsed || typeof parsed !== 'object') return null
    return normalizeName(parsed.deckName)
  } catch {
    return null
  }
}

function readSavedDeckNames(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_DECKS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => (item && typeof item === 'object' ? normalizeName((item as { name?: unknown }).name) : null))
      .filter((name): name is string => name !== null)
  } catch {
    return []
  }
}

/** デッキメーカーのlocalStorageから、保存済みデッキ名の候補一覧を重複・空文字を除いて返す。壊れたデータやサーバーサイドでは空配列。 */
export function getSavedDeckNames(): string[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return []

  const names = [...readSavedDeckNames(), readCurrentDeckName()].filter((name): name is string => name !== null)
  return [...new Set(names)]
}
