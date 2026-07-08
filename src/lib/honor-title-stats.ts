import { unstable_cache } from 'next/cache'
import { createAdminClient } from './supabase-admin'
import { HONOR_TITLES, getHonorTitle } from './honor-title'
import {
  USER_RANKING_THREAD_POINT,
  USER_RANKING_POST_POINT,
  USER_RANKING_CARD_RATING_POINT,
  USER_RANKING_CARD_REVIEW_POINT,
  USER_RANKING_PACK_REVIEW_POINT,
} from './ranking-points'

export type HonorTierCounts = Record<string, number>

const STATS_FETCH_LIMIT = 50000

function emptyTierCounts(): HonorTierCounts {
  return Object.fromEntries(HONOR_TITLES.map(title => [title.key, 0]))
}

// 管理画面の称号セクションで使う「称号ごとの人数」集計。
// 対象ユーザーは退会・凍結していない登録プロフィール全員。
// ポイント計算は既存ランキング（ranking-points.ts）の単価をそのまま流用し、
// 日次上限や直近プロフィール件数制限は適用しない全期間累計。
export const getHonorTitleTierCounts = unstable_cache(
  async (): Promise<HonorTierCounts> => {
    try {
      const supabase = createAdminClient()
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .is('withdrawn_at', null)
        .eq('account_suspended', false)

      const ids = (profiles ?? []).map(profile => profile.id as string).filter(Boolean)
      const counts = emptyTierCounts()
      if (ids.length === 0) return counts

      const [threads, posts, cardRatings, cardReviews, packReviews] = await Promise.all([
        supabase.from('threads').select('user_id').in('user_id', ids).eq('is_archived', false).limit(STATS_FETCH_LIMIT),
        supabase.from('posts').select('user_id, threads!inner(is_archived)').in('user_id', ids).eq('is_deleted', false).eq('threads.is_archived', false).limit(STATS_FETCH_LIMIT),
        supabase.from('zukan_card_ratings').select('user_id').in('user_id', ids).eq('is_deleted', false).limit(STATS_FETCH_LIMIT),
        supabase.from('zukan_card_reviews').select('user_id').in('user_id', ids).eq('is_deleted', false).eq('is_hidden', false).limit(STATS_FETCH_LIMIT),
        supabase.from('zukan_pack_reviews').select('user_id').in('user_id', ids).eq('is_deleted', false).eq('is_hidden', false).limit(STATS_FETCH_LIMIT),
      ])

      const totals = new Map<string, number>()
      const add = (rows: Array<{ user_id: string | null }> | null, pts: number) => {
        for (const row of rows ?? []) {
          if (!row.user_id) continue
          totals.set(row.user_id, (totals.get(row.user_id) ?? 0) + pts)
        }
      }
      add(threads.data, USER_RANKING_THREAD_POINT)
      add(posts.data, USER_RANKING_POST_POINT)
      add(cardRatings.data, USER_RANKING_CARD_RATING_POINT)
      add(cardReviews.data, USER_RANKING_CARD_REVIEW_POINT)
      add(packReviews.data, USER_RANKING_PACK_REVIEW_POINT)

      for (const id of ids) {
        const title = getHonorTitle(totals.get(id) ?? 0)
        counts[title.key] = (counts[title.key] ?? 0) + 1
      }
      return counts
    } catch (error) {
      console.warn('honor title tier counts fetch failed:', error)
      return emptyTierCounts()
    }
  },
  ['honor-title-tier-counts-v1'],
  { revalidate: 3600, tags: ['honor-title-stats'] }
)
