import { createPublicClient } from './supabase-public'
import { createAdminClient } from './supabase-admin'
import { filterPublicVisibleUserContent, getCachedPublicHiddenUserIds } from './public-visibility'

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
const PACK_SELECT = 'id, slug, code, name, released_year, card_count, description, is_published, sort_order, image_url'
const CARD_LIST_SELECT = 'id, pack_id, slug, name, card_type, civilization, cost, mana, race, power, rarity, official_page_url, official_image_url, sort_order'
const CARD_DETAIL_SELECT = 'id, pack_id, slug, name, card_type, civilization, cost, mana, race, power, rarity, illustrator, ability_text, flavor_text, image_url, official_page_url, official_image_url, sort_order, zukan_packs(slug, code, name)'

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
      .select(PACK_SELECT)
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
      .select(PACK_SELECT)
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
      .select(CARD_LIST_SELECT)
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

export async function fetchAllCardsByPack(packId: string): Promise<ZukanCard[] | null> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('zukan_cards')
      .select(CARD_LIST_SELECT)
      .eq('pack_id', packId)
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .limit(500)
    if (error) return null
    return data as ZukanCard[]
  } catch {
    return null
  }
}

export async function fetchCardsByPackSortRange(
  packId: string,
  fromSortOrder: number,
  toSortOrder: number
): Promise<ZukanCard[] | null> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('zukan_cards')
      .select(CARD_LIST_SELECT)
      .eq('pack_id', packId)
      .eq('is_published', true)
      .gte('sort_order', fromSortOrder)
      .lte('sort_order', toSortOrder)
      .order('sort_order', { ascending: true })
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
      .select(CARD_LIST_SELECT)
      .eq('pack_id', packId)
      .eq('is_published', true)
      .in('slug', slugs)
    if (error) return null
    return data as ZukanCard[]
  } catch {
    return null
  }
}

function isLikelyUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function fetchCardsByIdentifiers(
  identifiers: string[]
): Promise<ZukanCard[] | null> {
  const uniqueIdentifiers = Array.from(new Set(identifiers.map(value => value.trim()).filter(Boolean)))
  if (uniqueIdentifiers.length === 0) return []

  const ids = uniqueIdentifiers.filter(isLikelyUuid)
  const slugs = uniqueIdentifiers.filter(value => !isLikelyUuid(value))

  try {
    const supabase = createPublicClient()
    const cards: ZukanCard[] = []

    if (ids.length > 0) {
      const { data, error } = await supabase
        .from('zukan_cards')
        .select(CARD_LIST_SELECT)
        .eq('is_published', true)
        .in('id', ids)
      if (error) return null
      cards.push(...((data ?? []) as ZukanCard[]))
    }

    if (slugs.length > 0) {
      const { data, error } = await supabase
        .from('zukan_cards')
        .select(CARD_LIST_SELECT)
        .eq('is_published', true)
        .in('slug', slugs)
      if (error) return null
      cards.push(...((data ?? []) as ZukanCard[]))
    }

    const byIdentifier = new Map<string, ZukanCard>()
    for (const card of cards) {
      byIdentifier.set(card.id, card)
      byIdentifier.set(card.slug, card)
    }

    return uniqueIdentifiers
      .map(identifier => byIdentifier.get(identifier))
      .filter((card): card is ZukanCard => !!card)
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
  user_id: string | null
  display_name: string
  avatar_url: string | null
  profile_slug: string | null
  is_withdrawn: boolean
  is_suspended: boolean
  body: string
  created_at: string
}

export type CardReview = {
  id: number
  card_id: string
  user_id: string | null
  display_name: string
  avatar_url: string | null
  profile_slug: string | null
  is_withdrawn: boolean
  is_suspended: boolean
  body: string
  created_at: string
}

export type ZukanCardReviewHighlight = {
  id: string
  slug: string
  name: string
  civilization: string | null
  official_image_url: string | null
  review_count: number
  latest_reviewed_at: string
}

export type ZukanCardReviewHighlights = {
  recent: ZukanCardReviewHighlight[]
  mostReviewed: ZukanCardReviewHighlight[]
}

type CardReviewHighlightRow = {
  card_id: string
  created_at: string
  zukan_cards: {
    id: string
    slug: string
    name: string
    civilization: string | null
    official_image_url: string | null
    is_published: boolean | null
  } | null
}

export type CardRatingRow = {
  user_id: string | null
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

const ANONYMOUS_REVIEW_NAME = '名無しのデュエリスト'
const WITHDRAWN_REVIEW_NAME = ANONYMOUS_REVIEW_NAME

export async function attachReviewProfiles<T extends { user_id: string | null; display_name: string }>(
  rows: T[]
): Promise<(T & { avatar_url: string | null; profile_slug: string | null; is_withdrawn: boolean; is_suspended: boolean })[]> {
  const userIds = Array.from(new Set(rows.map(row => row.user_id).filter((id): id is string => !!id)))
  if (userIds.length === 0) {
    return rows.map(row => ({
      ...row,
      display_name: ANONYMOUS_REVIEW_NAME,
      avatar_url: null,
      profile_slug: null,
      is_withdrawn: false,
      is_suspended: false,
    }))
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('profiles')
      .select('id, display_name, avatar_url, profile_slug, profile_hidden, account_suspended, withdrawn_at')
      .in('id', userIds)

    if (error) {
      return rows.map(row => ({
        ...row,
        display_name: ANONYMOUS_REVIEW_NAME,
        avatar_url: null,
        profile_slug: null,
        is_withdrawn: false,
        is_suspended: false,
      }))
    }

    const profileMap = new Map((data ?? []).map(profile => {
      const isWithdrawn = profile.withdrawn_at !== null
      const isPrivate = profile.profile_hidden === true || profile.account_suspended === true
      const isPublic =
        !isWithdrawn &&
        !isPrivate &&
        typeof profile.profile_slug === 'string' &&
        profile.profile_slug.length > 0

      return [
        String(profile.id),
        {
          displayName: isWithdrawn
            ? WITHDRAWN_REVIEW_NAME
            : isPublic && typeof profile.display_name === 'string' && profile.display_name.trim()
              ? profile.display_name
              : ANONYMOUS_REVIEW_NAME,
          avatarUrl: isPublic && typeof profile.avatar_url === 'string' ? profile.avatar_url : null,
          profileSlug: isPublic ? profile.profile_slug as string : null,
          isWithdrawn,
          isSuspended: profile.account_suspended === true,
        },
      ]
    }))

    return rows.map(row => {
      const profile = row.user_id ? profileMap.get(row.user_id) : null
      return {
        ...row,
        display_name: profile?.displayName ?? ANONYMOUS_REVIEW_NAME,
        avatar_url: profile?.avatarUrl ?? null,
        profile_slug: profile?.profileSlug ?? null,
        is_withdrawn: profile?.isWithdrawn ?? false,
        is_suspended: profile?.isSuspended ?? false,
      }
    })
  } catch {
    return rows.map(row => ({
      ...row,
      display_name: ANONYMOUS_REVIEW_NAME,
      avatar_url: null,
      profile_slug: null,
      is_withdrawn: false,
      is_suspended: false,
    }))
  }
}

export async function fetchPackReviews(packId: string): Promise<PackReview[] | null> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('zukan_pack_reviews')
      .select('id, pack_id, user_id, display_name, body, created_at')
      .eq('pack_id', packId)
      .eq('is_deleted', false)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) {
      if (isTableMissing(error)) return []
      return null
    }
    const hiddenUserIds = await getCachedPublicHiddenUserIds()
    const rows = filterPublicVisibleUserContent(
      data as Omit<PackReview, 'avatar_url' | 'profile_slug' | 'is_withdrawn' | 'is_suspended'>[],
      hiddenUserIds
    )
    return attachReviewProfiles(rows)
  } catch {
    return null
  }
}

