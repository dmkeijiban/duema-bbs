import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { canAccessDeckMaker } from '@/lib/deck-maker-access'
import type { DeckCard } from '@/lib/deck-maker'

export const dynamic = 'force-dynamic'

type Printing = {
  source_key: string
  official_page_url: string | null
  image_url: string | null
  set_name: string | null
  card_number: string | null
  is_search_visible: boolean
}

type Row = {
  id: string
  name: string
  name_kana: string | null
  image_url: string | null
  card_printings?: Printing[]
}

const printingCollator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' })

function compareNewest(first: Printing, second: Printing) {
  const firstSet = first.source_key.split('-')[0]?.toUpperCase() ?? ''
  const secondSet = second.source_key.split('-')[0]?.toUpperCase() ?? ''
  return printingCollator.compare(secondSet, firstSet)
    || printingCollator.compare(second.source_key, first.source_key)
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await canAccessDeckMaker())) return new NextResponse(null, { status: 404 })

  const { id } = await context.params
  if (!id || id.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid card id' }, { status: 400 })
  }

  try {
    const { data, error } = await createAdminClient()
      .from('cards')
      .select('id,name,name_kana,image_url,card_printings(source_key,official_page_url,image_url,set_name,card_number,is_search_visible)')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ cards: [] }, { status: 404 })

    const row = data as unknown as Row
    const cards: DeckCard[] = (row.card_printings ?? [])
      .filter((printing) => Boolean(printing.source_key) && printing.is_search_visible)
      .sort(compareNewest)
      .map((printing) => ({
        id: row.id,
        name: row.name,
        nameKana: row.name_kana,
        imageUrl: printing.image_url ?? row.image_url,
        officialPageUrl: printing.official_page_url ?? `https://dm.takaratomy.co.jp/card/detail/?id=${encodeURIComponent(printing.source_key)}`,
        sourceKey: printing.source_key,
      }))

    if (!cards.length) {
      cards.push({ id: row.id, name: row.name, nameKana: row.name_kana, imageUrl: row.image_url, officialPageUrl: null, sourceKey: null })
    }
    return NextResponse.json({ cards }, { headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=3600' } })
  } catch {
    return NextResponse.json({ error: '収録版の取得に失敗しました' }, { status: 500 })
  }
}
