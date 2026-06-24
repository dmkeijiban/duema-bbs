import { cookies } from 'next/headers'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { verifyAdminCookie } from '@/lib/admin-auth'

const ADMIN_COOKIE = 'admin_auth'
const THREADS_PER_PAGE = 50

type SortKey = 'created_at' | 'post_count' | 'view_count'
type SortOrder = 'asc' | 'desc'

const SORT_LABELS: Record<SortKey, string> = {
  created_at: '日付',
  post_count: 'コメント',
  view_count: '閲覧数',
}

async function isAdmin() {
  const cookieStore = await cookies()
  return verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)
}

function normalizeSort(value: string | undefined): SortKey {
  if (value === 'post_count' || value === 'view_count' || value === 'created_at') return value
  return 'created_at'
}

function normalizeOrder(value: string | undefined): SortOrder {
  return value === 'asc' ? 'asc' : 'desc'
}

function buildUrl({ page, q, sort, order }: { page?: number; q: string; sort: SortKey; order: SortOrder }) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (page && page > 1) params.set('page', String(page))
  params.set('sort', sort)
  params.set('order', order)
  return `/admin/threads?${params.toString()}`
}

function SortLink({
  label,
  sortKey,
  currentSort,
  currentOrder,
  q,
}: {
  label: string
  sortKey: SortKey
  currentSort: SortKey
  currentOrder: SortOrder
  q: string
}) {
  const active = currentSort === sortKey
  const nextOrder: SortOrder = active && currentOrder === 'desc' ? 'asc' : 'desc'
  return (
    <Link href={buildUrl({ q, sort: sortKey, order: nextOrder })} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
      <span>{label}</span>
      <span className="text-[10px] text-gray-400">{active ? (currentOrder === 'desc' ? '↓' : '↑') : '↕'}</span>
    </Link>
  )
}

