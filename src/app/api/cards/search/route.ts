import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { normalizeCardName } from '@/lib/card-name'
import { canAccessDeckMaker } from '@/lib/deck-maker-access'
import { LOCAL_DECK_CARDS, matchesCard, type DeckCard, type DeckZoneClass } from '@/lib/deck-maker'
import { parseSelectMakerConfig } from '@/lib/maker'
import { compareCardPrintingsOfficial } from '@/lib/card-printing-order'

const SORT_VALUES = ['relevance', 'usage_desc', 'kana_asc', 'kana_desc', 'cost_asc', 'cost_desc'] as const
type CatalogSort = typeof SORT_VALUES[number]
function readSort(request: NextRequest): CatalogSort {
  const value = request.nextUrl.searchParams.get('sort')
  return (SORT_VALUES as readonly string[]).includes(value ?? '') ? (value as CatalogSort) : 'relevance'
}

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
  deck_zone_class: string | null
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

function mapCard(row: Row, selectedPrinting?: Printing, matchedFace = row.matched_face ?? null, usageCount?: number): DeckCard {
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
    deckZoneClass: (row.deck_zone_class as DeckZoneClass | null) ?? 'normal',
    usageCount: usageCount ?? null,
    matchedFace: face ? { name: face.name, imageUrl: face.image_url, sideIndex: face.side_index, sideKind: face.side_kind } : null,
  }
}

let usageCountsCache: { counts: Map<string, number>; expiresAt: number } | null = null
async function getUsageCounts(supabase: ReturnType<typeof createAdminClient>) {
  if (usageCountsCache && usageCountsCache.expiresAt > Date.now()) return usageCountsCache.counts
  const counts = new Map<string, number>()
  for (let offset = 0; ; offset += CATALOG_BATCH_SIZE) {
    const result = await supabase.from('card_usage_counts').select('card_id,usage_count').range(offset, offset + CATALOG_BATCH_SIZE - 1)
    if (result.error) break // fail open: usage-count sort just falls back to 0s
    const batch = result.data ?? []
    for (const row of batch) counts.set(row.card_id, row.usage_count ?? 0)
    if (batch.length < CATALOG_BATCH_SIZE) break
  }
  usageCountsCache = { counts, expiresAt: Date.now() + CATALOG_CACHE_MS }
  return counts
}

