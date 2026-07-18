import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { normalizeCardName } from '@/lib/card-name'
import { canAccessDeckMaker } from '@/lib/deck-maker-access'
import { LOCAL_DECK_CARDS, matchesCard, type DeckCard } from '@/lib/deck-maker'

export const dynamic = 'force-dynamic'
const MAX_QUERY_LENGTH = 80
const QUERY_BATCH_SIZE = 500
const CATALOG_BATCH_SIZE = 1000
const CATALOG_CACHE_MS = 15 * 60 * 1000
const DEFAULT_RESULTS = 32
const DEFAULT_PAGE_SIZE = 48
const MAX_PAGE_SIZE = 100
const CHARISMA_BEST_DEFAULT_SOURCE_KEYS = [
  'dm26ex2-SPR001', 'dm26ex2-SPR002', 'dm26ex2-SPR003', 'dm26ex2-SPR004', 'dm26ex2-SPR005',
  'dm26ex2-PR001', 'dm26ex2-PR002', 'dm26ex2-PR003', 'dm26ex2-PR004', 'dm26ex2-PR005',
  'dm26ex2-PR006', 'dm26ex2-PR007', 'dm26ex2-PR008', 'dm26ex2-PR009', 'dm26ex2-PR010',
  'dm26ex2-MC001', 'dm26ex2-MC002', 'dm26ex2-MC003', 'dm26ex2-MC004', 'dm26ex2-MC005',
  'dm26ex2-MC006', 'dm26ex2-MC007', 'dm26ex2-MC008', 'dm26ex2-MC009', 'dm26ex2-MC010',
  'dm26ex2-MC011', 'dm26ex2-MC012', 'dm26ex2-MC013', 'dm26ex2-MC014', 'dm26ex2-MC015',
  'dm26ex2-MC016', 'dm26ex2-MC017',
] as const

type Printing = {
  id: string
  source_key: string
  official_page_url: string | null
  image_url: string | null
  set_name: string | null
  is_representative: boolean
  is_search_visible: boolean
}

type Row = {
  id: string
  name: string
  normalized_name: string
  name_kana: string | null
  image_url: string | null
  card_printings?: Printing[]
  card_faces?: Face[]
  matched_face?: Face | null
}

type Face = {
  card_id?: string
  side_index: number
  side_kind: string | null
  name: string
  normalized_name: string
  name_kana: string | null
  image_url: string | null
  official_page_url: string | null
  card_printing_id: string | null
}

const searchCache = new Map<string, { rows: Row[]; expiresAt: number }>()
let catalogCache: { rows: Row[]; expiresAt: number } | null = null

const releaseCollator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' })

function setCode(printing: Printing | undefined) {
  return printing?.source_key.split('-')[0]?.toUpperCase() ?? ''
}

function comparePrintingsNewest(first: Printing, second: Printing) {
  return releaseCollator.compare(setCode(second), setCode(first))
    || releaseCollator.compare(second.source_key, first.source_key)
}

function newestPrinting(row: Row) {
  return row.card_printings?.filter((printing) => printing.is_search_visible).sort(comparePrintingsNewest)[0]
}

function compareRowsNewest(first: Row, second: Row) {
  const firstPrinting = newestPrinting(first)
  const secondPrinting = newestPrinting(second)
  return releaseCollator.compare(setCode(secondPrinting), setCode(firstPrinting))
    || releaseCollator.compare(secondPrinting?.source_key ?? '', firstPrinting?.source_key ?? '')
    || first.name.localeCompare(second.name, 'ja')
    || first.id.localeCompare(second.id)
}

function mapCard(row: Row, selectedPrinting?: Printing): DeckCard {
  const printing = selectedPrinting
    ?? (row.matched_face?.card_printing_id
      ? row.card_printings?.find((item) => item.id === row.matched_face?.card_printing_id && item.is_search_visible)
      : undefined)
    ?? newestPrinting(row)
    ?? row.card_printings?.find((item) => item.is_search_visible && item.is_representative)
    ?? row.card_printings?.find((item) => item.is_search_visible)
  const face = row.matched_face
  return {
    id: row.id,
    name: face?.name ?? row.name,
    nameKana: face?.name_kana ?? row.name_kana,
    imageUrl: face?.image_url ?? printing?.image_url ?? row.image_url,
    officialPageUrl: face?.official_page_url ?? printing?.official_page_url ?? null,
    sourceKey: printing?.source_key ?? null,
    matchedFace: face ? { name: face.name, imageUrl: face.image_url, sideIndex: face.side_index, sideKind: face.side_kind } : null,
  }
}

