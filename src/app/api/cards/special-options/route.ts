import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { canAccessDeckMaker } from '@/lib/deck-maker-access'
import type { DeckCard } from '@/lib/deck-maker'

export const dynamic = 'force-dynamic'

// The advance-format special slot ("なし／ドルマゲドン相当／零龍相当") is a small,
// curated radio choice, never a searchable list: exactly the cards whose own
// deck_zone_class classifies them 'special' (currently 最終禁断フィールド and
// 零龍クリーチャー card types — see supabase/migrations/20260724130000_refine_deck_zone_class.sql).
// This is intentionally a separate, tiny endpoint rather than a filter on
// /api/cards/search, since these cards must never appear as addable search
// results (see docs/research/dmhub-advance-investigation.md: adding one of these
// cards through normal search always lands it in the main deck as an ordinary
// card — a completely separate action from picking it here).
export async function GET() {
  if (!(await canAccessDeckMaker())) return new NextResponse(null, { status: 404 })
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('cards')
      .select('id,name,name_kana,image_url,cost,civilization,card_type,deck_zone_class')
      .eq('is_active', true)
      .eq('deck_zone_class', 'special')
      .order('name')
    if (error) throw error
    const cards: DeckCard[] = (data ?? []).map(row => ({
      id: row.id,
      name: row.name,
      nameKana: row.name_kana,
      imageUrl: row.image_url,
      officialPageUrl: null,
      sourceKey: null,
      cost: row.cost,
      civilization: row.civilization ?? [],
      cardType: row.card_type,
      deckZoneClass: 'special',
    }))
    return NextResponse.json({ cards }, { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' } })
  } catch (error) {
    console.error('[cards/special-options] failed to load special-slot options', { message: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ cards: [] }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
  }
}
