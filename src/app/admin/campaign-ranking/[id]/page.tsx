import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { verifyAdminCookie } from '@/lib/admin-auth'
import {
  fetchCampaignEventById,
  fetchCampaignRankingFull,
  utcToJstDisplay,
  utcToDatetimeLocalJst,
  resolveCampaignEventState,
  type CampaignEvent,
} from '@/lib/campaign-ranking'
import { updateCampaignEventAction } from '../actions'
import { DeleteEventButton } from '../DeleteEventButton'

const ADMIN_COOKIE = 'admin_auth'

async function requireAdmin() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) {
    redirect('/admin')
  }
}

const STATE_LABELS = {
  active: '開催中',
  scheduled: '予約中',
  ended: '終了',
  disabled: '無効',
}

const STATE_BADGE = {
  active: 'border-green-300 bg-green-100 text-green-800',
  scheduled: 'border-blue-300 bg-blue-100 text-blue-800',
  ended: 'border-gray-300 bg-gray-100 text-gray-600',
  disabled: 'border-gray-200 bg-gray-50 text-gray-400',
}

const ERROR_MESSAGES: Record<string, string> = {
  required: 'タイトル・開始日時・終了日時は必須です',
  invalid_datetime: '日時の形式が正しくありません',
  invalid_range: '終了日時は開始日時より後にしてください',
  invalid_rules_url: 'ルールURLは /thread/{数字} または https://www.duema-bbs.com/thread/{数字} 形式で入力してください',
  save_failed: '保存に失敗しました。しばらくしてから再試行してください',
}

export default async function EditCampaignEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string; created?: string; error?: string }>
}) {
  await requireAdmin()

  const { id: idStr } = await params
  const id = Number(idStr)
  if (!id || isNaN(id)) notFound()

  const eventOrNull = await fetchCampaignEventById(id)
  if (!eventOrNull) notFound()
  const event = eventOrNull as CampaignEvent

  const sp = await searchParams
  const state = resolveCampaignEventState(event)

  const rankingResult = await fetchCampaignRankingFull(event.start_at, event.end_at)

  return (
    <div className="max-w-screen-lg mx-auto px-3 py-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-800">キャンペーン編集</h1>
          <span className={`rounded border px-2 py-0.5 text-xs font-bold ${STATE_BADGE[state]}`}>
            {STATE_LABELS[state]}
          </span>
        </div>
        <Link href="/admin/campaign-ranking" className="text-xs text-blue-600 hover:underline">← 一覧に戻る</Link>
      </div>

      {(sp.saved === '1' || sp.created === '1') && (
        <div className="mb-4 border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-800">
          {sp.created === '1' ? 'キャンペーンを作成しました' : '保存しました'}
        </div>
      )}
      {sp.error && (
        <div className="mb-4 border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
          {ERROR_MESSAGES[sp.error] ?? 'エラーが発生しました'}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Edit form */}
        <section>
          <form action={updateCampaignEventAction} className="space-y-4 rounded border border-gray-200 bg-white p-4">
            <input type="hidden" name="id" value={String(event.id)} />

            <div className="flex items-center gap-4">
              <span className="w-28 shrink-0 font-medium text-gray-700">有効</span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="campaign_enabled"
                  value="on"
                  defaultChecked={event.status === 'active'}
                />
                <span>ON（有効）</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="campaign_enabled"
                  value="off"
                  defaultChecked={event.status !== 'active'}
                />
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
                defaultValue={event.title}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
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
                defaultValue={utcToDatetimeLocalJst(event.start_at)}
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
                defaultValue={utcToDatetimeLocalJst(event.end_at)}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-medium text-gray-700" htmlFor="campaign_prize">賞品</label>
              <input
                id="campaign_prize"
                name="campaign_prize"
                type="text"
                defaultValue={event.prize}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-medium text-gray-700" htmlFor="campaign_rules_url">ルールURL</label>
              <input
                id="campaign_rules_url"
                name="campaign_rules_url"
                type="text"
                defaultValue={event.rules_url}
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
                保存する
              </button>
            </div>
          </form>

          <div className="mt-3 flex items-center gap-2">
            <p className="text-[11px] text-gray-400">
              作成: {utcToJstDisplay(event.created_at)} ／ 更新: {utcToJstDisplay(event.updated_at)}
            </p>
          </div>

          <div className="mt-4">
            <DeleteEventButton id={event.id} title={event.title} />
          </div>
        </section>

        {/* Ranking preview */}
        <section>
          <h2 className="mb-2 text-base font-bold text-gray-700">
            ランキングプレビュー
            <span className="ml-2 text-xs font-normal text-gray-400">
              {utcToJstDisplay(event.start_at)} 〜 {utcToJstDisplay(event.end_at)}
            </span>
          </h2>

          {rankingResult.error ? (
            <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
              集計エラー: {rankingResult.error}
            </div>
          ) : rankingResult.overflow ? (
            <div className="rounded border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
              データが多すぎるため表示できません（1万件超）
            </div>
          ) : (
            <div className="overflow-x-auto rounded border border-gray-200 bg-white">
              {rankingResult.entries.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-gray-400">
                  この期間の参加者はいません
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left text-[11px] text-gray-500">
                      <th className="px-2 py-1.5">#</th>
                      <th className="px-2 py-1.5">ユーザー</th>
                      <th className="px-2 py-1.5 text-right">pt</th>
                      <th className="px-2 py-1.5 text-right">スレ</th>
                      <th className="px-2 py-1.5 text-right">投稿</th>
                      <th className="px-2 py-1.5 text-right">レビュー</th>
                      <th className="px-2 py-1.5 text-right">評価日</th>
                      <th className="px-2 py-1.5">除外理由</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rankingResult.entries.map((entry, i) => {
                      const excluded = entry.excludeReasons.length > 0
                      const name = entry.profile?.display_name
                        ?? entry.profile?.profile_slug
                        ?? entry.userId.slice(0, 8) + '...'
                      return (
                        <tr
                          key={entry.userId}
                          className={excluded ? 'opacity-40' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                        >
                          <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                          <td className="px-2 py-1 max-w-[10rem] truncate font-medium text-gray-800">
                            {entry.profile?.profile_slug ? (
                              <a
                                href={`/u/${entry.profile.profile_slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline text-blue-600"
                              >
                                {name}
                              </a>
                            ) : name}
                          </td>
                          <td className="px-2 py-1 text-right font-bold text-gray-800">{entry.totalPoints}</td>
                          <td className="px-2 py-1 text-right text-gray-600">{entry.threadCount}</td>
                          <td className="px-2 py-1 text-right text-gray-600">{entry.postCount}</td>
                          <td className="px-2 py-1 text-right text-gray-600">{entry.reviewCount}</td>
                          <td className="px-2 py-1 text-right text-gray-600">{entry.ratingDays}</td>
                          <td className="px-2 py-1 text-[10px] text-red-500">
                            {entry.excludeReasons.join(', ')}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
              <p className="border-t border-gray-100 px-3 py-1.5 text-[11px] text-gray-400">
                合計 {rankingResult.entries.length} 人（除外含む）
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