async function loadFaceMatches(supabase: ReturnType<typeof createAdminClient>, field: 'normalized_name' | 'name_kana', query: string) {
  const faces: Face[] = []
  for (let offset = 0; ; offset += QUERY_BATCH_SIZE) {
    const result = await supabase.from('card_faces')
      .select('card_id,side_index,side_kind,name,normalized_name,name_kana,image_url,official_page_url,card_printing_id')
      .ilike(field, `%${escapeLikePattern(query)}%`).order('id').range(offset, offset + QUERY_BATCH_SIZE - 1)
    if (result.error) throw result.error
    const batch = (result.data ?? []) as Face[]
    faces.push(...batch)
    if (batch.length < QUERY_BATCH_SIZE) break
  }
  return faces
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}

async function loadMatches(
  supabase: ReturnType<typeof createAdminClient>,
  columns: string,
  field: 'normalized_name' | 'name_kana',
  query: string,
) {
  const rows: Row[] = []
  for (let offset = 0; ; offset += QUERY_BATCH_SIZE) {
    const result = await supabase
      .from('cards')
      .select(columns)
      .eq('is_active', true)
      .ilike(field, `%${escapeLikePattern(query)}%`)
      .order('id')
      .range(offset, offset + QUERY_BATCH_SIZE - 1)
    if (result.error) throw result.error
    const batch = (result.data ?? []) as unknown as Row[]
    rows.push(...batch)
    if (batch.length < QUERY_BATCH_SIZE) break
  }
  return rows
}

async function getMatches(supabase: ReturnType<typeof createAdminClient>, columns: string, normalizedQuery: string, kanaQuery: string, facesAvailable: boolean) {
  const cacheKey = `${normalizedQuery}\u0000${kanaQuery}`
  const cached = searchCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.rows

  const [nameRows, kanaRows, faceNameRows, faceKanaRows] = await Promise.all([
    loadMatches(supabase, columns, 'normalized_name', normalizedQuery),
    loadMatches(supabase, columns, 'name_kana', kanaQuery),
    facesAvailable ? loadFaceMatches(supabase, 'normalized_name', normalizedQuery) : Promise.resolve([]),
    facesAvailable ? loadFaceMatches(supabase, 'name_kana', kanaQuery) : Promise.resolve([]),
  ])
  const faces = [...faceNameRows, ...faceKanaRows]
  const faceByCard = new Map<string, Face>()
  for (const face of faces) if (face.card_id && !faceByCard.has(face.card_id)) faceByCard.set(face.card_id, face)
  const faceCardIds = [...faceByCard.keys()]
  const faceRows: Row[] = []
  for (let index = 0; index < faceCardIds.length; index += 500) {
    const result = await supabase.from('cards').select(columns).eq('is_active', true).in('id', faceCardIds.slice(index, index + 500))
    if (result.error) throw result.error
    faceRows.push(...(result.data ?? []) as unknown as Row[])
  }
  const unique = new Map<string, Row>()
  for (const row of [...nameRows, ...kanaRows]) unique.set(row.id, { ...row, matched_face: null })
  for (const row of faceRows) unique.set(row.id, { ...row, matched_face: faceByCard.get(row.id) ?? null })
  const rows = [...unique.values()].sort(compareRowsNewest)
  if (searchCache.size >= 100) searchCache.delete(searchCache.keys().next().value ?? '')
  searchCache.set(cacheKey, { rows, expiresAt: Date.now() + CATALOG_CACHE_MS })
  return rows
}

