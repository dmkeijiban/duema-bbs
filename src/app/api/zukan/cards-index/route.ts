import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase-public'

const DEFAULT_LIMIT = 500
const MAX_LIMIT = 1000

const CIVILIZATION_ALIASES: Record<string, string> = {
  fire: '火',
  red: '火',
  water: '水',
  blue: '水',
  nature: '自然',
  green: '自然',
  light: '光',
  white: '光',
  darkness: '闇',
  dark: '闇',
  black: '闇',
  multicolor: '多色',
  rainbow: '多色',
  colorless: '無色',
}

type PackRow = {
  slug: string
  code: string
  name: string
  is_published?: boolean | null
}

type CardIndexRow = {
  id: string
  slug: string
  name: string
  card_type: string | null
  civilization: string | null
  cost: number | null
  mana: number | null
  race: string | null
  power: string | null
  rarity: string | null
  sort_order: number
  official_image_url: string | null
  zukan_packs: PackRow | PackRow[] | null
}

function normalizeLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT
  return Math.min(parsed, MAX_LIMIT)
}

function normalizeCivilization(value: string | null): string | null {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized) return null
  return CIVILIZATION_ALIASES[normalized] ?? String(value ?? '').trim()
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, match => `\\${match}`)
}

function packFromRow(row: CardIndexRow): PackRow | null {
  if (Array.isArray(row.zukan_packs)) return row.zukan_packs[0] ?? null
  return row.zukan_packs
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const pack = searchParams.get('pack')?.trim().toLowerCase() ?? ''
  const q = searchParams.get('q')?.trim() ?? ''
  const civilization = normalizeCivilization(searchParams.get('civilization'))
  const limit = normalizeLimit(searchParams.get('limit'))

  try {
    const supabase = createPublicClient()
    let query = supabase
      .from('zukan_cards')
      .select(`
        id,
        slug,
        name,
        card_type,
        civilization,
        cost,
        mana,
        race,
        power,
        rarity,
        sort_order,
        official_image_url,
        zukan_packs!inner(slug, code, name, is_published)
      `)
      .eq('is_published', true)
      .eq('zukan_packs.is_published', true)
      .order('sort_order', { ascending: true })
      .limit(limit)

    if (pack) {
      query = query.eq('zukan_packs.slug', pack)
    }

    if (civilization) {
      query = query.ilike('civilization', `%${escapeLike(civilization)}%`)
    }

    if (q) {
      const escaped = escapeLike(q)
      query = query.or(`name.ilike.%${escaped}%,slug.ilike.%${escaped}%`)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const cards = ((data ?? []) as CardIndexRow[]).map(row => {
      const packRow = packFromRow(row)
      return {
        name: row.name,
        slug: row.slug,
        cardCode: `{{CARD:${row.slug}}}`,
        packSlug: packRow?.slug ?? null,
        packCode: packRow?.code ?? null,
        packName: packRow?.name ?? null,
        civilization: row.civilization,
        cardType: row.card_type,
        cost: row.cost,
        mana: row.mana,
        race: row.race,
        power: row.power,
        rarity: row.rarity,
        sortOrder: row.sort_order,
        imageUrl: row.official_image_url,
      }
    })

    return NextResponse.json({
      count: cards.length,
      limit,
      filters: {
        pack: pack || null,
        civilization: civilization || null,
        q: q || null,
      },
      cards,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed to fetch cards index' },
      { status: 500 },
    )
  }
}
