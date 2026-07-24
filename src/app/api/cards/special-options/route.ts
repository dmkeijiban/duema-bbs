import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { canAccessDeckMaker } from '@/lib/deck-maker-access'
import { getSpecialSlotOptions } from '@/lib/special-slot-options'

export const dynamic = 'force-dynamic'

// The advance-format special slot ("なし／ドルマゲドン／零龍") is a small, fixed
// 2-choice radio, never a searchable list. getSpecialSlotOptions (shared with
// savePublishedDeck's server-side validation in actions.ts) resolves the
// candidates from special_slot_representatives — a fixed key -> cards.id
// mapping — never from id-ordering or a count of matching card_type rows, so
// this endpoint always returns at most the 2 keys (dormageddon, zeroryu)
// regardless of how many printings/duplicate logical rows might exist. This is
// intentionally a separate, tiny endpoint rather than a filter on
// /api/cards/search, since these cards must never appear as addable search
// results (see docs/research/dmhub-advance-investigation.md: adding one of
// these cards through normal search always lands it in the main deck as an
// ordinary card — a completely separate action from picking it here).
export async function GET() {
  if (!(await canAccessDeckMaker())) return new NextResponse(null, { status: 404 })
  try {
    const admin = createAdminClient()
    const options = await getSpecialSlotOptions(admin)
    return NextResponse.json({ options }, { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' } })
  } catch (error) {
    console.error('[cards/special-options] failed to load special-slot options', { message: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ options: [] }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
  }
}