async function getCatalog(supabase: ReturnType<typeof createAdminClient>, columns: string) {
  if (catalogCache && catalogCache.expiresAt > Date.now()) return catalogCache.rows
  const rows: Row[] = []
  for (let offset = 0; ; offset += CATALOG_BATCH_SIZE) {
    const result = await supabase
      .from('cards')
      .select(columns)
      .eq('is_active', true)
      .order('id')
      .range(offset, offset + CATALOG_BATCH_SIZE - 1)
    if (result.error) throw result.error
    const batch = (result.data ?? []) as unknown as Row[]
    rows.push(...batch)
    if (batch.length < CATALOG_BATCH_SIZE) break
  }
  rows.sort(compareRowsNewest)
  catalogCache = { rows, expiresAt: Date.now() + CATALOG_CACHE_MS }
  return rows
}

export async function GET(request: NextRequest) {
  if (!(await canAccessDeckMaker())) return new NextResponse(null, { status: 404 })

  const rawQuery = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (rawQuery.length > MAX_QUERY_LENGTH || /[\u0000-\u001f\u007f]/.test(rawQuery)) return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  const normalizedQuery = normalizeCardName(rawQuery)
  const kanaQuery = rawQuery.normalize('NFKC')
  const requestedOffset = Number(request.nextUrl.searchParams.get('offset') ?? '0')
  const requestedLimit = Number(request.nextUrl.searchParams.get('limit') ?? String(DEFAULT_PAGE_SIZE))
  const offset = Number.isInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0
  const limit = Number.isInteger(requestedLimit) ? Math.min(MAX_PAGE_SIZE, Math.max(DEFAULT_PAGE_SIZE, requestedLimit)) : DEFAULT_PAGE_SIZE
  try {
    const supabase = createAdminClient()
    const faceProbe = await supabase.from('card_faces').select('id', { head: true, count: 'exact' }).limit(1)
    const facesAvailable = !faceProbe.error
    const columns = 'id,name,normalized_name,name_kana,image_url,card_printings(id,source_key,official_page_url,image_url,set_name,is_representative,is_search_visible)'
    if (!rawQuery) {
      const catalog = await getCatalog(supabase, columns)
      const featured = new Map<string, DeckCard>()
      const bySourceKey = new Map(catalog.flatMap((row) => (row.card_printings ?? []).filter((printing) => printing.is_search_visible).map((printing) => [printing.source_key, { row, printing }] as const)))
      for (const sourceKey of CHARISMA_BEST_DEFAULT_SOURCE_KEYS) {
        const selected = bySourceKey.get(sourceKey)
        if (!selected) continue
        const card = mapCard(selected.row, selected.printing)
        featured.set(card.id, card)
      }

      const featuredCards = [...featured.values()]
      const featuredCount = featuredCards.length
      const regularOffset = Math.max(0, offset - featuredCount)
      const regularLimit = offset === 0 ? Math.max(0, limit - featuredCount) : limit
      const regularCatalog = catalog.filter((row) => !featured.has(row.id))
      const regularRows = regularCatalog.slice(regularOffset, regularOffset + regularLimit)

      const cards = [...(offset === 0 ? featuredCards : []), ...regularRows.map((row) => mapCard(row))]
      const total = featuredCount + regularCatalog.length
      const nextOffset = offset + cards.length
      return NextResponse.json({ cards, total, hasMore: nextOffset < total, nextOffset }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
    }

    const matches = await getMatches(supabase, columns, normalizedQuery, kanaQuery, facesAvailable)
    const rows = matches.slice(offset, offset + limit)
    const cards = rows.map((row) => mapCard(row))
    const nextOffset = offset + cards.length
    return NextResponse.json({ cards, total: matches.length, hasMore: nextOffset < matches.length, nextOffset }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
  } catch {
    const allCards = rawQuery ? LOCAL_DECK_CARDS.filter((card) => matchesCard(card, rawQuery)) : LOCAL_DECK_CARDS
    const cards = rawQuery ? allCards : allCards.slice(0, DEFAULT_RESULTS)
    return NextResponse.json({ cards, total: allCards.length, hasMore: false, nextOffset: cards.length, fallback: true }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
  }
}
