import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { saveCampaignRankingAction } from './actions'
import { ClearButton } from './ClearButton'
import {
  CAMPAIGN_THREAD_POINT,
  CAMPAIGN_THREAD_DAILY_LIMIT,
  CAMPAIGN_POST_POINT,
  CAMPAIGN_POST_DAILY_LIMIT,
  CAMPAIGN_REVIEW_POINT,
  CAMPAIGN_REVIEW_DAILY_LIMIT,
  CAMPAIGN_RATING_DAILY_THRESHOLD,
  CAMPAIGN_RATING_DAILY_POINT,
} from '@/lib/ranking-points'
import {
  fetchCampaignRankingFull,
  fetchCampaignSettings,
  resolveCampaignState,
  toDisplayJst,
  type AdminCampaignEntry,
  type CampaignRankingAdminResult,
} from '@/lib/campaign-ranking'

const ADMIN_COOKIE = 'admin_auth'
const MAX_DISPLAY = 100

// ---- Admin helpers ----

async function requireAdmin() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) {
    redirect('/admin')
  }
}

function toDatetimeLocal(isoJst: string): string {
  if (!isoJst) return ''
  const m = isoJst.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/)
  return m ? m[1] : ''
}

// Next.js redirect/not-found errors must not be swallowed
function isNextInternalError(e: unknown): boolean {
  const digest = (e as { digest?: string })?.digest ?? ''
  return digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND')
}

// ---- Page ----

