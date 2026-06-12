import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { toggleZukanHidden } from './actions'

type PackReviewRow = {
  id: number
  display_name: string
  body: string
  is_hidden: boolean
  is_deleted: boolean
  created_at: string
  zukan_packs: { code: string; name: string; slug: string } | null
}

type CardReviewRow = {
  id: number
  display_name: string
  body: string
  is_hidden: boolean
  is_deleted: boolean
  created_at: string
  zukan_cards: { name: string; slug: string } | null
}

type RatingRow = {
  id: number
  display_name: string | null
  score_admiration: number | null
  score_trauma: number | null
  score_still_like: number | null
  score_name: number | null
  score_art: number | null
  is_hidden: boolean
  is_deleted: boolean
  created_at: string
  zukan_cards: { name: string; slug: string } | null
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('ja-JP')
}

function HiddenForm({
  type,
  id,
  isHidden,
}: {
  type: 'pack_review' | 'card_review' | 'rating'
  id: number
  isHidden: boolean
}) {
  return (
    <form action={toggleZukanHidden}>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="hidden" value={isHidden ? 'false' : 'true'} />
      <button
        type="submit"
        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-50"
      >
        {isHidden ? '再表示' : '非表示'}
      </button>
    </form>
  )
}

function StateTags({
  isHidden,
  isDeleted,
}: {
  isHidden: boolean
  isDeleted: boolean
}) {
  return (
    <div className="mt-1 flex gap-1">
      {isHidden && <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">非表示</span>}
      {isDeleted && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">削除済み</span>}
    </div>
  )
}

function BodyPreview({ body }: { body: string }) {
  return (
    <p className="max-w-xl whitespace-pre-wrap text-xs leading-5 text-gray-700">
      {body}
    </p>
  )
}

export default async function AdminZukanPage() {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('admin_auth')?.value
  if (!verifyAdminCookie(adminToken)) redirect('/admin')

  const supabase = createAdminClient()
  const [packReviewsResult, cardReviewsResult, ratingsResult] = await Promise.all([
    supabase
      .from('zukan_pack_reviews')
      .select('id, display_name, body, is_hidden, is_deleted, created_at, zukan_packs(code, name, slug)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('zukan_card_reviews')
      .select('id, display_name, body, is_hidden, is_deleted, created_at, zukan_cards(name, slug)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('zukan_card_ratings')
      .select('id, display_name, score_admiration, score_trauma, score_still_like, score_name, score_art, is_hidden, is_deleted, created_at, zukan_cards(name, slug)')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const packReviews = (packReviewsResult.data ?? []) as unknown as PackReviewRow[]
  const cardReviews = (cardReviewsResult.data ?? []) as unknown as CardReviewRow[]
  const ratings = (ratingsResult.data ?? []) as unknown as RatingRow[]

  return (
    <div className="mx-auto max-w-6xl px-3 py-6">
      <div className="mb-4">
        <Link href="/admin" className="text-sm text-blue-700 hover:underline">
          ← 管理トップへ戻る
        </Link>
        <h1 className="mt-2 text-xl font-bold text-gray-900">思い出図鑑 投稿管理</h1>
        <p className="mt-1 text-sm text-gray-600">
          zukan専用投稿だけを対象にした非表示管理です。物理削除は行いません。
        </p>
      </div>

      <section className="mb-6 rounded border bg-white">
        <h2 className="border-b bg-gray-50 px-3 py-2 text-sm font-bold">パックの思い出</h2>
        <div className="divide-y">
          {packReviews.length > 0 ? packReviews.map((review) => (
            <div key={review.id} className="grid gap-2 px-3 py-3 md:grid-cols-[9rem_1fr_6rem]">
              <div className="text-xs text-gray-600">
                <div className="font-bold">{review.display_name || '匿名'}</div>
                <div>{formatDate(review.created_at)}</div>
                <StateTags isHidden={review.is_hidden} isDeleted={review.is_deleted} />
              </div>
              <div>
                <div className="mb-1 text-xs font-bold text-gray-700">
                  {review.zukan_packs?.code} {review.zukan_packs?.name}
                </div>
                <BodyPreview body={review.body} />
              </div>
              <HiddenForm type="pack_review" id={review.id} isHidden={review.is_hidden} />
            </div>
          )) : (
            <p className="px-3 py-4 text-sm text-gray-500">投稿はまだありません。</p>
          )}
        </div>
      </section>

      <section className="mb-6 rounded border bg-white">
        <h2 className="border-b bg-gray-50 px-3 py-2 text-sm font-bold">カードレビュー</h2>
        <div className="divide-y">
          {cardReviews.length > 0 ? cardReviews.map((review) => (
            <div key={review.id} className="grid gap-2 px-3 py-3 md:grid-cols-[9rem_1fr_6rem]">
              <div className="text-xs text-gray-600">
                <div className="font-bold">{review.display_name || '匿名'}</div>
                <div>{formatDate(review.created_at)}</div>
                <StateTags isHidden={review.is_hidden} isDeleted={review.is_deleted} />
              </div>
              <div>
                <div className="mb-1 text-xs font-bold text-gray-700">
                  {review.zukan_cards ? (
                    <Link href={`/zukan/card/${review.zukan_cards.slug}`} className="text-blue-700 hover:underline">
                      {review.zukan_cards.name}
                    </Link>
                  ) : '-'}
                </div>
                <BodyPreview body={review.body} />
              </div>
              <HiddenForm type="card_review" id={review.id} isHidden={review.is_hidden} />
            </div>
          )) : (
            <p className="px-3 py-4 text-sm text-gray-500">投稿はまだありません。</p>
          )}
        </div>
      </section>

      <section className="rounded border bg-white">
        <h2 className="border-b bg-gray-50 px-3 py-2 text-sm font-bold">カード評価</h2>
        <div className="divide-y">
          {ratings.length > 0 ? ratings.map((rating) => (
            <div key={rating.id} className="grid gap-2 px-3 py-3 md:grid-cols-[9rem_1fr_6rem]">
              <div className="text-xs text-gray-600">
                <div className="font-bold">{rating.display_name || '匿名'}</div>
                <div>{formatDate(rating.created_at)}</div>
                <StateTags isHidden={rating.is_hidden} isDeleted={rating.is_deleted} />
              </div>
              <div className="text-xs text-gray-700">
                <div className="mb-1 font-bold">
                  {rating.zukan_cards ? (
                    <Link href={`/zukan/card/${rating.zukan_cards.slug}`} className="text-blue-700 hover:underline">
                      {rating.zukan_cards.name}
                    </Link>
                  ) : '-'}
                </div>
                <div className="flex flex-wrap gap-2">
                  <span>憧れ: {rating.score_admiration ?? '-'}</span>
                  <span>トラウマ: {rating.score_trauma ?? '-'}</span>
                  <span>今も好き: {rating.score_still_like ?? '-'}</span>
                  <span>名前: {rating.score_name ?? '-'}</span>
                  <span>絵: {rating.score_art ?? '-'}</span>
                </div>
              </div>
              <HiddenForm type="rating" id={rating.id} isHidden={rating.is_hidden} />
            </div>
          )) : (
            <p className="px-3 py-4 text-sm text-gray-500">評価はまだありません。</p>
          )}
        </div>
      </section>
    </div>
  )
}
