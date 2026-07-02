import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdminCookie } from '@/lib/admin-auth'
import {
  addXBuzzUrls,
  holdXBuzzUrl,
  publishOneXBuzzUrl,
  publishSelectedXBuzzUrl,
  updateXBuzzStatus,
} from './actions'

export const dynamic = 'force-dynamic'

const ADMIN_COOKIE = 'admin_auth'

type XBuzzQueueRow = {
  id: number
  source_url: string
  status: string
  thread_id: number | null
  published_at: string | null
  error_message: string | null
  admin_note: string | null
  hold_reason: string | null
  created_at: string
  updated_at: string
}

const STATUS_LABELS: Record<string, string> = {
  pending: '未公開',
  processing: '処理中',
  published: '公開済み',
  failed: '失敗',
  hold: '保留',
  rejected: 'ボツ',
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'border-blue-200 bg-blue-50 text-blue-700',
  processing: 'border-amber-200 bg-amber-50 text-amber-700',
  published: 'border-green-200 bg-green-50 text-green-700',
  failed: 'border-red-200 bg-red-50 text-red-700',
  hold: 'border-gray-200 bg-gray-50 text-gray-600',
  rejected: 'border-zinc-200 bg-zinc-100 text-zinc-600',
}

async function isAdmin() {
  const cookieStore = await cookies()
  return verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
}

