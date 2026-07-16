import { after, NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { normalizeCardName } from '@/lib/card-name'
import { canAccessDeckMaker } from '@/lib/deck-maker-access'
import { LOCAL_DECK_CARDS, matchesCard, type DeckCard } from '@/lib/deck-maker'

export const dynamic = 'force-dynamic'
const MAX_QUERY_LENGTH = 80
const PAGE_SIZE = 48
const QUERY_BATCH_SIZE = 500
const CATALOG_CACHE_MS = 15 * 60 * 1000
const DEFAULT_RESULTS = 32
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
}

let catalogCache: { rows: Row[]; expiresAt: number } | null = null
let catalogPromise: Promise<Row[]> | null = null

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
  const printing = newestPrinting(row)
    ?? row.card_printings?.find((item) => item.is_representative)
    ?? row.card_printings?.[0]
  return { id: row.id, name: row.name, nameKana: row.name_kana, imageUrl: printing?.image_url ?? row.image_url, officialPageUrl: printing?.official_page_url ?? null, sourceKey: printing?.source_key ?? null }
}

async function loadCatalog(
  supabase: ReturnType<typeof createAdminClient>,
  columns: string,
) {
  const rows: Row[] = []
  for (let offset = 0; ; offset += QUERY_BATCH_SIZE) {
    const result = await supabase
      .from('cards')
      .select(columns)
      .eq('is_active', true)
      .order('id')
      .range(offset, offset + QUERY_BATCH_SIZE - 1)
    if (result.error) throw result.error
    const batch = (result.data ?? []) as unknown as Row[]
    rows.push(...batch)
    if (batch.length < QUERY_BATCH_SIZE) break
  }
  return rows.sort(compareRowsNewest)
}

async function getCatalog(supabase: ReturnType<typeof createAdminClient>, columns: string) {
  if (catalogCache && catalogCache.expiresAt > Date.now()) return catalogCache.rows
  if (!catalogPromise) {
    catalogPromise = loadCatalog(supabase, columns)
      .then((rows) => {
        catalogCache = { rows, expiresAt: Date.now() + CATALOG_CACHE_MS }
        return rows
      })
      .finally(() => {
        catalogPromise = null
      })
  }
  return catalogPromise
}

export async function GET(request: NextRequest) {
  if (!(await canAccessDeckMaker())) return new NextResponse(null, { status: 404 })

  const rawQuery = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const requestedPage = Number.parseInt(request.nextUrl.searchParams.get('page') ?? '0', 10)
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 0 ? requestedPage : 0
  if (rawQuery.length > MAX_QUERY_LENGTH || /[\u0000-\u001f\u007f]/.test(rawQuery)) return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  const normalizedQuery = normalizeCardName(rawQuery)
  const kanaQuery = rawQuery.normalize('NFKC')
  try {
    const supabase = createAdminClient()
    const columns = 'id,name,normalized_name,name_kana,image_url,card_printings(source_key,official_page_url,image_url,set_name,is_representative)'
    if (!rawQuery) {
      const result = await supabase.from('cards').select(columns).eq('is_active', true).in('normalized_name', CHARISMA_BEST_DEFAULTS.map(([name]) => normalizeCardName(name)))
      if (result.error) throw result.error
      const unique = new Map<string, DeckCard>()
      const rowsByName = new Map(((result.data ?? []) as Row[]).map((row) => [normalizeCardName(row.name), row]))
      for (const [name, imageNumber] of CHARISMA_BEST_DEFAULTS) {
        const row = rowsByName.get(normalizeCardName(name))
        if (!row) continue
        const card = mapCard(row)
        unique.set(card.id, { ...card, imageUrl: charismaImageUrl(imageNumber) })
      }
      if (unique.size < DEFAULT_RESULTS) {
        const fallbackResult = await supabase.from('cards').select(columns).eq('is_active', true).order('name').limit(DEFAULT_RESULTS)
        if (fallbackResult.error) throw fallbackResult.error
        for (const row of (fallbackResult.data ?? []) as Row[]) {
          const card = mapCard(row)
          if (!unique.has(card.id)) unique.set(card.id, card)
          if (unique.size === DEFAULT_RESULTS) break
        }
      }
      after(async () => {
        try {
          await getCatalog(supabase, columns)
        } catch {
          // 次回の検索時に再試行する
        }
      })
      return NextResponse.json({ cards: [...unique.values()], total: unique.size, hasMore: false }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
    }

    const catalog = await getCatalog(supabase, columns)
    const allCards = catalog
      .filter((row) => row.normalized_name.includes(normalizedQuery) || (row.name_kana?.normalize('NFKC').includes(kanaQuery) ?? false))
      .map(mapCard)
    const offset = page * PAGE_SIZE
    const cards = allCards.slice(offset, offset + PAGE_SIZE)
    return NextResponse.json({ cards, total: allCards.length, hasMore: offset + cards.length < allCards.length, nextPage: page + 1 }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
  } catch {
    const allCards = rawQuery ? LOCAL_DECK_CARDS.filter((card) => matchesCard(card, rawQuery)) : LOCAL_DECK_CARDS
    const offset = page * PAGE_SIZE
    const cards = allCards.slice(offset, offset + (rawQuery ? PAGE_SIZE : DEFAULT_RESULTS))
    return NextResponse.json({ cards, total: allCards.length, hasMore: offset + cards.length < allCards.length, nextPage: page + 1, fallback: true }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
  }
}
