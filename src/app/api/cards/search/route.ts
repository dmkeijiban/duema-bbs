import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { normalizeCardName } from '@/lib/card-name'
import { canAccessDeckMaker } from '@/lib/deck-maker-access'
import { LOCAL_DECK_CARDS, matchesCard, type DeckCard } from '@/lib/deck-maker'
import { parseSelectMakerConfig } from '@/lib/maker'
import { compareCardPrintingsOfficial } from '@/lib/card-printing-order'

export const dynamic = 'force-dynamic'
const MAX_QUERY_LENGTH = 80
const QUERY_BATCH_SIZE = 500
const CATALOG_BATCH_SIZE = 1000
const CATALOG_CACHE_MS = 15 * 60 * 1000
const DEFAULT_RESULTS = 32
const DEFAULT_PAGE_SIZE = 48
const MAX_PAGE_SIZE = 100
const BROWSER_CACHE_HEADER = 'private, max-age=60, stale-while-revalidate=300'

type Printing = {
  id: string
  source_key: string
  official_page_url: string | null
  image_url: string | null
  set_name: string | null
  card_number: string | null
  release_date: string | null
  official_sort_position: number | null
  is_representative: boolean
  is_search_visible: boolean
}

type Row = {
  id: string
  name: string
  normalized_name: string
  name_kana: string | null
  image_url: string | null
  cost: number | null
  civilization: string[] | null
  card_type: string | null
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

type CatalogItem = { row: Row; printing: Printing; matchedFace: Face | null }

const searchCache = new Map<string, { rows: CatalogItem[]; expiresAt: number }>()
let catalogCache: { rows: CatalogItem[]; expiresAt: number } | null = null
let supersededKeysCache: { keys: Set<string>; expiresAt: number } | null = null

// source_keys recorded as old_source_key in card_printing_source_aliases are superseded
// preview identities; re-imports can resurrect them as extra printings of the same card.
// Fail open: on any error treat the set as empty rather than hiding real printings.
async function getSupersededKeys(supabase: ReturnType<typeof createAdminClient>) {
  if (supersededKeysCache && supersededKeysCache.expiresAt > Date.now()) return supersededKeysCache.keys
  const result = await supabase.from('card_printing_source_aliases').select('old_source_key').limit(5000)
  const keys = new Set<string>((result.error ? [] : result.data ?? []).map((row) => row.old_source_key))
  supersededKeysCache = { keys, expiresAt: Date.now() + CATALOG_CACHE_MS }
  return keys
}

function stripSupersededPrintings(rows: Row[], supersededKeys: Set<string>) {
  if (!supersededKeys.size) return rows
  return rows.map((row) => ({
    ...row,
    card_printings: row.card_printings?.filter((printing) => !supersededKeys.has(printing.source_key)),
  }))
}

function newestPrinting(row: Row) {
  return row.card_printings?.filter((printing) => printing.is_search_visible).sort(compareCardPrintingsOfficial)[0]
}

function compareCatalogItems(first: CatalogItem, second: CatalogItem) {
  return compareCardPrintingsOfficial(first.printing, second.printing)
}

function mapCard(row: Row, selectedPrinting?: Printing, matchedFace = row.matched_face ?? null): DeckCard {
  const printing = selectedPrinting
    ?? (row.matched_face?.card_printing_id
      ? row.card_printings?.find((item) => item.id === row.matched_face?.card_printing_id && item.is_search_visible)
      : undefined)
    ?? newestPrinting(row)
    ?? row.card_printings?.find((item) => item.is_search_visible && item.is_representative)
    ?? row.card_printings?.find((item) => item.is_search_visible)
  const face = matchedFace?.card_printing_id === printing?.id ? matchedFace : null
  return {
    id: row.id,
    printingId: printing?.id ?? null,
    name: face?.name ?? row.name,
    nameKana: face?.name_kana ?? row.name_kana,
    imageUrl: face?.image_url ?? printing?.image_url ?? row.image_url,
    officialPageUrl: face?.official_page_url ?? printing?.official_page_url ?? null,
    sourceKey: printing?.source_key ?? null,
    cost: row.cost,
    civilization: row.civilization ?? [],
    cardType: row.card_type,
    matchedFace: face ? { name: face.name, imageUrl: face.image_url, sideIndex: face.side_index, sideKind: face.side_kind } : null,
  }
}

// One catalog entry per logical card (never per printing), so a card with
// several official/foil printings still shows up exactly once in the browse list.
function toCatalog(rows: Row[]): CatalogItem[] {
  const items: CatalogItem[] = []
  for (const row of rows) {
    const printing = newestPrinting(row)
    if (!printing) continue
    items.push({ row, printing, matchedFace: null })
  }
  return items.sort(compareCatalogItems)
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

  const [rawNameRows, rawKanaRows, faceNameRows, faceKanaRows, supersededKeys] = await Promise.all([
    loadMatches(supabase, columns, 'normalized_name', normalizedQuery),
    loadMatches(supabase, columns, 'name_kana', kanaQuery),
    facesAvailable ? loadFaceMatches(supabase, 'normalized_name', normalizedQuery) : Promise.resolve([]),
    facesAvailable ? loadFaceMatches(supabase, 'name_kana', kanaQuery) : Promise.resolve([]),
    getSupersededKeys(supabase),
  ])
  const nameRows = stripSupersededPrintings(rawNameRows, supersededKeys)
  const kanaRows = stripSupersededPrintings(rawKanaRows, supersededKeys)
  const faces = [...faceNameRows, ...faceKanaRows]
  const frontMatchedCardIds = new Set([...nameRows, ...kanaRows].map((row) => row.id))
  const faceByPrinting = new Map<string, Face>()
  const faceCardIds = new Set<string>()
  for (const face of faces) {
    if (face.card_id) faceCardIds.add(face.card_id)
    if (face.card_printing_id && !faceByPrinting.has(face.card_printing_id)) faceByPrinting.set(face.card_printing_id, face)
  }
  const faceRows: Row[] = []
  const faceIds = [...faceCardIds]
  for (let index = 0; index < faceIds.length; index += 500) {
    const result = await supabase.from('cards').select(columns).eq('is_active', true).in('id', faceIds.slice(index, index + 500))
    if (result.error) throw result.error
    faceRows.push(...stripSupersededPrintings((result.data ?? []) as unknown as Row[], supersededKeys))
  }
  const unique = new Map<string, Row>()
  for (const row of [...nameRows, ...kanaRows]) unique.set(row.id, { ...row, matched_face: null })
  for (const row of faceRows) unique.set(row.id, row)

  // A card appears once per genuine hit: once for its own name/kana match (its
  // default printing), plus once per distinct printing whose *face* matched the
  // query (e.g. a twinpact back side). It never appears once per unrelated printing.
  const items: CatalogItem[] = []
  for (const row of unique.values()) {
    let matchedAnyFace = false
    for (const printing of (row.card_printings ?? []).filter((p) => p.is_search_visible)) {
      const face = faceByPrinting.get(printing.id)
      if (!face) continue
      matchedAnyFace = true
      items.push({ row, printing, matchedFace: face })
    }
    if (frontMatchedCardIds.has(row.id) && !matchedAnyFace) {
      const printing = newestPrinting(row)
      if (printing) items.push({ row, printing, matchedFace: null })
    }
  }
  const rows = items.sort(compareCatalogItems)
  if (searchCache.size >= 100) searchCache.delete(searchCache.keys().next().value ?? '')
  searchCache.set(cacheKey, { rows, expiresAt: Date.now() + CATALOG_CACHE_MS })
  return rows
}

async function getCatalog(supabase: ReturnType<typeof createAdminClient>, columns: string) {
  if (catalogCache && catalogCache.expiresAt > Date.now()) return catalogCache.rows
  const sourceRows: Row[] = []
  for (let offset = 0; ; offset += CATALOG_BATCH_SIZE) {
    const result = await supabase
      .from('cards')
      .select(columns)
      .eq('is_active', true)
      .order('id')
      .range(offset, offset + CATALOG_BATCH_SIZE - 1)
    if (result.error) throw result.error
    const batch = (result.data ?? []) as unknown as Row[]
    sourceRows.push(...batch)
    if (batch.length < CATALOG_BATCH_SIZE) break
  }
  const supersededKeys = await getSupersededKeys(supabase)
  const rows = toCatalog(stripSupersededPrintings(sourceRows, supersededKeys))
  catalogCache = { rows, expiresAt: Date.now() + CATALOG_CACHE_MS }
  return rows
}

async function getFastInitialCatalog(supabase: ReturnType<typeof createAdminClient>, makerCardPool: Set<string> | null) {
  // Over-fetch printings (several per card are common now) so that after
  // collapsing to one row per card we still have enough to fill the page.
  const supersededKeys = await getSupersededKeys(supabase)
  const result = await supabase.from('card_printings')
    .select('id,source_key,official_page_url,image_url,set_name,card_number,release_date,official_sort_position,is_representative,is_search_visible,cards!inner(id,name,normalized_name,name_kana,image_url,cost,civilization,card_type,is_active)')
    .eq('cards.is_active', true)
    .eq('is_search_visible', true)
    .order('official_sort_position', { ascending: true, nullsFirst: false })
    .limit(makerCardPool ? 2000 : DEFAULT_RESULTS * 8)
  if (result.error) throw result.error
  const seen = new Set<string>()
  const cards: DeckCard[] = []
  for (const printing of result.data ?? []) {
    const card = Array.isArray(printing.cards) ? printing.cards[0] : printing.cards
    if (!card || seen.has(card.id) || supersededKeys.has(printing.source_key) || (makerCardPool && !makerCardPool.has(card.id))) continue
    seen.add(card.id)
    cards.push(mapCard(card as Row, printing as unknown as Printing))
    if (!makerCardPool && cards.length >= DEFAULT_RESULTS) break
  }
  return cards.slice(0, DEFAULT_RESULTS)
}

async function getMakerCardPool(supabase: ReturnType<typeof createAdminClient>, makerSlug: string) {
  if (!makerSlug) return null
  if (!/^[a-z0-9-]{1,80}$/.test(makerSlug)) throw new Error('invalid_maker')
  const { data: project } = await supabase.from('maker_projects').select('id,type,config').eq('slug', makerSlug).eq('status', 'published').eq('is_public', true).maybeSingle()
  if (!project || project.type !== 'select') throw new Error('maker_not_found')
  if (parseSelectMakerConfig(project.config).cardPool !== 'manual') return null
  const { data, error } = await supabase.from('maker_project_cards').select('card_id').eq('project_id', project.id).limit(5000)
  if (error) throw error
  return new Set((data ?? []).map(row => row.card_id))
}

export async function GET(request: NextRequest) {
  if (!(await canAccessDeckMaker())) return new NextResponse(null, { status: 404 })

  const rawQuery = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const makerSlug = request.nextUrl.searchParams.get('makerSlug')?.trim() ?? ''
  const fastInitial = request.nextUrl.searchParams.get('fastInitial') === '1'
  if (rawQuery.length > MAX_QUERY_LENGTH || /[\u0000-\u001f\u007f]/.test(rawQuery)) return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  const normalizedQuery = normalizeCardName(rawQuery)
  const kanaQuery = rawQuery.normalize('NFKC')
  const requestedOffset = Number(request.nextUrl.searchParams.get('offset') ?? '0')
  const requestedLimit = Number(request.nextUrl.searchParams.get('limit') ?? String(DEFAULT_PAGE_SIZE))
  const offset = Number.isInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0
  const limit = Number.isInteger(requestedLimit) ? Math.min(MAX_PAGE_SIZE, Math.max(DEFAULT_PAGE_SIZE, requestedLimit)) : DEFAULT_PAGE_SIZE
  try {
    const supabase = createAdminClient()
    const makerCardPool = await getMakerCardPool(supabase, makerSlug)
    const columns = 'id,name,normalized_name,name_kana,image_url,cost,civilization,card_type,card_printings(id,source_key,official_page_url,image_url,set_name,card_number,release_date,official_sort_position,is_representative,is_search_visible)'
    if (!rawQuery && fastInitial && offset === 0) {
      const cards = await getFastInitialCatalog(supabase, makerCardPool)
      if (cards.length > 0) {
        return NextResponse.json({ cards, hasMore: true, nextOffset: cards.length }, { headers: { 'Cache-Control': BROWSER_CACHE_HEADER } })
      }
    }
    const faceProbe = await supabase.from('card_faces').select('id', { head: true, count: 'exact' }).limit(1)
    const facesAvailable = !faceProbe.error
    if (!rawQuery) {
      const fullCatalog = await getCatalog(supabase, columns)
      const catalog = makerCardPool ? fullCatalog.filter(item => makerCardPool.has(item.row.id)) : fullCatalog
      const items = catalog.slice(offset, offset + limit)
      const cards = items.map((item) => mapCard(item.row, item.printing, item.matchedFace))
      const total = catalog.length
      const nextOffset = offset + cards.length
      return NextResponse.json({ cards, total, hasMore: nextOffset < total, nextOffset }, { headers: { 'Cache-Control': BROWSER_CACHE_HEADER } })
    }

    const allMatches = await getMatches(supabase, columns, normalizedQuery, kanaQuery, facesAvailable)
    const matches = makerCardPool ? allMatches.filter(item => makerCardPool.has(item.row.id)) : allMatches
    const rows = matches.slice(offset, offset + limit)
    const cards = rows.map((item) => mapCard(item.row, item.printing, item.matchedFace))
    const nextOffset = offset + cards.length
    return NextResponse.json({ cards, total: matches.length, hasMore: nextOffset < matches.length, nextOffset }, { headers: { 'Cache-Control': BROWSER_CACHE_HEADER } })
  } catch {
    if (makerSlug) return NextResponse.json({ error: 'maker_not_found' }, { status: 404 })
    const allCards = rawQuery ? LOCAL_DECK_CARDS.filter((card) => matchesCard(card, rawQuery)) : LOCAL_DECK_CARDS
    const cards = rawQuery ? allCards : allCards.slice(0, DEFAULT_RESULTS)
    return NextResponse.json({ cards, total: allCards.length, hasMore: false, nextOffset: cards.length, fallback: true }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
  }
}