function ResultBox({
  searchParams,
}: {
  searchParams: {
    added?: string
    duplicate?: string
    invalid?: string
    failed?: string
    duplicateList?: string
    invalidList?: string
    published?: string
    error?: string
  }
}) {
  if (searchParams.error) {
    return (
      <div className="mb-3 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
        {searchParams.error}
      </div>
    )
  }

  if (searchParams.published) {
    return (
      <div className="mb-3 border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
        公開しました。スレID: {searchParams.published}
      </div>
    )
  }

  if (!searchParams.added && !searchParams.duplicate && !searchParams.invalid && !searchParams.failed) {
    return null
  }

  return (
    <div className="mb-3 border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 space-y-1">
      <p>
        登録 {searchParams.added ?? 0}件 / 重複スキップ {searchParams.duplicate ?? 0}件 /
        不正URL {searchParams.invalid ?? 0}件 / 失敗 {searchParams.failed ?? 0}件
      </p>
      {searchParams.duplicateList && (
        <pre className="whitespace-pre-wrap break-all rounded-none border border-blue-100 bg-white p-2 text-[11px] text-blue-700">
          {searchParams.duplicateList}
        </pre>
      )}
      {searchParams.invalidList && (
        <pre className="whitespace-pre-wrap break-all rounded-none border border-red-100 bg-white p-2 text-[11px] text-red-700">
          {searchParams.invalidList}
        </pre>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex shrink-0 border px-2 py-0.5 text-[11px] ${STATUS_STYLES[status] ?? STATUS_STYLES.hold}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

export default async function XBuzzAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    added?: string
    duplicate?: string
    invalid?: string
    failed?: string
    duplicateList?: string
    invalidList?: string
    published?: string
    error?: string
  }>
}) {
  if (!(await isAdmin())) redirect('/admin')

  const sp = await searchParams
  const admin = createAdminClient()
  const [{ count: pendingCount }, { count: publishedCount }, { count: failedCount }, { data: rows }] = await Promise.all([
    admin.from('x_buzz_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('x_buzz_queue').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    admin.from('x_buzz_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    admin
      .from('x_buzz_queue')
      .select('id, source_url, status, thread_id, published_at, error_message, admin_note, hold_reason, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const queueRows = (rows ?? []) as XBuzzQueueRow[]

  return (
    <div className="max-w-screen-lg mx-auto px-3 py-4 text-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold text-gray-800">X話題URLストック</h1>
        <Link href="/admin" className="text-xs text-gray-500 hover:underline">← 管理画面に戻る</Link>
      </div>

      <ResultBox searchParams={sp} />

      <section className="mb-4 grid grid-cols-3 gap-2">
        <div className="border border-gray-200 bg-white p-3">
          <div className="text-[11px] text-gray-500">未公開URL</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{pendingCount ?? 0}</div>
        </div>
        <div className="border border-gray-200 bg-white p-3">
          <div className="text-[11px] text-gray-500">公開済み</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{publishedCount ?? 0}</div>
        </div>
        <div className="border border-gray-200 bg-white p-3">
          <div className="text-[11px] text-gray-500">失敗</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{failedCount ?? 0}</div>
        </div>
      </section>

      <section className="mb-4 border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-3">
          <h2 className="font-bold text-gray-800">URLをまとめて登録</h2>
        </div>
        <form action={addXBuzzUrls} className="p-3 space-y-3">
          <textarea
            name="urls"
            rows={8}
            placeholder={'https://x.com/dmkeijiban/status/2072317476768223587\nhttps://twitter.com/dmkeijiban/status/2072317476768223587'}
            className="w-full border border-gray-300 px-3 py-2 text-sm leading-6 focus:outline-none focus:border-blue-400"
            required
          />
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
            <p className="text-[11px] text-gray-500">x.com / twitter.com の status URLだけ登録できます。</p>
            <button type="submit" className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white" style={{ background: '#0d6efd' }}>
              登録する
            </button>
          </div>
        </form>
      </section>

      <section className="mb-4 flex flex-col gap-2 border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold text-gray-800">手動公開</h2>
          <p className="mt-1 text-[11px] text-gray-500">古い登録順で pending のURLを1件だけスレ化します。</p>
        </div>
        <form action={publishOneXBuzzUrl}>
          <button type="submit" className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white" style={{ background: '#198754' }}>
            今すぐ1件公開
          </button>
        </form>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between border-b border-gray-200 pb-1">
          <h2 className="font-bold text-gray-700">URL一覧</h2>
          <span className="text-[11px] text-gray-400">最新100件</span>
        </div>

        {queueRows.length === 0 ? (
          <p className="border border-gray-200 bg-white p-4 text-xs text-gray-400">まだ登録がありません。</p>
        ) : (
          <div className="space-y-2">
            {queueRows.map((row) => (
              <div key={row.id} className="border border-gray-200 bg-white p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <StatusBadge status={row.status} />
                      <span className="text-[11px] text-gray-400">登録: {formatDate(row.created_at)}</span>
                      {row.published_at && <span className="text-[11px] text-gray-400">公開: {formatDate(row.published_at)}</span>}
                    </div>
                    <p className="break-all text-xs text-gray-800">{row.source_url}</p>
                    {row.thread_id && (
                      <Link href={`/thread/${row.thread_id}`} className="mt-1 inline-block text-xs text-blue-600 hover:underline">
                        公開済みスレを見る: /thread/{row.thread_id}
                      </Link>
                    )}
                    {row.error_message && (
                      <p className="mt-1 break-all text-[11px] text-red-600">エラー: {row.error_message}</p>
                    )}
                    {row.hold_reason && (
                      <p className="mt-1 break-all text-[11px] text-gray-500">保留理由: {row.hold_reason}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-1 sm:justify-end">
                    {row.status !== 'published' && (
                      <form action={publishSelectedXBuzzUrl}>
                        <input type="hidden" name="id" value={row.id} />
                        <button type="submit" className="px-2 py-1 text-[11px] text-green-700 border border-green-300 hover:bg-green-50">
                          今すぐ公開
                        </button>
                      </form>
                    )}
                    {row.status !== 'published' && row.status !== 'pending' && (
                      <form action={updateXBuzzStatus}>
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="status" value="pending" />
                        <button type="submit" className="px-2 py-1 text-[11px] text-blue-700 border border-blue-300 hover:bg-blue-50">
                          pendingに戻す
                        </button>
                      </form>
                    )}
                    {row.status !== 'published' && row.status !== 'hold' && (
                      <form action={holdXBuzzUrl} className="flex gap-1">
                        <input type="hidden" name="id" value={row.id} />
                        <input
                          name="hold_reason"
                          placeholder="理由"
                          className="w-20 border border-gray-300 px-1 py-1 text-[11px] sm:w-28"
                        />
                        <button type="submit" className="px-2 py-1 text-[11px] text-gray-700 border border-gray-300 hover:bg-gray-50">
                          保留
                        </button>
                      </form>
                    )}
                    {row.status !== 'published' && row.status !== 'rejected' && (
                      <form action={updateXBuzzStatus}>
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="status" value="rejected" />
                        <button type="submit" className="px-2 py-1 text-[11px] text-red-700 border border-red-300 hover:bg-red-50">
                          ボツ
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
