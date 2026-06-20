import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { createCampaignEventAction } from '../actions'

const ADMIN_COOKIE = 'admin_auth'

async function requireAdmin() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) {
    redirect('/admin')
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  required: 'タイトル・開始日時・終了日時は必須です',
  invalid_datetime: '日時の形式が正しくありません',
  invalid_range: '終了日時は開始日時より後にしてください',
  invalid_rules_url: 'ルールURLは /thread/{数字} または https://www.duema-bbs.com/thread/{数字} 形式で入力してください',
  save_failed: '保存に失敗しました。しばらくしてから再試行してください',
}

export default async function NewCampaignEventPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  await requireAdmin()

  const sp = await searchParams

  return (
    <div className="max-w-xl mx-auto px-3 py-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">＋ 新規キャンペーン作成</h1>
        <Link href="/admin/campaign-ranking" className="text-xs text-blue-600 hover:underline">← 一覧に戻る</Link>
      </div>

      {sp.error && (
        <div className="mb-4 border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
          {ERROR_MESSAGES[sp.error] ?? 'エラーが発生しました'}
        </div>
      )}

      <form action={createCampaignEventAction} className="space-y-4 rounded border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-4">
          <span className="w-28 shrink-0 font-medium text-gray-700">有効</span>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" name="campaign_enabled" value="on" defaultChecked />
            <span>ON（有効）</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" name="campaign_enabled" value="off" />
            <span>OFF（無効）</span>
          </label>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-700" htmlFor="campaign_title">
            タイトル <span className="text-red-500">*</span>
          </label>
          <input
            id="campaign_title"
            name="campaign_title"
            type="text"
            required
            className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
            placeholder="例：6月キャンペーン"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-700" htmlFor="campaign_start">
            開始日時（JST）<span className="text-red-500">*</span>
          </label>
          <input
            id="campaign_start"
            name="campaign_start"
            type="datetime-local"
            required
            className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-700" htmlFor="campaign_end">
            終了日時（JST）<span className="text-red-500">*</span>
          </label>
          <input
            id="campaign_end"
            name="campaign_end"
            type="datetime-local"
            required
            className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-700" htmlFor="campaign_prize">賞品</label>
          <input
            id="campaign_prize"
            name="campaign_prize"
            type="text"
            className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
            placeholder="例：Amazonギフト券1000円"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-700" htmlFor="campaign_rules_url">ルールURL</label>
          <input
            id="campaign_rules_url"
            name="campaign_rules_url"
            type="text"
            className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
            placeholder="/thread/123 または https://www.duema-bbs.com/thread/123"
          />
          <p className="text-[11px] text-gray-400">/thread/数字 形式で入力してください（省略可）</p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
          >
            作成する
          </button>
          <Link
            href="/admin/campaign-ranking"
            className="rounded border border-gray-300 px-4 py-2 text-xs text-gray-600 hover:bg-gray-50"
          >
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  )
}
