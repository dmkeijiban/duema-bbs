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
  cost: number | null
  civilization: string[] | null
  card_type: string | null
  card_printings?: Printing[]
  card_faces?: Face[]
}

type ZukanDetail = { name: string; race: string | null; ability_text: string | null }

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

function isCharismaPreviewKey(value: string | null | undefined) {
  return /^dm26ex2-preview-/.test(normalizeKey(value))
}

function isCharismaOfficialKey(value: string | null | undefined) {
  const key = normalizeKey(value)
  return /^dm26ex2-(?!preview-)/.test(key)
}

function printingIdentity(printing: Printing, canonicalAliases: Map<string, string>) {
  const number = normalizeKey(printing.card_number)
  if (number) return `number:${number}`

  const sourceKey = normalizeKey(printing.source_key)
  return `source:${canonicalAliases.get(sourceKey) ?? sourceKey}`
}

function uniqueFacesForPrinting(faces: Face[]) {
  const unique = new Map<string, Face>()
  for (const face of faces) {
    const key = `${face.side_index}:${normalizeKey(face.side_kind) || 'front'}`
    const existing = unique.get(key)
    if (!existing) {
      unique.set(key, face)
      continue
    }

    // 同一収録版・同一面が二重登録されている場合は、情報が多い方だけを残す。
    const existingScore = Number(Boolean(existing.image_url)) + Number(Boolean(existing.official_page_url))
    const currentScore = Number(Boolean(face.image_url)) + Number(Boolean(face.official_page_url))
    if (currentScore > existingScore) unique.set(key, face)
  }
  return [...unique.values()].sort((a, b) => a.side_index - b.side_index)
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
      ? 'id,name,name_kana,image_url,cost,civilization,card_type,card_printings(id,source_key,official_page_url,image_url,set_name,card_number,is_search_visible),card_faces(card_printing_id,side_index,side_kind,name,name_kana,image_url,official_page_url)'
      : 'id,name,name_kana,image_url,cost,civilization,card_type,card_printings(id,source_key,official_page_url,image_url,set_name,card_number,is_search_visible)'
    const { data, error } = await admin
      .from('cards')
      .select(columns)
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ cards: [] }, { status: 404 })

    const row = data as unknown as Row
    const detailNames = [...new Set([row.name, ...(row.card_faces ?? []).map(face => face.name)])]
    const detailResult = await admin.from('zukan_cards').select('name,race,ability_text').in('name', detailNames).limit(20)
    const detailsByName = new Map<string, ZukanDetail>(((detailResult.error ? [] : detailResult.data ?? []) as ZukanDetail[]).map(detail => [detail.name, detail]))
    const printingKeys = (row.card_printings ?? []).map((printing) => normalizeKey(printing.source_key)).filter(Boolean)
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

    const allVisiblePrintings = (row.card_printings ?? [])
      .filter((printing) => Boolean(printing.source_key) && printing.is_search_visible)
      .sort(compareNewest)

    // The DM26-EX2 preview seed used DM26EX2-PREVIEW-* keys. Once an official
    // DM26EX2-* printing exists for the same logical card, those preview rows must
    // never be shown. This explicit guard does not depend on aliases, card_number,
    // image URLs, or a cleanup migration, so it also works against resurrected rows.
    const hasOfficialCharismaPrinting = allVisiblePrintings.some((printing) => isCharismaOfficialKey(printing.source_key))
    const visiblePrintings = hasOfficialCharismaPrinting
      ? allVisiblePrintings.filter((printing) => !isCharismaPreviewKey(printing.source_key))
      : allVisiblePrintings

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
        const faces = uniqueFacesForPrinting(
          (row.card_faces ?? []).filter((face) => face.card_printing_id === printing.id),
        )
        const singleFrontFace = faces.length === 1
          && faces[0].side_index === 0
          && (faces[0].side_kind === null || faces[0].side_kind === 'front')
        if (!faces.length || singleFrontFace) {
          const front = faces[0]
          return [{
            id: row.id,
            name: front?.name ?? row.name,
            nameKana: front?.name_kana ?? row.name_kana,
            imageUrl: front?.image_url ?? printing.image_url ?? row.image_url,
            officialPageUrl: front?.official_page_url ?? printing.official_page_url ?? `https://dm.takaratomy.co.jp/card/detail/?id=${encodeURIComponent(printing.source_key)}`,
            printingId: printing.id,
            sourceKey: printing.source_key,
            cost: row.cost,
            civilization: row.civilization ?? [],
            cardType: row.card_type,
            race: detailsByName.get(front?.name ?? row.name)?.race ?? null,
            abilityText: detailsByName.get(front?.name ?? row.name)?.ability_text ?? null,
            setName: printing.set_name,
            cardNumber: printing.card_number,
          }]
        }
        return faces.map((face) => ({
          id: row.id,
          name: face.name,
          nameKana: face.name_kana ?? row.name_kana,
          imageUrl: face.image_url ?? printing.image_url ?? row.image_url,
          officialPageUrl: face.official_page_url ?? printing.official_page_url,
          printingId: printing.id,
          sourceKey: printing.source_key,
          cost: row.cost,
          civilization: row.civilization ?? [],
          cardType: row.card_type,
          race: detailsByName.get(face.name)?.race ?? null,
          abilityText: detailsByName.get(face.name)?.ability_text ?? null,
          setName: printing.set_name,
          cardNumber: printing.card_number,
          matchedFace: { name: face.name, imageUrl: face.image_url, sideIndex: face.side_index, sideKind: face.side_kind },
        }))
      })

    if (!cards.length) {
      const detail = detailsByName.get(row.name)
      cards.push({ id: row.id, name: row.name, nameKana: row.name_kana, imageUrl: row.image_url, officialPageUrl: null, sourceKey: null, cost: row.cost, civilization: row.civilization ?? [], cardType: row.card_type, race: detail?.race ?? null, abilityText: detail?.ability_text ?? null })
    }

    const seenImage = new Set<string>()
    const dedupedCards = cards.filter((card) => {
      const key = card.imageUrl ?? `no-image:${card.sourceKey ?? card.name}`
      if (seenImage.has(key)) return false
      seenImage.add(key)
      return true
    })

    return NextResponse.json({ cards: dedupedCards }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[cards/printings] printing list fetch failed', { cardId: id, message })
    return NextResponse.json({ error: '収録版の取得に失敗しました' }, { status: 500 })
  }
}
