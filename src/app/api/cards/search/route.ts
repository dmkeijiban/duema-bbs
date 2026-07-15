import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { normalizeCardName } from '@/lib/card-name'
import { canAccessDeckMaker } from '@/lib/deck-maker-access'
import { LOCAL_DECK_CARDS, matchesCard, type DeckCard } from '@/lib/deck-maker'

export const dynamic = 'force-dynamic'
const MAX_QUERY_LENGTH = 80
const MAX_RESULTS = 30
const escapeIlike = (value: string) => value.replace(/[\\%_]/g, (character) => `\\${character}`)

type Row = {
  id: string
  name: string
  name_kana: string | null
  image_url: string | null
  card_printings?: Array<{ source_key: string; official_page_url: string | null; image_url: string | null; is_representative: boolean }>
}

function mapCard(row: Row): DeckCard {
  const printing = row.card_printings?.find((item) => item.is_representative) ?? row.card_printings?.[0]
  return { id: row.id, name: row.name, nameKana: row.name_kana, imageUrl: printing?.image_url ?? row.image_url, officialPageUrl: printing?.official_page_url ?? null, sourceKey: printing?.source_key ?? null }
}

export async function GET(request: NextRequest) {
  if (!(await canAccessDeckMaker())) return new NextResponse(null, { status: 404 })

  const rawQuery = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!rawQuery) return NextResponse.json({ cards: [] })
  if (rawQuery.length > MAX_QUERY_LENGTH || /[\u0000-\u001f\u007f]/.test(rawQuery)) return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  const query = escapeIlike(normalizeCardName(rawQuery))
  const kanaQuery = escapeIlike(rawQuery)
  try {
    const supabase = createAdminClient()
    const columns = 'id,name,name_kana,image_url,card_printings(source_key,official_page_url,image_url,is_representative)'
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
    return NextResponse.json({ cards: LOCAL_DECK_CARDS.filter((card) => matchesCard(card, rawQuery)).slice(0, MAX_RESULTS), fallback: true }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
  }
}