// 関連度順に相当するデッキ内容ベースの共起データは現状存在しないため、
// クエリなし時は採用枚数順へフォールバックする（調査記録の推奨仕様どおり）。
function sortCatalogItems(items: CatalogItem[], sort: CatalogSort, usageCounts: Map<string, number>, hasQuery: boolean): CatalogItem[] {
  const effectiveSort = sort === 'relevance' && !hasQuery ? 'usage_desc' : sort
  if (effectiveSort === 'relevance') return items
  const withKey = items.map((item, index) => ({ item, index }))
  const compare = {
    usage_desc: (a: typeof withKey[number], b: typeof withKey[number]) => (usageCounts.get(b.item.row.id) ?? 0) - (usageCounts.get(a.item.row.id) ?? 0),
    kana_asc: (a: typeof withKey[number], b: typeof withKey[number]) => (a.item.row.name_kana || a.item.row.normalized_name).localeCompare(b.item.row.name_kana || b.item.row.normalized_name, 'ja'),
    kana_desc: (a: typeof withKey[number], b: typeof withKey[number]) => (b.item.row.name_kana || b.item.row.normalized_name).localeCompare(a.item.row.name_kana || a.item.row.normalized_name, 'ja'),
    cost_asc: (a: typeof withKey[number], b: typeof withKey[number]) => (a.item.row.cost ?? Number.MAX_SAFE_INTEGER) - (b.item.row.cost ?? Number.MAX_SAFE_INTEGER),
    cost_desc: (a: typeof withKey[number], b: typeof withKey[number]) => {
      const costA = a.item.row.cost, costB = b.item.row.cost
      if (costA == null && costB == null) return 0
      if (costA == null) return 1 // null always last, both ascending and descending
      if (costB == null) return -1
      return costB - costA
    },
  }[effectiveSort]
  return withKey.sort((a, b) => compare(a, b) || a.index - b.index).map(({ item }) => item)
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
  // collapsing to one row per card we still have enough to fill the page, and so
  // there is a large-enough pool to reorder by usage count before truncating.
  const [supersededKeys, usageCounts] = await Promise.all([getSupersededKeys(supabase), getUsageCounts(supabase)])
  const result = await supabase.from('card_printings')
    .select('id,source_key,official_page_url,image_url,set_name,card_number,release_date,official_sort_position,is_representative,is_search_visible,cards!inner(id,name,normalized_name,name_kana,image_url,cost,civilization,card_type,deck_zone_class,is_active)')
    .eq('cards.is_active', true)
    .eq('is_search_visible', true)
    .order('official_sort_position', { ascending: true, nullsFirst: false })
    .limit(makerCardPool ? 2000 : DEFAULT_RESULTS * 8)
  if (result.error) throw result.error
  const seen = new Set<string>()
  const cards: { card: DeckCard; row: Row }[] = []
  for (const printing of result.data ?? []) {
    const card = Array.isArray(printing.cards) ? printing.cards[0] : printing.cards
    if (!card || seen.has(card.id) || supersededKeys.has(printing.source_key) || (makerCardPool && !makerCardPool.has(card.id))) continue
    seen.add(card.id)
    cards.push({ card: mapCard(card as Row, printing as unknown as Printing, null, usageCounts.get(card.id) ?? 0), row: card as Row })
  }
  // No relation-based relevance data exists (see docs/research/dmhub-advance-investigation.md),
  // so the initial no-query browsing order falls back to usage count, matching every
  // other "relevance" fallback in this route.
  const sorted = [...cards].sort((a, b) => (usageCounts.get(b.row.id) ?? 0) - (usageCounts.get(a.row.id) ?? 0))
  return sorted.slice(0, DEFAULT_RESULTS).map(({ card }) => card)
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

type CatalogFilters = { civilization: string[]; race: string[]; cardType: string[]; setName: string[] }

function readFilters(request: NextRequest): CatalogFilters {
  const read = (name: string) => request.nextUrl.searchParams.getAll(name).map(value => value.trim()).filter(value => value.length > 0 && value.length <= 80).slice(0, 8)
  return { civilization: read('civilization'), race: read('race'), cardType: read('cardType'), setName: read('setName') }
}

async function applyCatalogFilters(supabase: ReturnType<typeof createAdminClient>, items: CatalogItem[], filters: CatalogFilters) {
  // Civilization and type are OR-within-dimension (a card matching any selected
  // value passes), matching the confirmed DMHub-equivalent semantics in
  // docs/research/dmhub-advance-investigation.md. Set name stays AND-of-every
  // since a single printing can only belong to one set anyway (as before).
  let filtered = items.filter(item =>
    (filters.civilization.length === 0 || filters.civilization.some(value => (item.row.civilization ?? []).includes(value)))
    && (filters.cardType.length === 0 || filters.cardType.includes(item.row.card_type ?? ''))
    && filters.setName.every(value => item.row.card_printings?.some(printing => printing.set_name === value)),
  )
  for (const race of filters.race) {
    const { data, error } = await supabase.from('zukan_cards').select('name').ilike('race', `%${escapeLikePattern(race)}%`).limit(5000)
    if (error) throw error
    const names = new Set((data ?? []).map(row => row.name))
    filtered = filtered.filter(item => names.has(item.row.name) || (item.matchedFace && names.has(item.matchedFace.name)))
  }
  if (filters.setName.length) {
    filtered = filtered.map(item => ({ ...item, printing: item.row.card_printings?.find(printing => filters.setName.every(value => printing.set_name === value)) ?? item.printing }))
  }
  return filtered
}

export async function GET(request: NextRequest) {
  if (!(await canAccessDeckMaker())) return new NextResponse(null, { status: 404 })

  const rawQuery = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const makerSlug = request.nextUrl.searchParams.get('makerSlug')?.trim() ?? ''
  const fastInitial = request.nextUrl.searchParams.get('fastInitial') === '1'
  const sort = readSort(request)
  const filters = readFilters(request)
  const hasFilters = Object.values(filters).some(values => values.length > 0)
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
    const columns = 'id,name,normalized_name,name_kana,image_url,cost,civilization,card_type,deck_zone_class,card_printings(id,source_key,official_page_url,image_url,set_name,card_number,release_date,official_sort_position,is_representative,is_search_visible)'
    if (!rawQuery && !hasFilters && fastInitial && offset === 0) {
      const cards = await getFastInitialCatalog(supabase, makerCardPool)
      if (cards.length > 0) {
        return NextResponse.json({ cards, hasMore: true, nextOffset: cards.length }, { headers: { 'Cache-Control': BROWSER_CACHE_HEADER } })
      }
    }
    const faceProbe = await supabase.from('card_faces').select('id', { head: true, count: 'exact' }).limit(1)
    const facesAvailable = !faceProbe.error
    if (!rawQuery) {
      const fullCatalog = await getCatalog(supabase, columns)
      const makerCatalog = makerCardPool ? fullCatalog.filter(item => makerCardPool.has(item.row.id)) : fullCatalog
      const filteredCatalog = await applyCatalogFilters(supabase, makerCatalog, filters)
      const usageCounts = await getUsageCounts(supabase)
      const catalog = sortCatalogItems(filteredCatalog, sort, usageCounts, false)
      const items = catalog.slice(offset, offset + limit)
      const cards = items.map((item) => mapCard(item.row, item.printing, item.matchedFace, usageCounts.get(item.row.id) ?? 0))
      const total = catalog.length
      const nextOffset = offset + cards.length
      return NextResponse.json({ cards, total, hasMore: nextOffset < total, nextOffset }, { headers: { 'Cache-Control': BROWSER_CACHE_HEADER } })
    }

    const allMatches = await getMatches(supabase, columns, normalizedQuery, kanaQuery, facesAvailable)
    const makerMatches = makerCardPool ? allMatches.filter(item => makerCardPool.has(item.row.id)) : allMatches
    const filteredMatches = await applyCatalogFilters(supabase, makerMatches, filters)
    const usageCounts = await getUsageCounts(supabase)
    const matches = sortCatalogItems(filteredMatches, sort, usageCounts, true)
    const rows = matches.slice(offset, offset + limit)
    const cards = rows.map((item) => mapCard(item.row, item.printing, item.matchedFace, usageCounts.get(item.row.id) ?? 0))
    const nextOffset = offset + cards.length
    return NextResponse.json({ cards, total: matches.length, hasMore: nextOffset < matches.length, nextOffset }, { headers: { 'Cache-Control': BROWSER_CACHE_HEADER } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (makerSlug && (message === 'maker_not_found' || message === 'invalid_maker')) {
      return NextResponse.json({ error: message }, { status: message === 'invalid_maker' ? 400 : 404 })
    }
    console.error('[cards/search] catalog fetch failed, serving local fallback', {
      makerSlug: makerSlug || undefined,
      hasQuery: Boolean(rawQuery),
      fastInitial,
      message,
    })
    const allCards = rawQuery ? LOCAL_DECK_CARDS.filter((card) => matchesCard(card, rawQuery)) : LOCAL_DECK_CARDS
    const cards = rawQuery ? allCards : allCards.slice(0, DEFAULT_RESULTS)
    return NextResponse.json({ cards, total: allCards.length, hasMore: false, nextOffset: cards.length, fallback: true }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
  }
}
