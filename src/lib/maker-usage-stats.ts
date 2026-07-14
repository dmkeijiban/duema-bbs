import { getJstTodayCutoffUtcIso } from '@/lib/campaign-ranking'
import { createAdminClient } from '@/lib/supabase-admin'
import type { MakerEventType } from '@/lib/maker-events-shared'

export type MakerEventCounter = {
  total: number
  today: number
  uniqueActors: number
  todayUniqueActors: number
}

export type MakerUsageStats = {
  // 既存DB（maker_submissions）から算出
  registrantCount: number
  submissionCount: number
  anonymousSubmissionCount: number
  todayNewRegistrantCount: number
  todaySubmissionActivityCount: number
  lastSubmissionAt: string | null
  acquisitionStatsAvailable: boolean
  // maker_events（計測開始後のみ）から算出
  events: Record<MakerEventType, MakerEventCounter>
}

type SubmissionRow = { created_at: string; updated_at: string; user_id: string | null }
type EventStatsRow = { event_type: string; total_count: number; today_count: number; unique_actors: number; today_unique_actors: number }

function emptyCounter(): MakerEventCounter {
  return { total: 0, today: 0, uniqueActors: 0, todayUniqueActors: 0 }
}

/**
 * 企画（project_id）単位の利用状況を集計する。特定企画に依存しない共通実装。
 * 呼び出し側は管理者チェック済みであること（service roleでRLSをバイパスするため）。
 */
export async function fetchMakerUsageStats(projectId: string): Promise<MakerUsageStats> {
  const admin = createAdminClient()
  const todayStartIso = getJstTodayCutoffUtcIso()

  const [submissionsResult, eventStatsV2Result] = await Promise.all([
    admin.from('maker_submissions').select('created_at,updated_at,user_id').eq('project_id', projectId).eq('is_valid', true),
    admin.rpc('maker_event_stats_v2', { p_project_id: projectId, p_today_start: todayStartIso }),
  ])

  if (submissionsResult.error) throw new Error(`回答データを取得できませんでした: ${submissionsResult.error.message}`)

  // migration反映前のDBでも既存統計を表示し続ける。v2適用後は通常どおりv2を使う。
  const eventStatsResult = eventStatsV2Result.error
    ? await admin.rpc('maker_event_stats', { p_project_id: projectId, p_today_start: todayStartIso })
    : eventStatsV2Result
  if (eventStatsResult.error) throw new Error(`イベント集計を取得できませんでした: ${eventStatsResult.error.message}`)

  const submissions = (submissionsResult.data ?? []) as SubmissionRow[]
  const todayStartMs = new Date(todayStartIso).getTime()
  let todayNewRegistrantCount = 0
  let todaySubmissionActivityCount = 0
  let lastSubmissionAt: string | null = null
  for (const row of submissions) {
    if (row.user_id && new Date(row.created_at).getTime() >= todayStartMs) todayNewRegistrantCount += 1
    if (new Date(row.updated_at).getTime() >= todayStartMs) todaySubmissionActivityCount += 1
    if (!lastSubmissionAt || row.updated_at > lastSubmissionAt) lastSubmissionAt = row.updated_at
  }

  const events: Record<MakerEventType, MakerEventCounter> = {
    tier_created: emptyCounter(),
    image_saved: emptyCounter(),
    x_shared: emptyCounter(),
    aggregate_viewed: emptyCounter(),
    page_viewed: emptyCounter(),
    auth_cta_clicked: emptyCounter(),
    signup_completed: emptyCounter(),
    submission_after_signup: emptyCounter(),
  }
  for (const row of (eventStatsResult.data ?? []) as EventStatsRow[]) {
    if (row.event_type in events) {
      events[row.event_type as MakerEventType] = {
        total: Number(row.total_count) || 0,
        today: Number(row.today_count) || 0,
        uniqueActors: Number(row.unique_actors) || 0,
        todayUniqueActors: Number(row.today_unique_actors) || 0,
      }
    }
  }

  return {
    // 登録者数はログイン済みユーザーのdistinct数。匿名回答は別集計にする。
    registrantCount: new Set(submissions.flatMap(row => row.user_id ? [row.user_id] : [])).size,
    submissionCount: submissions.length,
    anonymousSubmissionCount: submissions.filter(row => row.user_id === null).length,
    todayNewRegistrantCount,
    todaySubmissionActivityCount,
    lastSubmissionAt,
    acquisitionStatsAvailable: !eventStatsV2Result.error,
    events,
  }
}

export function formatJstDateTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  return `${get('year')}/${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`
}

export function formatRate(numerator: number, denominator: number): string {
  if (!denominator) return '—'
  return `${(numerator / denominator * 100).toFixed(1)}%`
}
