import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { canAccessDeckMaker } from '@/lib/deck-maker-access'
import type { DeckCard } from '@/lib/deck-maker'

export const dynamic = 'force-dynamic'

type Printing = {
  id: string
  source_key: string
  official_page_url: string | null
  image_url: string | null
  set_name: string | null
  card_number: string | null
  is_search_visible: boolean
}

type Face = {
  card_printing_id: string | null
  side_index: number
  side_kind: string | null
  name: string
  name_kana: string | null
  image_url: string | null
  official_page_url: string | null
}

type Row = {
  id: string
  name: string
  name_kana: string | null
  image_url: string | null
  card_printings?: Printing[]
  card_faces?: Face[]
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
    const admin = createAdminClient()
    const faceProbe = await admin.from('card_faces').select('id', { head: true, count: 'exact' }).limit(1)
    const facesAvailable = !faceProbe.error
    const columns = facesAvailable
      ? 'id,name,name_kana,image_url,card_printings(id,source_key,official_page_url,image_url,set_name,card_number,is_search_visible),card_faces(card_printing_id,side_index,side_kind,name,name_kana,image_url,official_page_url)'
      : 'id,name,name_kana,image_url,card_printings(id,source_key,official_page_url,image_url,set_name,card_number,is_search_visible)'
    const { data, error } = await admin
      .from('cards')
      .select(columns)
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ cards: [] }, { status: 404 })

    const row = data as unknown as Row
    const cards: DeckCard[] = (row.card_printings ?? [])
      .filter((printing) => Boolean(printing.source_key) && printing.is_search_visible)
      .sort(compareNewest)
      .flatMap((printing): DeckCard[] => {
        const faces = (row.card_faces ?? []).filter((face) => face.card_printing_id === printing.id).sort((a, b) => a.side_index - b.side_index)
        if (!faces.length) return [{ id: row.id, name: row.name, nameKana: row.name_kana, imageUrl: printing.image_url ?? row.image_url, officialPageUrl: printing.official_page_url ?? `https://dm.takaratomy.co.jp/card/detail/?id=${encodeURIComponent(printing.source_key)}`, sourceKey: printing.source_key }]
        return faces.map((face) => ({
          id: row.id,
          name: face.name,
          nameKana: face.name_kana ?? row.name_kana,
          imageUrl: face.image_url ?? printing.image_url ?? row.image_url,
          officialPageUrl: face.official_page_url ?? printing.official_page_url,
          sourceKey: printing.source_key,
          matchedFace: { name: face.name, imageUrl: face.image_url, sideIndex: face.side_index, sideKind: face.side_kind },
        }))
      })

    if (!cards.length) {
      cards.push({ id: row.id, name: row.name, nameKana: row.name_kana, imageUrl: row.image_url, officialPageUrl: null, sourceKey: null })
    }
    return NextResponse.json({ cards }, { headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=3600' } })
  } catch {
    return NextResponse.json({ error: '収録版の取得に失敗しました' }, { status: 500 })
  }
}