export default async function CampaignRankingPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; cleared?: string; error?: string }>
}) {
  // Auth check — redirect errors must propagate to Next.js, not be swallowed
  try {
    await requireAdmin()
  } catch (e) {
    if (isNextInternalError(e)) throw e
    console.error('[campaign-ranking] requireAdmin:error', e)
    throw e
  }

  const SETTINGS_DEFAULT = { status: 'draft', title: '', startIso: '', endIso: '', prize: '', rulesUrl: '' }

  let sp: { saved?: string; cleared?: string; error?: string } = {}
  let settings = SETTINGS_DEFAULT
  let settingsError: string | null = null
  let rankingResult: CampaignRankingAdminResult | null = null
  let renderError: string | null = null

  try {
    sp = await searchParams

    try {
      settings = await fetchCampaignSettings()
    } catch (e) {
      console.error('[campaign-ranking] fetchCampaignSettings:error', e)
      settingsError = e instanceof Error ? e.message : 'キャンペーン設定の読み込みに失敗しました'
      settings = SETTINGS_DEFAULT
    }

    if (!settingsError && settings.startIso && settings.endIso) {
      try {
        rankingResult = await fetchCampaignRankingFull(settings.startIso, settings.endIso)
      } catch (e) {
        console.error('[campaign-ranking] fetchCampaignRankingFull:error', e)
        rankingResult = { entries: [], error: e instanceof Error ? e.message : '集計に失敗しました', overflow: false }
      }
    }
  } catch (e) {
    if (isNextInternalError(e)) throw e
    console.error('[campaign-ranking] top-level:error', e)
    renderError = e instanceof Error ? `${e.name}: ${e.message}\n${e.stack ?? ''}` : String(e)
  }

  // Show inline error instead of full-screen crash
  if (renderError) {
    return (
      <div className="max-w-screen-xl mx-auto px-3 py-4 text-sm">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800">🏆 キャンペーンランキング設定</h1>
          <Link href="/admin" className="text-xs text-blue-600 hover:underline">← 管理画面に戻る</Link>
        </div>
        <div className="border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-800">
          <p className="font-bold mb-1">ページ読み込みエラー（Vercel Function Logs で詳細を確認してください）</p>
          <pre className="mt-2 font-mono text-[10px] whitespace-pre-wrap break-all">{renderError}</pre>
        </div>
      </div>
    )
  }

  const { status, title, startIso, endIso, prize, rulesUrl } = settings

  const campaignState = resolveCampaignState(settings)
  const STATE_LABELS = {
    disabled: '無効',
    scheduled: '予約中',
    active: '開催中',
    ended: '終了',
  } as const

  const isEnabled = status === 'active'

  const ERROR_MESSAGES: Record<string, string> = {
    unauthorized: '認証エラーです。再ログインしてください',
    invalid_status: 'ステータスが不正です',
    required: '必須項目を入力してください',
    invalid_datetime: '日時の形式が正しくありません',
    invalid_range: '終了日時は開始日時より後にしてください',
    invalid_rules_url: 'ルールスレッドURLを確認してください（/thread/数字 または https://www.duema-bbs.com/thread/数字）',
    save_failed: 'キャンペーン設定の保存に失敗しました',
  }

  // Fetch ranking preview only when campaign period is configured
  const displayed = rankingResult?.entries.slice(0, MAX_DISPLAY) ?? []
  const totalEntrants = rankingResult?.entries.length ?? 0

  return (
    <div className="max-w-screen-xl mx-auto px-3 py-4 text-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">🏆 キャンペーンランキング設定</h1>
        <Link href="/admin" className="text-xs text-blue-600 hover:underline">← 管理画面に戻る</Link>
      </div>

      {sp.saved === '1' && (
        <div className="mb-4 border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-800">
          キャンペーン設定を保存しました
        </div>
      )}
      {sp.cleared === '1' && (
        <div className="mb-4 border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
          キャンペーン設定をクリアしました
        </div>
      )}
      {sp.error && (
        <div className="mb-4 border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
          {ERROR_MESSAGES[sp.error] ?? 'キャンペーン設定の保存に失敗しました'}
        </div>
      )}
      {settingsError && (
        <div className="mb-4 border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
          設定の読み込みに失敗しました: {settingsError}
        </div>
      )}

      <p className="text-xs text-gray-500 mb-4">
        投稿者ランキング企画の設定。有効ONかつ期間内の場合、<strong>/ranking</strong> にキャンペーンランキングが公開表示されます。終了後も結果として表示されます。
      </p>

      {/* Settings display */}
      <div className="bg-white border border-gray-200 p-4 mb-4">
        <h2 className="font-bold text-blue-700 mb-3 text-xs uppercase tracking-wide">現在の設定</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-gray-500 whitespace-nowrap">キャンペーン有効</dt>
          <dd className={`font-bold ${isEnabled ? 'text-green-700' : 'text-gray-400'}`}>
            {isEnabled ? 'ON（有効）' : 'OFF（無効）'}
          </dd>
          <dt className="text-gray-500 whitespace-nowrap">現在の状態</dt>
          <dd className={`font-medium ${
            campaignState === 'active' ? 'text-green-700' :
            campaignState === 'scheduled' ? 'text-blue-600' :
            campaignState === 'ended' ? 'text-gray-500' : 'text-gray-400'
          }`}>
            {STATE_LABELS[campaignState]}
          </dd>
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

      {/* Edit form */}
      <div className="bg-white border border-gray-200 p-4 mb-6">
        <h2 className="font-bold text-blue-700 mb-3 text-xs uppercase tracking-wide">設定を編集</h2>
        <form action={saveCampaignRankingAction} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              キャンペーン有効 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="campaign_enabled"
                  value="on"
                  defaultChecked={isEnabled}
                  className="accent-green-600"
                />
                <span className="font-medium text-green-700">ON（有効）</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="campaign_enabled"
                  value="off"
                  defaultChecked={!isEnabled}
                  className="accent-gray-500"
                />
                <span className="text-gray-600">OFF（無効）</span>
              </label>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              実際の公開状態は開始・終了日時から自動判定されます
            </p>
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

        <ClearButton />
      </div>

      {/* Ranking preview */}
      <div className="bg-white border border-gray-200 p-4">
        <h2 className="font-bold text-blue-700 mb-1 text-xs uppercase tracking-wide">
          ランキング集計プレビュー
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          スレ {CAMPAIGN_THREAD_POINT}pt（{CAMPAIGN_THREAD_DAILY_LIMIT}件/日上限）
          コメント {CAMPAIGN_POST_POINT}pt（{CAMPAIGN_POST_DAILY_LIMIT}件/日上限）
          レビュー {CAMPAIGN_REVIEW_POINT}pt（{CAMPAIGN_REVIEW_DAILY_LIMIT}件/日上限・カード+パック合算）
          評価 {CAMPAIGN_RATING_DAILY_THRESHOLD}件/日達成で{CAMPAIGN_RATING_DAILY_POINT}pt（ログインのみ）
        </p>

        {!startIso || !endIso ? (
          <p className="text-xs text-gray-400">キャンペーン期間を設定すると集計結果が表示されます。</p>
        ) : rankingResult?.error ? (
          <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            集計エラー: {rankingResult.error}
          </div>
        ) : totalEntrants === 0 ? (
          <p className="text-xs text-gray-400">対象期間のアクティビティがありません。</p>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-2">
              参加者 {totalEntrants}人
              {totalEntrants > MAX_DISPLAY && `（上位${MAX_DISPLAY}人を表示）`}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="border border-gray-200 px-2 py-1 text-center whitespace-nowrap">#</th>
                    <th className="border border-gray-200 px-2 py-1 text-left whitespace-nowrap">ユーザー</th>
                    <th className="border border-gray-200 px-2 py-1 text-center whitespace-nowrap">合計P</th>
                    <th className="border border-gray-200 px-2 py-1 text-center whitespace-nowrap">コメント</th>
                    <th className="border border-gray-200 px-2 py-1 text-center whitespace-nowrap">レビュー</th>
                    <th className="border border-gray-200 px-2 py-1 text-center whitespace-nowrap">スレ</th>
                    <th className="border border-gray-200 px-2 py-1 text-center whitespace-nowrap">評価達成日</th>
                    <th className="border border-gray-200 px-2 py-1 text-left whitespace-nowrap">最終加点</th>
                    <th className="border border-gray-200 px-2 py-1 text-center whitespace-nowrap">X</th>
                    <th className="border border-gray-200 px-2 py-1 text-left whitespace-nowrap">備考</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((entry: AdminCampaignEntry, idx: number) => {
                    const excludeReasons: string[] = Array.isArray(entry.excludeReasons) ? entry.excludeReasons : []
                    const isExcluded = excludeReasons.length > 0
                    const name = entry.profile?.display_name ?? '（名前なし）'
                    const slug = entry.profile?.profile_slug
                    const lastAt = entry.lastActivity
                      ? toDisplayJst(new Date(entry.lastActivity).toISOString().replace('Z', '+00:00').replace(/\.\d+/, '').replace('T', 'T'))
                      : '—'
                    return (
                      <tr
                        key={entry.userId}
                        className={isExcluded ? 'bg-gray-50 text-gray-400' : 'hover:bg-blue-50'}
                      >
                        <td className="border border-gray-200 px-2 py-1 text-center font-mono">
                          {isExcluded ? '—' : idx + 1}
                        </td>
                        <td className="border border-gray-200 px-2 py-1 max-w-[12rem] truncate">
                          {slug ? (
                            <Link
                              href={`/profile/${slug}`}
                              target="_blank"
                              className="text-blue-600 hover:underline"
                            >
                              {name}
                            </Link>
                          ) : (
                            <span>{name}</span>
                          )}
                          <span className="ml-1 font-mono text-gray-300 text-[10px]">
                            {entry.userId.slice(0, 8)}
                          </span>
                        </td>
                        <td className="border border-gray-200 px-2 py-1 text-center font-bold">
                          {entry.totalPoints}
                        </td>
                        <td className="border border-gray-200 px-2 py-1 text-center">
                          {entry.postCount}
                          <span className="text-gray-300">/{entry.postRawCount}</span>
                        </td>
                        <td className="border border-gray-200 px-2 py-1 text-center">
                          {entry.reviewCount}
                          <span className="text-gray-300">/{entry.cardReviewRawCount + entry.packReviewRawCount}</span>
                        </td>
                        <td className="border border-gray-200 px-2 py-1 text-center">
                          {entry.threadCount}
                          <span className="text-gray-300">/{entry.threadRawCount}</span>
                        </td>
                        <td className="border border-gray-200 px-2 py-1 text-center">
                          {entry.ratingDays}日
                          <span className="text-gray-300">/{entry.ratingRawCount}件</span>
                        </td>
                        <td className="border border-gray-200 px-2 py-1 text-[10px] whitespace-nowrap">
                          {lastAt}
                        </td>
                        <td className="border border-gray-200 px-2 py-1 text-center text-[10px]">
                          {(() => {
                            const u = entry.profile?.x_url ?? null
                            const safe = u && /^https:\/\/(x\.com|twitter\.com)\//.test(u)
                            return safe ? (
                              <a href={u} target="_blank" rel="nofollow noopener noreferrer" className="text-blue-500 hover:underline">X</a>
                            ) : '—'}
                          )()}
                        </td>
                        <td className="border border-gray-200 px-2 py-1 text-[10px] text-red-500">
                          {excludeReasons.join(' / ')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
