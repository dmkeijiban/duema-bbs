import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { saveCampaignRankingAction } from './actions'

const ADMIN_COOKIE = 'admin_auth'

async function requireAdmin() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) {
    redirect('/admin')
  }
}

function toDatetimeLocal(isoJst: string): string {
  // "2026-06-20T00:00:00+09:00" → "2026-06-20T00:00"
  if (!isoJst) return ''
  const m = isoJst.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/)
  return m ? m[1] : ''
}

function toDisplayJst(isoJst: string): string {
  if (!isoJst) return ''
  const m = isoJst.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return isoJst
  return `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}`
}

export default async function CampaignRankingPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams

  const supabase = createAdminClient()
  const { data: rows } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', ['campaign_status', 'campaign_title', 'campaign_start', 'campaign_end', 'campaign_prize', 'campaign_rules_url'])

  const settings: Record<string, string> = {}
  for (const row of rows ?? []) {
    settings[row.key] = row.value
  }

  const status = settings['campaign_status'] ?? 'draft'
  const title = settings['campaign_title'] ?? ''
  const startIso = settings['campaign_start'] ?? ''
  const endIso = settings['campaign_end'] ?? ''
  const prize = settings['campaign_prize'] ?? ''
  const rulesUrl = settings['campaign_rules_url'] ?? ''

  const STATUS_LABELS: Record<string, string> = {
    draft: '下書き（非公開）',
    active: '開催中',
    ended: '終了',
    finalized: '確定済み',
  }

  const ERROR_MESSAGES: Record<string, string> = {
    unauthorized: '認証エラーです。再ログインしてください',
    invalid_status: 'ステータスが不正です',
    required: '必須項目を入力してください',
    invalid_datetime: '日時の形式が正しくありません',
    invalid_range: '終了日時は開始日時より後にしてください',
    invalid_rules_url: 'ルールスレッドURLを確認してください（/thread/数字 または https://www.duema-bbs.com/thread/数字）',
    save_failed: 'キャンペーン設定の保存に失敗しました',
  }

  return (
    <div className="max-w-screen-xl mx-auto px-3 py-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">🏆 キャンペーンランキング設定</h1>
        <div className="flex gap-3">
          <Link href="/admin" className="text-xs text-blue-600 hover:underline">← 管理画面に戻る</Link>
        </div>
      </div>

      {sp.saved === '1' && (
        <div className="mb-4 border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-800">
          キャンペーン設定を保存しました
        </div>
      )}

      {sp.error && (
        <div className="mb-4 border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
          {ERROR_MESSAGES[sp.error] ?? 'キャンペーン設定の保存に失敗しました'}
        </div>
      )}

      <p className="text-xs text-gray-500 mb-4">
        投稿者ランキング企画の開催期間や公開状態を設定します。設定を保存しても、公開ランキング機能が実装されるまでは一般画面には表示されません。
      </p>

      <div className="bg-white border border-gray-200 p-4 mb-4">
        <h2 className="font-bold text-blue-700 mb-3 text-xs uppercase tracking-wide">現在の設定</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-gray-500 whitespace-nowrap">ステータス</dt>
          <dd className="text-gray-800 font-medium">{STATUS_LABELS[status] ?? status}</dd>
          <dt className="text-gray-500 whitespace-nowrap">タイトル</dt>
          <dd className="text-gray-800">{title || '（未設定）'}</dd>
          <dt className="text-gray-500 whitespace-nowrap">開始日時 (JST)</dt>
          <dd className="text-gray-800">{toDisplayJst(startIso) || '（未設定）'}</dd>
          <dt className="text-gray-500 whitespace-nowrap">終了日時 (JST)</dt>
          <dd className="text-gray-800">{toDisplayJst(endIso) || '（未設定）'}</dd>
          <dt className="text-gray-500 whitespace-nowrap">賞品</dt>
          <dd className="text-gray-800">{prize || '（未設定）'}</dd>
          <dt className="text-gray-500 whitespace-nowrap">ルールURL</dt>
          <dd className="text-gray-800 break-all">{rulesUrl || '（未設定）'}</dd>
        </dl>
      </div>

      <div className="bg-white border border-gray-200 p-4">
        <h2 className="font-bold text-blue-700 mb-3 text-xs uppercase tracking-wide">設定を編集</h2>
        <form action={saveCampaignRankingAction} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-0.5">
              ステータス <span className="text-red-500">*</span>
            </label>
            <select
              name="campaign_status"
              defaultValue={status}
              className="border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 w-48"
              required
            >
              <option value="draft">下書き（非公開）</option>
              <option value="active">開催中</option>
              <option value="ended">終了</option>
              <option value="finalized">確定済み</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-0.5">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="campaign_title"
              defaultValue={title}
              placeholder="例: 6月投稿者ランキング企画"
              className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">
                開始日時（日本時間）<span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                name="campaign_start"
                defaultValue={toDatetimeLocal(startIso)}
                className="border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 w-full"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">
                終了日時（日本時間）<span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                name="campaign_end"
                defaultValue={toDatetimeLocal(endIso)}
                className="border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 w-full"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-0.5">賞品</label>
            <input
              type="text"
              name="campaign_prize"
              defaultValue={prize}
              placeholder="例: Amazonギフト券1000円分"
              className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-0.5">ルールURL</label>
            <input
              type="text"
              name="campaign_rules_url"
              defaultValue={rulesUrl}
              placeholder="/thread/123 または https://www.duema-bbs.com/thread/123"
              className="w-full border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          <div className="pt-1">
            <button
              type="submit"
              className="px-4 py-1.5 text-white text-xs font-medium"
              style={{ background: '#0d6efd' }}
            >
              保存する
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
