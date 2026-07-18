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
const CHARISMA_BEST_DEFAULTS = [
  ['瀑水神 ミヅハノオオミカミ', '001'],
  ['世界竜皇 ボルシャック・ヒカリスマ', '002'],
  ['邪眼魔凰デス・フェニックス', '003'],
  ['SSS級侵略 カリスマゾーン', '004'],
  ['CRY-S-MAX ジャオウガ', '005'],
  ['引き裂かれし永劫、エムラクール', '006'],
  ['龍頭星雲人／零誕祭', '007'],
  ['超神星DOOM・ドラゲリオン', '008'],
  ['アーテル・ゴルギーニ', '009'],
  ['轟轟合体 ゴルギーオージャー', '010'],
  ['一音の妖精', '011'],
  ['ブレイン・スラッシュ', '012'],
  ['百鬼の邪王門', '013'],
  ['策士のシダン ニャハン', '014'],
  ['豊潤フォージュン', '015'],
  ['竜皇神 ボルシャック・バクテラス', '031'],
  ['CRYMAX ジャオウガ', '032'],
  ['伝説の正体 ギュウジン丸', '033'],
  ['絶望と反魂と滅殺の決断', '034'],
  ['煉獄邪神M・R・C・ロマノフ', '035'],
  ['禁断の轟速 ブラックゾーン', '036'],
  ['天罪堕将 アルカクラウン', '037'],
  ['魔誕導師ブラックルシファー', '038'],
  ['不敬合成王 ロマティックダム・アルキング', '039'],
  ['聖霊左神ジャスティス', '040'],
  ['DG ～裁キノ刻～', '041'],
  ['「ちくしょおおおおおおっー!!」', '042'],
  ['ヘブンズ・ゲート', '043'],
  ['ゴッド・ゲート', '044'],
  ['ゴッド・シグナル', '045'],
  ['邪妃左神 バンバーシュート', '046'],
  ['「覇〇魔ヴォゲンム」', '047'],
] as const
const charismaImageUrl = (number: string) => `https://dm.takaratomy.co.jp/wp-content/themes/dm2019/img/product/dm26ex2/all-precedence/${number}.jpg`

type Printing = {
  id: string
  source_key: string
  official_page_url: string | null
  image_url: string | null
  set_name: string | null
  is_representative: boolean
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
  return row.card_printings?.slice().sort(comparePrintingsNewest)[0]
}

function compareRowsNewest(first: Row, second: Row) {
  const firstPrinting = newestPrinting(first)
  const secondPrinting = newestPrinting(second)
  return releaseCollator.compare(setCode(secondPrinting), setCode(firstPrinting))
    || releaseCollator.compare(secondPrinting?.source_key ?? '', firstPrinting?.source_key ?? '')
    || first.name.localeCompare(second.name, 'ja')
    || first.id.localeCompare(second.id)
}

function mapCard(row: Row): DeckCard {
  const printing = row.matched_face?.card_printing_id
    ? row.card_printings?.find((item) => item.id === row.matched_face?.card_printing_id)
    : newestPrinting(row)
    ?? row.card_printings?.find((item) => item.is_representative)
    ?? row.card_printings?.[0]
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
    const columns = 'id,name,normalized_name,name_kana,image_url,card_printings(id,source_key,official_page_url,image_url,set_name,is_representative)'
    if (!rawQuery) {
      const catalog = await getCatalog(supabase, columns)
      const featured = new Map<string, DeckCard>()
      const rowsByName = new Map(catalog.map((row) => [normalizeCardName(row.name), row]))
      for (const [name, imageNumber] of CHARISMA_BEST_DEFAULTS) {
        const row = rowsByName.get(normalizeCardName(name))
        if (!row) continue
        const card = mapCard(row)
        featured.set(card.id, { ...card, imageUrl: charismaImageUrl(imageNumber) })
      }

      const featuredCards = [...featured.values()]
      const featuredCount = featuredCards.length
      const regularOffset = Math.max(0, offset - featuredCount)
      const regularLimit = offset === 0 ? Math.max(0, limit - featuredCount) : limit
      const regularCatalog = catalog.filter((row) => !featured.has(row.id))
      const regularRows = regularCatalog.slice(regularOffset, regularOffset + regularLimit)

      const cards = [...(offset === 0 ? featuredCards : []), ...regularRows.map(mapCard)]
      const total = featuredCount + regularCatalog.length
      const nextOffset = offset + cards.length
      return NextResponse.json({ cards, total, hasMore: nextOffset < total, nextOffset }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
    }

    const matches = await getMatches(supabase, columns, normalizedQuery, kanaQuery, facesAvailable)
    const rows = matches.slice(offset, offset + limit)
    const cards = rows.map(mapCard)
    const nextOffset = offset + cards.length
    return NextResponse.json({ cards, total: matches.length, hasMore: nextOffset < matches.length, nextOffset }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
  } catch {
    const allCards = rawQuery ? LOCAL_DECK_CARDS.filter((card) => matchesCard(card, rawQuery)) : LOCAL_DECK_CARDS
    const cards = rawQuery ? allCards : allCards.slice(0, DEFAULT_RESULTS)
    return NextResponse.json({ cards, total: allCards.length, hasMore: false, nextOffset: cards.length, fallback: true }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
  }
}
