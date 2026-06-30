import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdminCookie } from '@/lib/admin-auth'

const ADMIN_COOKIE = 'admin_auth'

type LogRow = {
  id: number
  card_slug: string
  thread_id: number | null
  cycle_no: number
  posted_date: string
  created_at: string
}

type MidnightPostRow = {
  id: string
  run_date: string
  card_name: string
  card_slug: string | null
  status: string
  thread_id: number | null
  thread_url: string | null
  typefully_url: string | null
  error_message: string | null
  created_at: string
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(value))
}

export default async function DailyZukanAdminPage() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) redirect('/admin')

  const admin = createAdminClient()

  const { data: midnightRowsData } = await admin
    .from('zukan_daily_card_posts')
    .select('id, run_date, card_name, card_slug, status, thread_id, thread_url, typefully_url, error_message, created_at')
    .order('run_date', { ascending: false })
    .limit(30)
  const midnightRows = (midnightRowsData ?? []) as MidnightPostRow[]

  // 直近30件の生成履歴
  const { data: logsData } = await admin
    .from('daily_zukan_thread_logs')
    .select('id, card_slug, thread_id, cycle_no, posted_date, created_at')
    .order('posted_date', { ascending: false })
    .limit(30)
  const logs = (logsData ?? []) as LogRow[]

  // 現在の周回番号
  const { data: cycleRow } = await admin
    .from('daily_zukan_thread_logs')
    .select('cycle_no')
    .order('cycle_no', { ascending: false })
    .limit(1)
    .maybeSingle()
  const currentCycle = cycleRow?.cycle_no ?? 1

  // 現周回で使用済みのカードslug
  const { data: usedRows } = await admin
    .from('daily_zukan_thread_logs')
    .select('card_slug')
    .eq('cycle_no', currentCycle)
  const usedSlugs = new Set((usedRows ?? []).map((r) => r.card_slug as string))

  // 公開カード（slug→name）
  const { data: cardRows } = await admin
    .from('zukan_cards')
    .select('slug, name')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
  const cards = (cardRows ?? []) as { slug: string; name: string }[]
  const nameMap = new Map(cards.map((c) => [c.slug, c.name]))

  const totalCards = cards.length
  const usedCount = cards.filter((c) => usedSlugs.has(c.slug)).length
  const remaining = Math.max(0, totalCards - usedCount)

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 text-sm">
      <div className="mb-4 flex items-center gap-2 text-xs text-gray-500">
        <Link href="/admin" className="text-blue-600 hover:underline">管理画面</Link>
        <span>/</span>
        <span>思い出図鑑カードスレ</span>
      </div>
      <h1 className="mb-1 text-lg font-bold text-gray-800">🃏 思い出図鑑カードスレ（自動生成）</h1>
      <p className="mb-4 text-xs text-gray-500">
        毎日 JST 0:00 に公開カードから未使用カードを1枚選び、掲示板スレとTypefully画像付き投稿を作成します。
      </p>

      <div className="mb-6 flex flex-wrap gap-4 rounded border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
        <span>現在の周回: <strong className="text-gray-800">{currentCycle}周目</strong></span>
        <span>公開カード: <strong className="text-gray-800">{totalCards}枚</strong></span>
        <span>今周回 使用済み: <strong className="text-gray-800">{usedCount}枚</strong></span>
        <span>今周回 残り: <strong className="text-gray-800">{remaining}枚</strong></span>
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold text-gray-700">0時投稿ジョブ履歴</h2>
        <div className="overflow-x-auto rounded border border-gray-200 bg-white">
          <table className="w-full text-xs">
            <thead className="border-b border-gray-100 bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">実行日</th>
                <th className="px-3 py-2 text-left font-medium">カード</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">状態</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">スレ</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Typefully</th>
                <th className="px-3 py-2 text-left font-medium">エラー</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {midnightRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                    まだ0時投稿ジョブの履歴はありません。
                  </td>
                </tr>
              ) : (
                midnightRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{row.run_date}</td>
                    <td className="px-3 py-2 text-gray-800">
                      {row.card_name}
                      {row.card_slug && <span className="ml-1.5 text-[10px] text-gray-400">{row.card_slug}</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={
                        row.status === 'posted'
                          ? 'rounded border border-green-300 bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700'
                          : row.status === 'failed'
                            ? 'rounded border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700'
                            : 'rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700'
                      }>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.thread_url || row.thread_id ? (
                        <a
                          href={row.thread_url ?? `/thread/${row.thread_id}`}
                          target="_blank"
                          className="text-blue-600 hover:underline"
                        >
                          #{row.thread_id ?? 'open'}
                        </a>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.typefully_url ? (
                        <a href={row.typefully_url} target="_blank" className="text-blue-600 hover:underline">
                          開く
                        </a>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="max-w-xs px-3 py-2 text-[10px] text-red-600">
                      {row.error_message ? <span className="line-clamp-2">{row.error_message}</span> : <span className="text-gray-300">-</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {midnightRows[0] && (
          <p className="mt-1 text-[10px] text-gray-400">最終実行: {formatDateTime(midnightRows[0].created_at)}</p>
        )}
      </section>

      {/* 直近30件の生成履歴 */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold text-gray-700">直近30件の生成履歴</h2>
        <div className="overflow-x-auto rounded border border-gray-200 bg-white">
          <table className="w-full text-xs">
            <thead className="border-b border-gray-100 bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">投稿日(JST)</th>
                <th className="px-3 py-2 text-left font-medium">カード</th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap w-16">周回</th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap w-20">スレ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gray-400">
                    まだ自動生成されたスレッドはありません。
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{log.posted_date}</td>
                    <td className="px-3 py-2 text-gray-800">
                      {nameMap.get(log.card_slug) ?? log.card_slug}
                      <span className="ml-1.5 text-[10px] text-gray-400">{log.card_slug}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600">{log.cycle_no}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {log.thread_id ? (
                        <a
                          href={`/thread/${log.thread_id}`}
                          target="_blank"
                          className="text-blue-600 hover:underline"
                        >
                          #{log.thread_id}
                        </a>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {logs[0] && (
          <p className="mt-1 text-[10px] text-gray-400">最終生成: {formatDateTime(logs[0].created_at)}</p>
        )}
      </section>

      {/* 今周回のカード使用状況 */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-700">
          今周回（{currentCycle}周目）のカード使用状況
          <span className="ml-1.5 text-xs font-normal text-gray-400">使用済み {usedCount} / {totalCards}</span>
        </h2>
        <div className="flex flex-wrap gap-1.5 rounded border border-gray-200 bg-white p-3">
          {totalCards === 0 ? (
            <p className="text-xs text-gray-400">公開カードがありません。</p>
          ) : (
            cards.map((c) => {
              const used = usedSlugs.has(c.slug)
              return (
                <span
                  key={c.slug}
                  className={
                    used
                      ? 'rounded border border-gray-300 bg-gray-100 px-2 py-0.5 text-[11px] text-gray-400 line-through'
                      : 'rounded border border-green-300 bg-green-50 px-2 py-0.5 text-[11px] text-green-700'
                  }
                  title={c.slug}
                >
                  {c.name}
                </span>
              )
            })
          )}
        </div>
        <p className="mt-1.5 text-[10px] text-gray-400">
          <span className="text-green-700">緑＝未使用</span> ／ <span className="text-gray-400 line-through">灰＝使用済み</span>
        </p>
      </section>
    </div>
  )
}
