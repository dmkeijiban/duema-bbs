import { NextRequest, NextResponse } from 'next/server'
import { canAccessDeckMaker } from '@/lib/deck-maker-access'
import { type DeckCard } from '@/lib/deck-maker'
import { createAdminClient } from '@/lib/supabase-admin'

type Printing = { id: string; source_key: string; official_page_url: string | null; image_url: string | null; is_representative: boolean; is_search_visible: boolean }
type Row = { id: string; name: string; name_kana: string | null; image_url: string | null; cost: number | null; civilization: string[] | null; card_type: string | null; card_printings?: Printing[] }

function mapCard(row: Row, printing?: Printing): DeckCard {
  const selected = printing ?? row.card_printings?.find((item) => item.is_representative) ?? row.card_printings?.[0]
  return { id: row.id, printingId: selected?.id ?? null, name: row.name, nameKana: row.name_kana, imageUrl: selected?.image_url ?? row.image_url, officialPageUrl: selected?.official_page_url ?? null, sourceKey: selected?.source_key ?? null, cost: row.cost, civilization: row.civilization ?? [], cardType: row.card_type }
}

export async function POST(request: NextRequest) {
  if (!(await canAccessDeckMaker())) return new NextResponse(null, { status: 404 })
  const body = await request.json().catch(() => null) as { ids?: unknown; sourceKeys?: unknown } | null
  const ids = Array.isArray(body?.ids) ? [...new Set(body.ids.filter((id): id is string => typeof id === 'string' && id.length <= 100 && /^[a-zA-Z0-9_-]+$/.test(id)))].slice(0, 40) : []
  const sourceKeys = Array.isArray(body?.sourceKeys) ? [...new Set(body.sourceKeys.filter((key): key is string => typeof key === 'string' && key.length <= 100 && /^[a-zA-Z0-9_-]+$/.test(key)))].slice(0, 40) : []
  if (!ids.length && !sourceKeys.length) return NextResponse.json({ cards: [], aliases: [] })

  try {
    const admin = createAdminClient()
    const [{ data: rows, error: cardError }, { data: aliases, error: aliasError }] = await Promise.all([
      admin.from('cards').select('id,name,name_kana,image_url,cost,civilization,card_type,card_printings(id,source_key,official_page_url,image_url,is_representative,is_search_visible)').in('id', ids).eq('is_active', true),
      sourceKeys.length ? admin.from('card_printing_source_aliases').select('old_source_key,official_source_key').in('old_source_key', sourceKeys) : Promise.resolve({ data: [], error: null }),
    ])
    if (cardError) throw cardError
    if (aliasError) throw aliasError
    const officialKeys = (aliases ?? []).map((alias) => alias.official_source_key)
    const printingResult = officialKeys.length
      ? await admin.from('card_printings').select('id,source_key,official_page_url,image_url,is_representative,is_search_visible,card_id').in('source_key', officialKeys)
      : { data: [], error: null }
    if (printingResult.error) throw printingResult.error
    const aliasCardIds = [...new Set((printingResult.data ?? []).map((printing) => printing.card_id))]
    const aliasRowsResult = aliasCardIds.length
      ? await admin.from('cards').select('id,name,name_kana,image_url,cost,civilization,card_type,card_printings(id,source_key,official_page_url,image_url,is_representative,is_search_visible)').in('id', aliasCardIds).eq('is_active', true)
      : { data: [], error: null }
    if (aliasRowsResult.error) throw aliasRowsResult.error
    const rowById = new Map(
      ([...((rows ?? []) as Row[]), ...((aliasRowsResult.data ?? []) as Row[])]).map((row) => [row.id, row]),
    )
    const printingByKey = new Map((printingResult.data ?? []).map((printing) => [printing.source_key, printing]))
    const resolvedAliases = (aliases ?? []).flatMap((alias) => {
      const printing = printingByKey.get(alias.official_source_key)
      const row = printing ? rowById.get(printing.card_id) : null
      return row && printing ? [{ oldSourceKey: alias.old_source_key, card: mapCard(row, printing) }] : []
    })
    return NextResponse.json({ cards: [...rowById.values()].map((row) => mapCard(row)), aliases: resolvedAliases }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[cards/resolve] card resolve failed', { idCount: ids.length, sourceKeyCount: sourceKeys.length, message })
    return NextResponse.json({ cards: [], aliases: [], fallback: true }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
  }
}