export default async function AdminThreadsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; sort?: string; order?: string }>
}) {
  const sp = await searchParams
  if (!(await isAdmin())) {
    return (
      <div className="max-w-screen-lg mx-auto px-3 py-8 text-sm">
        <p className="border border-red-200 bg-red-50 px-3 py-2 text-red-700">管理者ログインが必要です。</p>
        <Link href="/admin" className="mt-3 inline-block text-blue-600 hover:underline">管理画面へ戻る</Link>
      </div>
    )
  }

  const supabase = await createClient()
  const searchQ = (sp.q ?? '').trim()
  const isSearching = searchQ.length > 0
  const sort = normalizeSort(sp.sort)
  const order = normalizeOrder(sp.order)
  const page = isSearching ? 1 : Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const offset = (page - 1) * THREADS_PER_PAGE

  let query = supabase
    .from('threads')
    .select('id, title, post_count, view_count, category_id, created_at, categories(name)', { count: 'exact' })
    .eq('is_archived', false)
    .order(sort, { ascending: order === 'asc', nullsFirst: false })

  if (sort !== 'created_at') {
    query = query.order('created_at', { ascending: false })
  }

  if (isSearching) {
    const numericId = parseInt(searchQ, 10)
    if (!isNaN(numericId) && String(numericId) === searchQ) {
      query = query.eq('id', numericId)
    } else {
      query = query.ilike('title', `%${searchQ}%`)
    }
    query = query.limit(100)
  } else {
    query = query.range(offset, offset + THREADS_PER_PAGE - 1)
  }

  const { data: threads, count } = await query
  const totalPages = isSearching ? 1 : Math.max(1, Math.ceil((count ?? 0) / THREADS_PER_PAGE))

  return (
    <div className="max-w-screen-xl mx-auto px-3 py-4 text-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">📋 スレッド閲覧数管理</h1>
          <p className="mt-1 text-xs text-gray-500">
            日付・コメント・閲覧数で並び替えできます。現在：{SORT_LABELS[sort]} {order === 'desc' ? '多い/新しい順' : '少ない/古い順'}
          </p>
        </div>
        <Link href="/admin" className="text-xs text-blue-600 hover:underline">管理画面へ戻る</Link>
      </div>

      <form method="GET" action="/admin/threads" className="mb-3 flex flex-wrap gap-2">
        <input
          type="text"
          name="q"
          defaultValue={searchQ}
          placeholder="スレッドIDまたはタイトルで検索..."
          className="min-w-64 flex-1 border border-gray-300 px-2.5 py-1.5 text-xs rounded focus:outline-none focus:border-blue-400"
        />
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="order" value={order} />
        <button type="submit" className="px-3 py-1.5 text-xs text-white rounded" style={{ background: '#0d6efd' }}>
          検索
        </button>
        {isSearching && (
          <Link href={buildUrl({ q: '', sort, order })} className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 rounded">
            クリア
          </Link>
        )}
      </form>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(['created_at', 'post_count', 'view_count'] as SortKey[]).map(key => (
          <Link
            key={key}
            href={buildUrl({ q: searchQ, sort: key, order: sort === key && order === 'desc' ? 'asc' : 'desc' })}
            className="rounded border px-2.5 py-1 text-xs"
            style={sort === key ? { borderColor: '#0d6efd', color: '#0d6efd', background: '#eff6ff' } : { borderColor: '#d1d5db', color: '#4b5563', background: '#fff' }}
          >
            {SORT_LABELS[key]} {sort === key ? (order === 'desc' ? '↓' : '↑') : ''}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded bg-white">
        {!threads || threads.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-gray-400">
            {isSearching ? '該当するスレッドがありません' : 'スレッドがありません'}
          </p>
        ) : (
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-[11px]">
                <th className="px-2 py-3.5 text-left whitespace-nowrap font-semibold">ID</th>
                <th className="px-2 py-3.5 text-left font-semibold">タイトル</th>
                <th className="px-2 py-3.5 text-left whitespace-nowrap font-semibold hidden sm:table-cell">カテゴリ</th>
                <th className="px-2 py-3.5 text-right whitespace-nowrap font-semibold">
                  <SortLink label="コメント" sortKey="post_count" currentSort={sort} currentOrder={order} q={searchQ} />
                </th>
                <th className="px-2 py-3.5 text-right whitespace-nowrap font-semibold">
                  <SortLink label="閲覧数" sortKey="view_count" currentSort={sort} currentOrder={order} q={searchQ} />
                </th>
                <th className="px-2 py-3.5 text-right whitespace-nowrap font-semibold hidden md:table-cell">
                  <SortLink label="作成日" sortKey="created_at" currentSort={sort} currentOrder={order} q={searchQ} />
                </th>
                <th className="px-2 py-3.5 text-right whitespace-nowrap font-semibold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {threads.map(t => {
                const cat = (t as typeof t & { categories?: { name: string } | null }).categories
                const createdAt = (t as typeof t & { created_at?: string }).created_at
                const dateStr = createdAt
                  ? new Date(createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                  : '-'
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-2 py-3.5 font-mono text-gray-400 whitespace-nowrap">{t.id}</td>
                    <td className="px-2 py-3.5 max-w-[12rem] md:max-w-md">
                      <a href={`/thread/${t.id}`} target="_blank" className="text-blue-600 hover:underline line-clamp-2 block text-xs leading-snug">
                        {t.title}
                      </a>
                    </td>
                    <td className="px-2 py-3.5 whitespace-nowrap text-gray-500 hidden sm:table-cell">
                      {cat?.name ?? <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-2 py-3.5 text-right text-gray-600 whitespace-nowrap tabular-nums">{t.post_count ?? 0}</td>
                    <td className="px-2 py-3.5 text-right text-blue-700 whitespace-nowrap tabular-nums font-bold">{(t as typeof t & { view_count?: number | null }).view_count ?? 0}</td>
                    <td className="px-2 py-3.5 text-right text-gray-400 whitespace-nowrap hidden md:table-cell text-[10px]">{dateStr}</td>
                    <td className="px-2 py-3.5 whitespace-nowrap text-right">
                      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1.5">
                        <Link href={`/admin?thread=${t.id}`} className="px-2 py-1 text-[10px] text-blue-600 border border-blue-300 hover:bg-blue-50 rounded leading-none">
                          レス
                        </Link>
                        <Link href={`/admin?editThread=${t.id}`} className="px-2 py-1 text-[10px] text-green-700 border border-green-400 hover:bg-green-50 rounded leading-none">
                          編集
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {!isSearching && totalPages > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {page > 1 && (
            <Link href={buildUrl({ page: page - 1, q: searchQ, sort, order })} className="min-w-[1.75rem] h-6 px-1.5 text-[11px] font-medium border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 rounded flex items-center justify-center">«</Link>
          )}
          <span className="px-2 text-[11px] text-gray-500">{page} / {totalPages}</span>
          {page < totalPages && (
            <Link href={buildUrl({ page: page + 1, q: searchQ, sort, order })} className="min-w-[1.75rem] h-6 px-1.5 text-[11px] font-medium border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 rounded flex items-center justify-center">»</Link>
          )}
        </div>
      )}
    </div>
  )
}
