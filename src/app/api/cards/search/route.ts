import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { normalizeCardName } from '@/lib/card-name'
import { canAccessDeckMaker } from '@/lib/deck-maker-access'
import { LOCAL_DECK_CARDS, matchesCard, type DeckCard } from '@/lib/deck-maker'

export const dynamic = 'force-dynamic'
const MAX_QUERY_LENGTH = 80
const MAX_RESULTS = 30
const DEFAULT_RESULTS = 32
const escapeIlike = (value: string) => value.replace(/[\\%_]/g, (character) => `\\${character}`)
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

type Row = {
  id: string
  name: string
  name_kana: string | null
  image_url: string | null
  card_printings?: Array<{ source_key: string; official_page_url: string | null; image_url: string | null; is_representative: boolean }>
}

function mapCard(row: Row): DeckCard {
  const printing = row.card_printings?.find((item) => item.is_representative) ?? row.card_printings?.[0]
  return { id: row.id, name: row.name, nameKana: row.name_kana, imageUrl: printing?.image_url ?? row.image_url, officialPageUrl: printing?.official_page_url ?? null, sourceKey: printing?.source_key ?? null }
}

export async function GET(request: NextRequest) {
  if (!(await canAccessDeckMaker())) return new NextResponse(null, { status: 404 })

  const rawQuery = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (rawQuery.length > MAX_QUERY_LENGTH || /[\u0000-\u001f\u007f]/.test(rawQuery)) return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  const query = escapeIlike(normalizeCardName(rawQuery))
  const kanaQuery = escapeIlike(rawQuery)
  try {
    const supabase = createAdminClient()
    const columns = 'id,name,name_kana,image_url,card_printings(source_key,official_page_url,image_url,is_representative)'
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
      return NextResponse.json({ cards: [...unique.values()] }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
    }
    const [nameResult, kanaResult] = await Promise.all([
      supabase.from('cards').select(columns).eq('is_active', true).ilike('normalized_name', `%${query}%`).order('name').limit(MAX_RESULTS),
      supabase.from('cards').select(columns).eq('is_active', true).ilike('name_kana', `%${kanaQuery}%`).order('name').limit(MAX_RESULTS),
    ])
    if (nameResult.error) throw nameResult.error
    if (kanaResult.error) throw kanaResult.error
    const unique = new Map<string, Row>()
    for (const row of [...(nameResult.data ?? []), ...(kanaResult.data ?? [])] as Row[]) unique.set(row.id, row)
    return NextResponse.json({ cards: [...unique.values()].slice(0, MAX_RESULTS).map(mapCard) }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
  } catch {
    const cards = rawQuery ? LOCAL_DECK_CARDS.filter((card) => matchesCard(card, rawQuery)) : LOCAL_DECK_CARDS
    return NextResponse.json({ cards: cards.slice(0, rawQuery ? MAX_RESULTS : DEFAULT_RESULTS), fallback: true }, { headers: { 'Cache-Control': 'private, max-age=0, no-store' } })
  }
}
