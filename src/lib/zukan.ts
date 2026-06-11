import { createPublicClient } from './supabase-public'

export type ZukanPack = {
  id: string
  slug: string
  code: string
  name: string
  released_year: string | null
  card_count: number | null
  description: string | null
  is_published: boolean
  sort_order: number
}

export type ZukanCard = {
  id: string
  pack_id: string
  slug: string
  name: string
  card_type: string | null
  civilization: string | null
  cost: number | null
  mana: number | null
  race: string | null
  power: string | null
  rarity: string | null
  illustrator: string | null
  ability_text: string | null
  flavor_text: string | null
  image_url: string | null
  official_page_url: string | null
  official_image_url: string | null
  sort_order: number
}

export type ZukanCardWithPack = ZukanCard & {
  zukan_packs: { slug: string; code: string; name: string } | null
}

const PAGE_SIZE = 60

// テーブル未作成エラーコード (PostgreSQL: undefined_table)
const TABLE_NOT_FOUND = '42P01'

function isTableMissing(error: { code?: string } | null): boolean {
  return error?.code === TABLE_NOT_FOUND
}

export async function fetchPublishedPacks(): Promise<ZukanPack[] | null> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('zukan_packs')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
    if (error) return null
    return data as ZukanPack[]
  } catch {
    return null
  }
}

export async function fetchPack(slug: string): Promise<ZukanPack | null> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('zukan_packs')
      .select('*')
      .eq('slug', slug)
      .single()
    if (error) return null
    return data as ZukanPack
  } catch {
    return null
  }
}

export async function fetchCardsByPack(
  packId: string,
  page: number
): Promise<ZukanCard[] | null> {
  try {
    const supabase = createPublicClient()
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('zukan_cards')
      .select('*')
      .eq('pack_id', packId)
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .range(from, to)
    if (error) return null
    return data as ZukanCard[]
  } catch {
    return null
  }
}

export async function fetchCardsBySlugs(
  packId: string,
  slugs: string[]
): Promise<ZukanCard[] | null> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('zukan_cards')
      .select('*')
      .eq('pack_id', packId)
      .eq('is_published', true)
      .in('slug', slugs)
    if (error) return null
    return data as ZukanCard[]
  } catch {
    return null
  }
}

type FetchCardResult =
  | { status: 'found'; card: ZukanCardWithPack }
  | { status: 'not_found' }
  | { status: 'table_missing' }
  | { status: 'error' }

export async function fetchCardBySlug(slug: string): Promise<FetchCardResult> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('zukan_cards')
      .select('*, zukan_packs(slug, code, name)')
      .eq('slug', slug)
      .single()
    if (error) {
      if (isTableMissing(error)) return { status: 'table_missing' }
      // PGRST116: single row not found
      if (error.code === 'PGRST116') return { status: 'not_found' }
      return { status: 'error' }
    }
    return { status: 'found', card: data as ZukanCardWithPack }
  } catch {
    return { status: 'error' }
  }
}
