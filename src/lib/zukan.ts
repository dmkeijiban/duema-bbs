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
  image_url: string | null
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

// ============================================================
// Review / Rating types
// ============================================================

export type PackReview = {
  id: number
  pack_id: string
  display_name: string
  body: string
  created_at: string
}

export type CardReview = {
  id: number
  card_id: string
  display_name: string
  body: string
  created_at: string
}

export type CardRatingRow = {
  score_admiration: number | null
  score_trauma: number | null
  score_still_like: number | null
  score_name: number | null
  score_art: number | null
}

export type CardRatingSummary = {
  admiration: { avg: number; count: number }
  trauma:     { avg: number; count: number }
  stillLike:  { avg: number; count: number }
  name:       { avg: number; count: number }
  art:        { avg: number; count: number }
  totalCount: number
}

// ============================================================
// Fetch reviews
// ============================================================

export async function fetchPackReviews(packId: string): Promise<PackReview[] | null> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('zukan_pack_reviews')
      .select('id, pack_id, display_name, body, created_at')
      .eq('pack_id', packId)
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) {
      if (isTableMissing(error)) return []
      return null
    }
    return data as PackReview[]
  } catch {
    return null
  }
}

export async function fetchCardReviews(cardId: string): Promise<CardReview[] | null> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('zukan_card_reviews')
      .select('id, card_id, display_name, body, created_at')
      .eq('card_id', cardId)
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) {
      if (isTableMissing(error)) return []
      return null
    }
    return data as CardReview[]
  } catch {
    return null
  }
}

export async function fetchCardRatings(cardId: string): Promise<CardRatingSummary | null> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('zukan_card_ratings')
      .select('score_admiration, score_trauma, score_still_like, score_name, score_art')
      .eq('card_id', cardId)
      .eq('is_deleted', false)
    if (error) {
      if (isTableMissing(error)) return null
      return null
    }
    const rows = data as CardRatingRow[]
    if (rows.length === 0) return null

    const avg = (field: keyof CardRatingRow) => {
      const vals = rows.map(r => r[field]).filter((v): v is number => v !== null)
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    }
    const cnt = (field: keyof CardRatingRow) =>
      rows.filter(r => r[field] !== null).length

    return {
      admiration: { avg: avg('score_admiration'), count: cnt('score_admiration') },
      trauma:     { avg: avg('score_trauma'),     count: cnt('score_trauma') },
      stillLike:  { avg: avg('score_still_like'), count: cnt('score_still_like') },
      name:       { avg: avg('score_name'),        count: cnt('score_name') },
      art:        { avg: avg('score_art'),         count: cnt('score_art') },
      totalCount: rows.length,
    }
  } catch {
    return null
  }
}

// ============================================================
// Related threads (lightweight title match)
// ============================================================

export type RelatedThread = {
  id: string
  title: string
  slug: string
  comment_count: number
  created_at: string
}

export async function fetchRelatedThreads(keyword: string): Promise<RelatedThread[]> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('threads')
      .select('id, title, slug, comment_count, created_at')
      .ilike('title', `%${keyword}%`)
      .eq('is_archived', false)
      .order('comment_count', { ascending: false })
      .limit(5)
    if (error) return []
    return (data ?? []) as RelatedThread[]
  } catch {
    return []
  }
}

// ============================================================
// Card slug fetch (continued below)
// ============================================================

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
