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

export type ZukanReview = {
  id: string
  author_name: string | null
  body: string | null
  created_at: string
  updated_at: string | null
}

export type ZukanRatingSummary = {
  count: number
  averages: {
    nostalgia: number
    play: number
    now: number
    name: number
    illustration: number
  } | null
}

export type RelatedThread = {
  id: string
  title: string
  created_at: string
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

export async function fetchPackReviews(packId: string): Promise<ZukanReview[]> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('zukan_pack_reviews')
      .select('id, author_name, body, created_at, updated_at')
      .eq('pack_id', packId)
      .eq('is_hidden', false)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) return []
    return data as ZukanReview[]
  } catch {
    return []
  }
}

export async function fetchCardReviews(cardId: string): Promise<ZukanReview[]> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('zukan_card_reviews')
      .select('id, author_name, body, created_at, updated_at')
      .eq('card_id', cardId)
      .eq('is_hidden', false)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) return []
    return data as ZukanReview[]
  } catch {
    return []
  }
}

export async function fetchCardRatingSummary(
  cardId: string
): Promise<ZukanRatingSummary> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('zukan_card_ratings')
      .select(
        'nostalgia_score, play_score, now_score, name_score, illustration_score'
      )
      .eq('card_id', cardId)
      .eq('is_hidden', false)
      .eq('is_deleted', false)
      .limit(500)
    if (error || !data || data.length === 0) {
      return { count: 0, averages: null }
    }

    const totals = data.reduce(
      (acc, row) => {
        acc.nostalgia += Number(row.nostalgia_score ?? 0)
        acc.play += Number(row.play_score ?? 0)
        acc.now += Number(row.now_score ?? 0)
        acc.name += Number(row.name_score ?? 0)
        acc.illustration += Number(row.illustration_score ?? 0)
        return acc
      },
      { nostalgia: 0, play: 0, now: 0, name: 0, illustration: 0 }
    )
    const count = data.length
    return {
      count,
      averages: {
        nostalgia: totals.nostalgia / count,
        play: totals.play / count,
        now: totals.now / count,
        name: totals.name / count,
        illustration: totals.illustration / count,
      },
    }
  } catch {
    return { count: 0, averages: null }
  }
}

export async function fetchRelatedThreadsByTerms(
  terms: string[]
): Promise<RelatedThread[]> {
  const cleanTerms = terms
    .map((term) => term.trim())
    .filter((term, index, all) => term && all.indexOf(term) === index)
    .slice(0, 2)

  if (cleanTerms.length === 0) return []

  try {
    const supabase = createPublicClient()
    const found = new Map<string, RelatedThread>()

    for (const term of cleanTerms) {
      const { data, error } = await supabase
        .from('threads')
        .select('id, title, created_at')
        .eq('is_archived', false)
        .ilike('title', `%${term}%`)
        .order('created_at', { ascending: false })
        .limit(5)
      if (error || !data) continue
      for (const thread of data as RelatedThread[]) {
        if (!found.has(thread.id)) found.set(thread.id, thread)
        if (found.size >= 5) break
      }
      if (found.size >= 5) break
    }

    return Array.from(found.values()).slice(0, 5)
  } catch {
    return []
  }
}
