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

type AliasRow = {
  old_source_key: string
  official_source_key: string
}

const printingCollator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' })

function compareNewest(first: Printing, second: Printing) {
  const firstSet = first.source_key.split('-')[0]?.toUpperCase() ?? ''
  const secondSet = second.source_key.split('-')[0]?.toUpperCase() ?? ''
  return printingCollator.compare(secondSet, firstSet)
    || printingCollator.compare(second.source_key, first.source_key)
}

function normalizeKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function printingIdentity(printing: Printing, canonicalAliases: Map<string, string>) {
  // card_number distinguishes legitimate variants such as PR001 / PR001CHO.
  // A resurrected preview row and its official replacement share the same number,
  // even when their source_key and image URL differ.
  const number = normalizeKey(printing.card_number)
  if (number) return `number:${number}`

  const sourceKey = normalizeKey(printing.source_key)
  return `source:${canonicalAliases.get(sourceKey) ?? sourceKey}`
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
    const printingKeys = (row.card_printings ?? []).map((printing) => normalizeKey(printing.source_key)).filter(Boolean)

    // Load all aliases and compare normalized keys. The previous implementation used
    // an exact `.in()` match, so case/format differences could leave resurrected rows
    // visible. Fail open if the alias table is unavailable; the card-number dedupe below
    // still prevents duplicate tiles.
    const aliasResult = printingKeys.length
      ? await admin.from('card_printing_source_aliases').select('old_source_key,official_source_key').limit(5000)
      : { data: [], error: null }
    const aliases = (aliasResult.error ? [] : aliasResult.data ?? []) as AliasRow[]
    const canonicalAliases = new Map<string, string>()
    const supersededKeys = new Set<string>()
    for (const alias of aliases) {
      const oldKey = normalizeKey(alias.old_source_key)
      const officialKey = normalizeKey(alias.official_source_key)
      if (!oldKey) continue
      supersededKeys.add(oldKey)
      canonicalAliases.set(oldKey, officialKey || oldKey)
    }

    const visiblePrintings = (row.card_printings ?? [])
      .filter((printing) => Boolean(printing.source_key) && printing.is_search_visible)
      .sort(compareNewest)

    // Collapse duplicate identities before expanding faces. Prefer an official/current
    // row over an alias-old preview row. This makes the endpoint correct even before
    // the production cleanup migration is applied.
    const uniquePrintings = new Map<string, Printing>()
    for (const printing of visiblePrintings) {
      const identity = printingIdentity(printing, canonicalAliases)
      const existing = uniquePrintings.get(identity)
      if (!existing) {
        uniquePrintings.set(identity, printing)
        continue
      }

      const existingIsSuperseded = supersededKeys.has(normalizeKey(existing.source_key))
      const currentIsSuperseded = supersededKeys.has(normalizeKey(printing.source_key))
      if (existingIsSuperseded && !currentIsSuperseded) uniquePrintings.set(identity, printing)
    }

    const cards: DeckCard[] = [...uniquePrintings.values()]
      .filter((printing) => !supersededKeys.has(normalizeKey(printing.source_key)))
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

    const seenImage = new Set<string>()
    const dedupedCards = cards.filter((card) => {
      const key = card.imageUrl ?? `no-image:${card.sourceKey ?? card.name}`
      if (seenImage.has(key)) return false
      seenImage.add(key)
      return true
    })

    return NextResponse.json({ cards: dedupedCards }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: '収録版の取得に失敗しました' }, { status: 500 })
  }
}
