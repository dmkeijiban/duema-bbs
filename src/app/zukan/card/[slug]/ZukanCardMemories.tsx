import { cookies } from 'next/headers'
import { fetchCardRatings, fetchCardReviews, attachReviewProfiles } from '@/lib/zukan'
import { createAdminClient } from '@/lib/supabase-admin'
import { getZukanPosterContextReadOnly } from '@/lib/zukan-server'
import { verifyAdminCookie, ADMIN_COOKIE } from '@/lib/admin-auth'
import { normalizeZukanDisplayName } from '@/lib/zukan-display'
import { ZukanReviewAuthor } from '@/components/ZukanReviewAuthor'
import CardReviewForm from './CardReviewForm'
import CardRatingForm from './CardRatingForm'
import type { ItemKey } from './CardRatingForm'
import AdminReviewControls from './AdminReviewControls'

const RATING_LABELS = [
  ['当時の憧れ度', 'admiration'],
  ['使われた時のトラウマ度', 'trauma'],
  ['今見ても好き度', 'stillLike'],
  ['名前のかっこよさ', 'name'],
  ['イラストのかっこよさ', 'art'],
] as const

type AdminCardReview = {
  id: number
  user_id: string | null
  display_name: string
  body: string
  created_at: string
  is_hidden: boolean
  avatar_url: string | null
  profile_slug: string | null
  is_withdrawn: boolean
  is_suspended: boolean
}

export function ZukanCardMemoriesSkeleton() {
  return (
    <section className="mb-0 border border-gray-300 bg-white">
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
        <h2 className="text-base font-bold text-gray-800">みんなの思い出</h2>
      </div>
      <div className="space-y-5 p-3 animate-pulse">
        <div className="space-y-2">
          <div className="h-4 w-36 rounded bg-gray-100" />
          <div className="space-y-1 border border-gray-100 bg-white p-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-2 py-1.5">
                <div className="h-3 rounded bg-gray-100" />
                <div className="h-2 rounded-full bg-gray-100" />
                <div className="h-3 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-gray-100" />
          <div className="h-20 rounded border border-gray-100 bg-gray-50" />
        </div>
      </div>
    </section>
  )
}

export async function ZukanCardMemories({ cardId, slug }: { cardId: string; slug: string }) {
  const isAdmin = verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)

  const [ratingsSummary, cardReviews, initialValues] = await Promise.all([
    fetchCardRatings(cardId),
    fetchReviews(cardId, isAdmin),
    fetchInitialValues(cardId),
  ])

  const ratingCount = ratingsSummary?.totalCount ?? 0
  const reviewCount = cardReviews?.length ?? 0

  return (
    <section className="mb-0 border border-gray-300 bg-white">
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
        <h2 className="text-base font-bold text-gray-800">みんなの思い出</h2>
      </div>
      <div className="space-y-5 p-3">
        <section>
          <h3 className="mb-2 text-sm font-bold text-gray-800">
            みんなの思い出評価{ratingCount > 0 ? `（${ratingCount}件）` : ''}
          </h3>
          {ratingsSummary ? (
            <div className="mb-3 border border-gray-200 bg-white divide-y divide-gray-100">
              {RATING_LABELS.map(([label, key]) => {
                const stat = ratingsSummary[key]
                const pct = stat.avg ? Math.round((stat.avg / 5) * 100) : 0
                return (
                  <div key={label} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-2 px-3 py-2.5 sm:grid-cols-[11rem_1fr_3rem]">
                    <span className="text-xs font-bold text-gray-700">{label}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      {pct > 0 && <div className="h-full rounded-full bg-yellow-400" style={{ width: `${pct}%` }} />}
                    </div>
                    <span className="text-right font-mono text-xs text-gray-600">
                      {stat.avg ? stat.avg.toFixed(1) : '-'}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="mb-3 border border-gray-200 bg-white px-3 py-3 text-xs text-gray-400">
              まだ評価はありません
            </p>
          )}
          <CardRatingForm cardId={cardId} slug={slug} initialValues={initialValues} />
        </section>

        <section>
          <h3 className="mb-2 text-sm font-bold text-gray-800">
            このカードの思い出（{reviewCount}件）
          </h3>
          {cardReviews && cardReviews.length > 0 && (
            <div className="mb-3 divide-y divide-gray-100 border border-gray-200 bg-white">
              {cardReviews.map(r => (
                <article key={r.id} className={`px-3 py-2.5 ${r.is_hidden ? 'opacity-50 bg-gray-50' : ''}`}>
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <ZukanReviewAuthor
                      displayName={normalizeZukanDisplayName(r.display_name)}
                      avatarUrl={r.avatar_url}
                      profileSlug={r.profile_slug}
                      isWithdrawn={r.is_withdrawn}
                    />
                    <time dateTime={r.created_at}>{new Date(r.created_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}</time>
                    {r.is_hidden && <span className="text-red-500 font-bold">[非表示]</span>}
                    {r.is_suspended && <span className="text-red-600 font-bold">[停止中ユーザー]</span>}
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{r.body}</p>
                  {isAdmin && (
                    <AdminReviewControls
                      reviewId={r.id}
                      slug={slug}
                      initialBody={r.body}
                      isHidden={r.is_hidden}
                    />
                  )}
                </article>
              ))}
            </div>
          )}
          {cardReviews !== null && cardReviews.length === 0 && (
            <p className="mb-3 border border-gray-200 bg-white px-3 py-3 text-xs text-gray-400">
              まだ投稿はありません。最初の思い出を書いてみませんか？
            </p>
          )}
          <CardReviewForm cardId={cardId} slug={slug} />
        </section>
      </div>
    </section>
  )
}

async function fetchReviews(cardId: string, isAdmin: boolean): Promise<AdminCardReview[] | null> {
  if (isAdmin) {
    const adminSupa = createAdminClient()
    const { data } = await adminSupa
      .from('zukan_card_reviews')
      .select('id, card_id, user_id, display_name, body, created_at, is_hidden')
      .eq('card_id', cardId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!data) return null
    const enriched = await attachReviewProfiles(data as { id: number; card_id: string; user_id: string | null; display_name: string; body: string; created_at: string; is_hidden: boolean }[])
    return enriched.map(r => ({ ...r, is_hidden: r.is_hidden }))
  }

  const reviews = await fetchCardReviews(cardId)
  return reviews ? reviews.map(r => ({ ...r, is_hidden: false as const })) : null
}

async function fetchInitialValues(cardId: string): Promise<Partial<Record<ItemKey, number>> | undefined> {
  const poster = await getZukanPosterContextReadOnly(null)
  if (poster.blockedMessage || (!poster.userId && !poster.anonKey)) return undefined

  const supabase = createAdminClient()
  let q = supabase
    .from('zukan_card_ratings')
    .select('score_admiration, score_trauma, score_still_like, score_name, score_art')
    .eq('card_id', cardId)
    .eq('is_deleted', false)
    .limit(1)

  if (poster.userId) {
    q = q.eq('user_id', poster.userId)
  } else {
    q = q.eq('anon_key', poster.anonKey!).is('user_id', null)
  }

  const { data } = await q
  if (!data || data.length === 0) return undefined

  const row = data[0]
  return {
    score_admiration: row.score_admiration ?? undefined,
    score_trauma: row.score_trauma ?? undefined,
    score_still_like: row.score_still_like ?? undefined,
    score_name: row.score_name ?? undefined,
    score_art: row.score_art ?? undefined,
  }
}
