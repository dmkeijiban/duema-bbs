import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { canAccessDeckMaker } from '@/lib/deck-maker-access'
import { getSpecialSlotOptions } from '@/lib/special-slot-options'
import type { DeckCard } from '@/lib/deck-maker'

export const dynamic = 'force-dynamic'

// The advance-format special slot ("なし／ドルマゲドン相当／零龍相当") is a small,
// fixed 2-choice radio, never a searchable list. getSpecialSlotOptions (shared
// with savePublishedDeck's server-side validation in actions.ts) reduces the
// candidates to exactly one representative per special card_type — currently
// 最終禁断フィールド and 零龍クリーチャー — so this endpoint can never return more
// than a couple of options regardless of how many printings/duplicate logical
// rows might exist for either type. This is intentionally a separate, tiny
// endpoint rather than a filter on /api/cards/search, since these cards must
// never appear as addable search results (see
// docs/research/dmhub-advance-investigation.md: adding one of these cards
// through normal search always lands it in the main deck as an ordinary card —
// a completely separate action from picking it here).
export async function GET() {
  if (!(await canAccessDeckMaker())) return new NextResponse(null, { status: 404 })
  try {
    const admin = createAdminClient()
    const options = await getSpecialSlotOptions(admin)
    const cards: DeckCard[] = options.map(option => ({
      id: option.id,
      name: option.name,
      nameKana: option.nameKana,
      imageUrl: option.imageUrl,
      officialPageUrl: null,
      sourceKey: null,
      cardType: option.cardType,
      deckZoneClass: 'special',
    }))
    return NextResponse.json({ cards }, { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' } })
  } catch (error) {
    console.error('[cards/special-options] failed to load special-slot options', { message: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ cards: [] }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
  }
}