export async function fetchCardReviews(cardId: string): Promise<CardReview[] | null> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('zukan_card_reviews')
      .select('id, card_id, user_id, display_name, body, created_at')
      .eq('card_id', cardId)
      .eq('is_deleted', false)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) {
      if (isTableMissing(error)) return []
      return null
    }
    const hiddenUserIds = await getCachedPublicHiddenUserIds()
    const rows = filterPublicVisibleUserContent(
      data as Omit<CardReview, 'avatar_url' | 'profile_slug' | 'is_withdrawn' | 'is_suspended'>[],
      hiddenUserIds
    )
    return attachReviewProfiles(rows)
  } catch {
    return null
  }
}

export async function fetchCardReviewHighlights(
  displayLimit = 5
): Promise<ZukanCardReviewHighlights | null> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('zukan_card_reviews')
      .select('card_id, user_id, created_at, zukan_cards!inner(id, slug, name, civilization, official_image_url, is_published)')
      .eq('is_deleted', false)
      .eq('is_hidden', false)
      .eq('zukan_cards.is_published', true)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      if (isTableMissing(error)) return { recent: [], mostReviewed: [] }
      return null
    }

    const hiddenUserIds = await getCachedPublicHiddenUserIds()
    const visibleRows = filterPublicVisibleUserContent(
      (data ?? []) as unknown as (CardReviewHighlightRow & { user_id: string | null })[],
      hiddenUserIds
    )

    const summaries = new Map<string, ZukanCardReviewHighlight>()
    for (const row of visibleRows) {
      const card = row.zukan_cards
      if (!card?.slug) continue

      const current = summaries.get(card.id)
      if (current) {
        current.review_count += 1
        if (new Date(row.created_at).getTime() > new Date(current.latest_reviewed_at).getTime()) {
          current.latest_reviewed_at = row.created_at
        }
        continue
      }

      summaries.set(card.id, {
        id: card.id,
        slug: card.slug,
        name: card.name,
        civilization: card.civilization,
        official_image_url: card.official_image_url,
        review_count: 1,
        latest_reviewed_at: row.created_at,
      })
    }

    const cards = Array.from(summaries.values())
    const recent = [...cards]
      .sort((a, b) => new Date(b.latest_reviewed_at).getTime() - new Date(a.latest_reviewed_at).getTime())
      .slice(0, displayLimit)
    const mostReviewed = [...cards]
      .sort((a, b) => {
        if (b.review_count !== a.review_count) return b.review_count - a.review_count
        return new Date(b.latest_reviewed_at).getTime() - new Date(a.latest_reviewed_at).getTime()
      })
      .slice(0, displayLimit)

    return { recent, mostReviewed }
  } catch {
    return null
  }
}

export async function fetchCardRatings(cardId: string): Promise<CardRatingSummary | null> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('zukan_card_ratings')
      .select('user_id, score_admiration, score_trauma, score_still_like, score_name, score_art')
      .eq('card_id', cardId)
      .eq('is_deleted', false)
      .eq('is_hidden', false)
    if (error) {
      if (isTableMissing(error)) return null
      return null
    }
    const hiddenUserIds = await getCachedPublicHiddenUserIds()
    const rows = filterPublicVisibleUserContent(data as CardRatingRow[], hiddenUserIds)
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
// ============================================================

// ============================================================
// ============================================================

export async function fetchCardBySlug(slug: string): Promise<FetchCardResult> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('zukan_cards')
      .select(CARD_DETAIL_SELECT)
      .eq('slug', slug)
      .eq('is_published', true)
      .single()
    if (error) {
      if (isTableMissing(error)) return { status: 'table_missing' }
      // PGRST116: single row not found
      if (error.code === 'PGRST116') return { status: 'not_found' }
      return { status: 'error' }
    }
    return { status: 'found', card: data as unknown as ZukanCardWithPack }
  } catch {
    return { status: 'error' }
  }
}
