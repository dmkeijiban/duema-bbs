import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { verifyAdminCookie } from '@/lib/admin-auth'
import {
  fetchAllCampaignEvents,
  resolveCampaignEventState,
  utcToJstDisplay,
  type CampaignEvent,
  type CampaignState,
} from '@/lib/campaign-ranking'
import { DeleteEventButton } from './DeleteEventButton'

const ADMIN_COOKIE = 'admin_auth'

async function requireAdmin() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) {
    redirect('/admin')
  }
}

function isNextInternalError(e: unknown): boolean {
  const digest = (e as { digest?: string })?.digest ?? ''
  return digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND')
}

const STATE_ORDER: CampaignState[] = ['active', 'scheduled', 'ended', 'disabled']

const STATE_LABELS: Record<CampaignState, string> = {
  active: '開催中',
  scheduled: '予約中',
  ended: '終了',
  disabled: '無効',
}

const STATE_BADGE: Record<CampaignState, string> = {
  active: 'border-green-300 bg-green-100 text-green-800',
  scheduled: 'border-blue-300 bg-blue-100 text-blue-800',
  ended: 'border-gray-300 bg-gray-100 text-gray-600',
  disabled: 'border-gray-200 bg-gray-50 text-gray-400',
}

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: '認証エラーです。再ログインしてください',
  delete_failed: '削除に失敗しました',
  invalid_id: 'IDが不正です',
}

export default async function CampaignRankingListPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; deleted?: string; error?: string }>
}) {
  try {
    await requireAdmin()
  } catch (e) {
    if (isNextInternalError(e)) throw e
    throw e
  }

  const sp = await searchParams
  const { events, error: fetchError } = await fetchAllCampaignEvents()

  const grouped = new Map<CampaignState, CampaignEvent[]>(
    STATE_ORDER.map(s => [s, []])
  )
  for (const event of events) {
    grouped.get(resolveCampaignEventState(event))!.push(event)
  }

  return (
    <div className="max-w-screen-xl mx-auto px-3 py-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">🏆 キャンペーンランキング管理</h1>
        <Link href="/admin" className="text-xs text-blue-600 hover:underline">← 管理画面に戻る</Link>
      </div>

      {sp.created === '1' && (
        <div className="mb-4 border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-800">
          キャンペーンを作成しました
        </div>
      )}
      {sp.deleted === '1' && (
        <div className="mb-4 border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
          キャンペーンを削除しました
        </div>
      )}
      {sp.error && (
        <div className="mb-4 border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
          {ERROR_MESSAGES[sp.error] ?? 'エラーが発生しました'}
        </div>
      )}
      {fetchError && (
        <div className="mb-4 border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
          一覧の取得に失敗しました: {fetchError}
        </div>
      )}

      <div className="mb-4 border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
        有効 <strong>ON</strong>：開催中または終了結果を /ranking に表示します。有効 <strong>OFF</strong>：管理画面には残りますが /ranking には表示されません。
      </div>

      <div className="mb-5">
        <Link
          href="/admin/campaign-ranking/new"
          className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
        >
          ＋ 新規キャンペーンを作成
        </Link>
      </div>

      {events.length === 0 && !fetchError && (
        <div className="border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
          キャンペーンがありません。新規作成してください。
        </div>
      )}

      {STATE_ORDER.map((state) => {
        const stateEvents = grouped.get(state) ?? []
        if (stateEvents.length === 0) return null
        return (
          <section key={state} className="mb-5">
            <h2 className={`mb-2 inline-block rounded border px-2 py-0.5 text-xs font-bold ${STATE_BADGE[state]}`}>
              {STATE_LABELS[state]}（{stateEvents.length}件）
            </h2>
            <div className="space-y-2">
              {stateEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-white px-3 py-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 truncate">{event.title}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {utcToJstDisplay(event.start_at)} 〜 {utcToJstDisplay(event.end_at)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      有効: <span className={event.status === 'active' ? 'text-green-700 font-bold' : 'text-gray-400'}>
                        {event.status === 'active' ? 'ON' : 'OFF'}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/admin/campaign-ranking/${event.id}`}
                      className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                    >
                      編集
                    </Link>
                    <DeleteEventButton id={event.id} title={event.title} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
