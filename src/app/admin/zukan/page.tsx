import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import HideToggleButton from './HideToggleButton'
import AdminNoteForm from './AdminNoteForm'

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

type AdminNoteRow = {
  post_type: string
  post_id: number
  note: string
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('ja-JP')
}

function StateTags({ isHidden, isDeleted }: { isHidden: boolean; isDeleted: boolean }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {isHidden && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">非表示</span>}
      {isDeleted && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">削除済み</span>}
    </div>
  )
}

export default async function AdminZukanPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; q?: string; sort?: string }>
}) {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('admin_auth')?.value
  if (!verifyAdminCookie(adminToken)) redirect('/admin')

  const sp = await searchParams
  const typeFilter = sp.type ?? 'all'
  const statusFilter = sp.status ?? 'all'
  const q = sp.q ?? ''
  const sort = sp.sort === 'asc' ? 'asc' : 'desc'

  const supabase = createAdminClient()

  // Stats
  const [prCountRes, crCountRes, rCountRes, todayRes] = await Promise.all([
    supabase.from('zukan_pack_reviews').select('id, is_hidden', { count: 'exact', head: false }),
    supabase.from('zukan_card_reviews').select('id, is_hidden', { count: 'exact', head: false }),
    supabase.from('zukan_card_ratings').select('id, is_hidden', { count: 'exact', head: false }),
    supabase.from('zukan_pack_reviews').select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(new Date().toDateString()).toISOString()),
  ])

  const prRows = (prCountRes.data ?? []) as { id: number; is_hidden: boolean }[]
  const crRows = (crCountRes.data ?? []) as { id: number; is_hidden: boolean }[]
  const rRows = (rCountRes.data ?? []) as { id: number; is_hidden: boolean }[]
  const prPublic = prRows.filter(r => !r.is_hidden).length
  const prHidden = prRows.filter(r => r.is_hidden).length
  const crPublic = crRows.filter(r => !r.is_hidden).length
  const crHidden = crRows.filter(r => r.is_hidden).length
  const rPublic = rRows.filter(r => !r.is_hidden).length
  const rHidden = rRows.filter(r => r.is_hidden).length
  const todayCount = todayRes.count ?? 0

  // Post queries with filter
  let packReviews: PackReviewRow[] = []
  let cardReviews: CardReviewRow[] = []
  let ratings: RatingRow[] = []

  if (typeFilter === 'all' || typeFilter === 'pack_review') {
    let q1 = supabase
      .from('zukan_pack_reviews')
      .select('id, display_name, body, is_hidden, is_deleted, created_at, zukan_packs(code, name, slug)')
      .order('created_at', { ascending: sort === 'asc' })
      .limit(50)
    if (statusFilter === 'public') q1 = q1.eq('is_hidden', false)
    if (statusFilter === 'hidden') q1 = q1.eq('is_hidden', true)
    if (q) q1 = q1.ilike('body', `%${q}%`)
    const { data } = await q1
    packReviews = (data ?? []) as unknown as PackReviewRow[]
  }

  if (typeFilter === 'all' || typeFilter === 'card_review') {
    let q2 = supabase
      .from('zukan_card_reviews')
      .select('id, display_name, body, is_hidden, is_deleted, created_at, zukan_cards(name, slug)')
      .order('created_at', { ascending: sort === 'asc' })
      .limit(50)
    if (statusFilter === 'public') q2 = q2.eq('is_hidden', false)
    if (statusFilter === 'hidden') q2 = q2.eq('is_hidden', true)
    if (q) q2 = q2.ilike('body', `%${q}%`)
    const { data } = await q2
    cardReviews = (data ?? []) as unknown as CardReviewRow[]
  }

  if (typeFilter === 'all' || typeFilter === 'rating') {
    let q3 = supabase
      .from('zukan_card_ratings')
      .select('id, display_name, score_admiration, score_trauma, score_still_like, score_name, score_art, is_hidden, is_deleted, created_at, zukan_cards(name, slug)')
      .order('created_at', { ascending: sort === 'asc' })
      .limit(50)
    if (statusFilter === 'public') q3 = q3.eq('is_hidden', false)
    if (statusFilter === 'hidden') q3 = q3.eq('is_hidden', true)
    const { data } = await q3
    ratings = (data ?? []) as unknown as RatingRow[]
  }

  // Admin notes for all displayed posts
  const allIds: { type: string; id: number }[] = [
    ...packReviews.map(r => ({ type: 'pack_review', id: r.id })),
    ...cardReviews.map(r => ({ type: 'card_review', id: r.id })),
    ...ratings.map(r => ({ type: 'rating', id: r.id })),
  ]
  let noteMap: Record<string, string> = {}
  if (allIds.length > 0) {
    const noteResults = await Promise.all(
      ['pack_review', 'card_review', 'rating'].map(pt => {
        const ids = allIds.filter(x => x.type === pt).map(x => x.id)
        if (ids.length === 0) return Promise.resolve({ data: [] })
        return supabase
          .from('zukan_admin_notes')
          .select('post_type, post_id, note')
          .eq('post_type', pt)
          .in('post_id', ids)
      })
    )
    const allNotes = noteResults.flatMap(r => (r.data ?? []) as AdminNoteRow[])
    noteMap = Object.fromEntries(allNotes.map(n => [`${n.post_type}:${n.post_id}`, n.note]))
  }

  const noteFor = (type: string, id: number) => noteMap[`${type}:${id}`] ?? ''

  return (
    <div className="mx-auto max-w-6xl px-3 py-6">
      <div className="mb-4 flex items-start justify-between flex-wrap gap-2">
        <div>
          <Link href="/admin" className="text-sm text-blue-700 hover:underline">← 管理トップへ戻る</Link>
          <h1 className="mt-1 text-xl font-bold text-gray-900">思い出図鑑 投稿管理</h1>
        </div>
        <Link href="/admin/zukan/cards" className="rounded border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700 hover:bg-blue-100">
          カードメモ・関連スレ管理 →
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'パックレビュー', pub: prPublic, hid: prHidden },
          { label: 'カードレビュー', pub: crPublic, hid: crHidden },
          { label: 'カード評価', pub: rPublic, hid: rHidden },
          { label: '今日の投稿', pub: todayCount, hid: null },
        ].map(s => (
          <div key={s.label} className="rounded border border-gray-200 bg-white px-3 py-2">
            <div className="text-xs text-gray-500">{s.label}</div>
            <div className="text-xl font-bold text-gray-900">{s.pub}</div>
            {s.hid !== null && <div className="text-[10px] text-red-600">非表示: {s.hid}</div>}
          </div>
        ))}
      </div>

      {/* Filter */}
      <form method="GET" className="mb-5 flex flex-wrap items-end gap-2 rounded border border-gray-200 bg-white px-3 py-3">
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] font-bold text-gray-500">種類</label>
          <select name="type" defaultValue={typeFilter} className="rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:border-blue-400">
            <option value="all">すべて</option>
            <option value="pack_review">パックレビュー</option>
            <option value="card_review">カードレビュー</option>
            <option value="rating">評価</option>
          </select>
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] font-bold text-gray-500">状態</label>
          <select name="status" defaultValue={statusFilter} className="rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:border-blue-400">
            <option value="all">すべて</option>
            <option value="public">公開中</option>
            <option value="hidden">非表示</option>
          </select>
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] font-bold text-gray-500">並び順</label>
          <select name="sort" defaultValue={sort} className="rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:border-blue-400">
            <option value="desc">新しい順</option>
            <option value="asc">古い順</option>
          </select>
        </div>
        <div className="flex flex-col gap-0.5 flex-1 min-w-[140px]">
          <label className="text-[10px] font-bold text-gray-500">本文検索</label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="キーワード（本文）"
            className="rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
          />
        </div>
        <button type="submit" className="rounded border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100">
          絞り込む
        </button>
        <Link href="/admin/zukan" className="text-xs text-gray-500 hover:underline">リセット</Link>
      </form>

      {/* Pack Reviews */}
      {(typeFilter === 'all' || typeFilter === 'pack_review') && (
        <section className="mb-6 rounded border bg-white">
          <h2 className="border-b bg-gray-50 px-3 py-2 text-sm font-bold">
            パックの思い出 <span className="text-gray-400 font-normal text-xs">({packReviews.length}件)</span>
          </h2>
          <div className="divide-y">
            {packReviews.length > 0 ? packReviews.map((review) => (
              <div key={review.id} className="grid gap-2 px-3 py-3 sm:grid-cols-[9rem_1fr_7rem]">
                <div className="text-xs text-gray-600">
                  <div className="font-bold">{review.display_name || '匿名'}</div>
                  <div className="text-gray-400">{formatDate(review.created_at)}</div>
                  <StateTags isHidden={review.is_hidden} isDeleted={review.is_deleted} />
                </div>
                <div>
                  <div className="mb-1 text-xs font-bold text-gray-700">
                    {review.zukan_packs?.code} {review.zukan_packs?.name}
                  </div>
                  <p className="whitespace-pre-wrap text-xs leading-5 text-gray-700">{review.body}</p>
                  <AdminNoteForm postType="pack_review" postId={review.id} defaultNote={noteFor('pack_review', review.id)} />
                </div>
                <HideToggleButton type="pack_review" id={review.id} isHidden={review.is_hidden} />
              </div>
            )) : (
              <p className="px-3 py-4 text-sm text-gray-500">該当する投稿はありません。</p>
            )}
          </div>
        </section>
      )}

      {/* Card Reviews */}
      {(typeFilter === 'all' || typeFilter === 'card_review') && (
        <section className="mb-6 rounded border bg-white">
          <h2 className="border-b bg-gray-50 px-3 py-2 text-sm font-bold">
            カードレビュー <span className="text-gray-400 font-normal text-xs">({cardReviews.length}件)</span>
          </h2>
          <div className="divide-y">
            {cardReviews.length > 0 ? cardReviews.map((review) => (
              <div key={review.id} className="grid gap-2 px-3 py-3 sm:grid-cols-[9rem_1fr_7rem]">
                <div className="text-xs text-gray-600">
                  <div className="font-bold">{review.display_name || '匿名'}</div>
                  <div className="text-gray-400">{formatDate(review.created_at)}</div>
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
                  <p className="whitespace-pre-wrap text-xs leading-5 text-gray-700">{review.body}</p>
                  <AdminNoteForm postType="card_review" postId={review.id} defaultNote={noteFor('card_review', review.id)} />
                </div>
                <HideToggleButton type="card_review" id={review.id} isHidden={review.is_hidden} />
              </div>
            )) : (
              <p className="px-3 py-4 text-sm text-gray-500">該当する投稿はありません。</p>
            )}
          </div>
        </section>
      )}

      {/* Ratings */}
      {(typeFilter === 'all' || typeFilter === 'rating') && (
        <section className="mb-2 rounded border bg-white">
          <h2 className="border-b bg-gray-50 px-3 py-2 text-sm font-bold">
            カード評価 <span className="text-gray-400 font-normal text-xs">({ratings.length}件)</span>
          </h2>
          <div className="divide-y">
            {ratings.length > 0 ? ratings.map((rating) => (
              <div key={rating.id} className="grid gap-2 px-3 py-3 sm:grid-cols-[9rem_1fr_7rem]">
                <div className="text-xs text-gray-600">
                  <div className="font-bold">{rating.display_name || '匿名'}</div>
                  <div className="text-gray-400">{formatDate(rating.created_at)}</div>
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
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span>憧れ: {rating.score_admiration ?? '-'}</span>
                    <span>トラウマ: {rating.score_trauma ?? '-'}</span>
                    <span>今も好き: {rating.score_still_like ?? '-'}</span>
                    <span>名前: {rating.score_name ?? '-'}</span>
                    <span>絵: {rating.score_art ?? '-'}</span>
                  </div>
                  <AdminNoteForm postType="rating" postId={rating.id} defaultNote={noteFor('rating', rating.id)} />
                </div>
                <HideToggleButton type="rating" id={rating.id} isHidden={rating.is_hidden} />
              </div>
            )) : (
              <p className="px-3 py-4 text-sm text-gray-500">該当する評価はありません。</p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
