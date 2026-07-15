import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { normalizeCardName } from '@/lib/card-name'
import { canAccessDeckMaker } from '@/lib/deck-maker-access'
import { LOCAL_DECK_CARDS, matchesCard, type DeckCard } from '@/lib/deck-maker'

export const dynamic = 'force-dynamic'
const MAX_QUERY_LENGTH = 80
const MAX_RESULTS = 30
const DEFAULT_RESULTS = 32
const escapeIlike = (value: string) => value.replace(/[\\%_]/g, (character) => `\\${character}`)

type Row = {
  id: string
  name: string
  name_kana: string | null
  image_url: string | null
  card_printings?: Array<{ source_key: string; official_page_url: string | null; image_url: string | null; is_representative: boolean }>
}

type PrintingRow = {
  source_key: string
  official_page_url: string | null
  image_url: string | null
  cards: { id: string; name: string; name_kana: string | null; image_url: string | null } | null
}

function mapCard(row: Row): DeckCard {
  const printing = row.card_printings?.find((item) => item.is_representative) ?? row.card_printings?.[0]
  return { id: row.id, name: row.name, nameKana: row.name_kana, imageUrl: printing?.image_url ?? row.image_url, officialPageUrl: printing?.official_page_url ?? null, sourceKey: printing?.source_key ?? null }
}

function mapPrinting(row: PrintingRow): DeckCard | null {
  if (!row.cards) return null
  return { id: row.cards.id, name: row.cards.name, nameKana: row.cards.name_kana, imageUrl: row.image_url ?? row.cards.image_url, officialPageUrl: row.official_page_url, sourceKey: row.source_key }
}

export async function GET(request: NextRequest) {
  if (!(await canAccessDeckMaker())) return new NextResponse(null, { status: 404 })

  const rawQuery = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (rawQuery.length > MAX_QUERY_LENGTH || /[\u0000-\u001f\u007f]/.test(rawQuery)) return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  const query = escapeIlike(normalizeCardName(rawQuery))
  const kanaQuery = escapeIlike(rawQuery)
  try {
    const supabase = createAdminClient()
    const columns = 'id,name,name_kana,image_url,card_printings(source_key,official_page_url,image_url,is_representative)'
    if (!rawQuery) {
      const result = await supabase
        .from('card_printings')
        .select('source_key,official_page_url,image_url,cards!inner(id,name,name_kana,image_url,is_active)')
        .ilike('set_name', '%DM26%EX2%')
        .eq('cards.is_active', true)
        .order('card_number')
        .limit(DEFAULT_RESULTS * 3)
      if (result.error) throw result.error
      const unique = new Map<string, DeckCard>()
      for (const row of (result.data ?? []) as unknown as PrintingRow[]) {
        const card = mapPrinting(row)
        if (card && !unique.has(card.id)) unique.set(card.id, card)
        if (unique.size === DEFAULT_RESULTS) break
      }
      if (unique.size < DEFAULT_RESULTS) {
        const fallbackResult = await supabase.from('cards').select(columns).eq('is_active', true).order('name').limit(DEFAULT_RESULTS)
        if (fallbackResult.error) throw fallbackResult.error
        for (const row of (fallbackResult.data ?? []) as Row[]) {
          const card = mapCard(row)
          if (!unique.has(card.id)) unique.set(card.id, card)
          if (unique.size === DEFAULT_RESULTS) break
        }
      }
      return NextResponse.json({ cards: [...unique.values()] }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
    }
    const [nameResult, kanaResult] = await Promise.all([
      supabase.from('cards').select(columns).eq('is_active', true).ilike('normalized_name', `%${query}%`).order('name').limit(MAX_RESULTS),
      supabase.from('cards').select(columns).eq('is_active', true).ilike('name_kana', `%${kanaQuery}%`).order('name').limit(MAX_RESULTS),
    ])
    if (nameResult.error) throw nameResult.error
    if (kanaResult.error) throw kanaResult.error
    const unique = new Map<string, Row>()
    for (const row of [...(nameResult.data ?? []), ...(kanaResult.data ?? [])] as Row[]) unique.set(row.id, row)
    return NextResponse.json({ cards: [...unique.values()].slice(0, MAX_RESULTS).map(mapCard) }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
  } catch {
    const cards = rawQuery ? LOCAL_DECK_CARDS.filter((card) => matchesCard(card, rawQuery)) : LOCAL_DECK_CARDS
    return NextResponse.json({ cards: cards.slice(0, rawQuery ? MAX_RESULTS : DEFAULT_RESULTS), fallback: true }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
  }
}
