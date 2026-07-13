import { createAdminClient } from '@/lib/supabase-admin'
import { getJstTodayCutoffUtcIso } from '@/lib/campaign-ranking'
import type { MakerEventType } from '@/lib/maker-events-shared'

export type AnalyticsPeriod = 'today' | '7d' | '30d' | 'all'
export type ProjectSummary = {
  id: string; slug: string; title: string; type: string; status: string; isPublic: boolean
  pv: number; todayPv: number; uniqueActors: number; registrants: number; submissions: number
  events: Record<MakerEventType, number>
}
export type AnswerAggregate = { cardId: string; name: string; imageUrl: string | null; total: number; rate: number; average: number | null; groups: Record<string, number> }
export type ProjectDetail = ProjectSummary & { config: Record<string, unknown>; answers: AnswerAggregate[] }
type ProjectStatsRpcRow = { project_id:string; slug:string; title:string; project_type:string; status:string; is_public:boolean; page_views:number; today_page_views:number; unique_visitors:number; registrants:number; submission_count:number; tier_created:number; image_saved:number; x_shared:number; aggregate_viewed:number; signup_completed:number }

const EVENT_TYPES: MakerEventType[] = ['tier_created','image_saved','x_shared','aggregate_viewed','page_viewed','auth_cta_clicked','signup_completed','submission_after_signup']
const emptyEvents = () => Object.fromEntries(EVENT_TYPES.map(key => [key, 0])) as Record<MakerEventType, number>

export function periodStart(period: AnalyticsPeriod): string | null {
  if (period === 'all') return null
  if (period === 'today') return getJstTodayCutoffUtcIso()
  const now = new Date()
  const days = period === '7d' ? 7 : 30
  return new Date(now.getTime() - days * 86_400_000).toISOString()
}

export function normalizePeriod(value: string | undefined): AnalyticsPeriod {
  return value === 'today' || value === '7d' || value === '30d' || value === 'all' ? value : '7d'
}

export async function fetchProjectSummaries(period: AnalyticsPeriod): Promise<ProjectSummary[]> {
  const admin = createAdminClient()
  const rpcResult = await admin.rpc('admin_maker_project_stats', { p_period_start: periodStart(period) })
  if (!rpcResult.error) {
    return ((rpcResult.data ?? []) as ProjectStatsRpcRow[]).map(row => ({
      id: row.project_id, slug: row.slug, title: row.title, type: row.project_type, status: row.status, isPublic: row.is_public,
      pv: Number(row.page_views), todayPv: Number(row.today_page_views), uniqueActors: Number(row.unique_visitors), registrants: Number(row.registrants), submissions: Number(row.submission_count),
      events: { ...emptyEvents(), tier_created: Number(row.tier_created), image_saved: Number(row.image_saved), x_shared: Number(row.x_shared), aggregate_viewed: Number(row.aggregate_viewed), signup_completed: Number(row.signup_completed), page_viewed: Number(row.page_views) },
    }))
  }
  // Preview DBへmigrationが未適用でも既存データを確認できる安全なフォールバック。
  const { data: projects, error } = await admin.from('maker_projects').select('id,slug,title,type,status,is_public').order('created_at')
  if (error) throw new Error(`企画一覧を取得できませんでした: ${error.message}`)
  return Promise.all((projects ?? []).map(async project => {
    let eventsQuery = admin.from('maker_events').select('event_type,user_id,anonymous_id').eq('project_id', project.id)
    const start = periodStart(period)
    if (start) eventsQuery = eventsQuery.gte('created_at', start)
    let submissionsQuery = admin.from('maker_submissions').select('user_id').eq('project_id', project.id).eq('is_valid', true)
    if (start) submissionsQuery = submissionsQuery.gte('updated_at', start)
    const [eventResult, submissionResult] = await Promise.all([eventsQuery, submissionsQuery])
    if (eventResult.error) throw new Error(`${project.title}のイベント集計に失敗しました: ${eventResult.error.message}`)
    if (submissionResult.error) throw new Error(`${project.title}の回答集計に失敗しました: ${submissionResult.error.message}`)
    const events = emptyEvents()
    const actors = new Set<string>()
    for (const row of eventResult.data ?? []) {
      if (row.event_type in events) events[row.event_type as MakerEventType] += 1
      if (row.event_type === 'page_viewed') actors.add(row.user_id ?? row.anonymous_id ?? '')
    }
    const registrants = new Set((submissionResult.data ?? []).map(row => row.user_id)).size
    const todayQuery = admin.from('maker_events').select('id', { count:'exact', head:true }).eq('project_id', project.id).eq('event_type','page_viewed').gte('created_at',getJstTodayCutoffUtcIso())
    const todayResult = await todayQuery
    return { id: project.id, slug: project.slug, title: project.title, type: project.type, status: project.status, isPublic: project.is_public,
      pv: events.page_viewed, todayPv: todayResult.count ?? 0, uniqueActors: actors.has('') ? actors.size - 1 : actors.size, registrants, submissions: submissionResult.data?.length ?? 0, events }
  }))
}

export async function fetchProjectDetail(slug: string, period: AnalyticsPeriod): Promise<ProjectDetail | null> {
  const admin = createAdminClient()
  const { data: project, error } = await admin.from('maker_projects').select('id,slug,title,type,status,is_public,config').eq('slug', slug).maybeSingle()
  if (error) throw new Error(`企画を取得できませんでした: ${error.message}`)
  if (!project) return null
  const summary = (await fetchProjectSummaries(period)).find(row => row.id === project.id)
  if (!summary) return null
  const config = (project.config && typeof project.config === 'object' ? project.config : {}) as Record<string, unknown>
  const groups = Array.isArray(config.groups) ? config.groups.filter((g): g is { key: string; label?: string } => Boolean(g && typeof g === 'object' && 'key' in g && typeof g.key === 'string')) : []
  const isTier = project.type === 'tier'
  const aggregatePromise = isTier
    ? admin.from('maker_tier_aggregates').select('card_id,s_count,a_count,b_count,c_count,d_count,rating_count,average_tier').eq('project_id', project.id)
    : admin.from('maker_selection_aggregates').select('card_id,selection_count,submission_count,selection_rate').eq('project_id', project.id)
  const [{ data: aggregateRows, error: aggregateError }, { data: cards, error: cardsError }] = await Promise.all([
    aggregatePromise,
    admin.from('maker_project_cards').select('card_id,sort_order,cards!inner(name,image_url)').eq('project_id', project.id).order('sort_order'),
  ])
  if (aggregateError) throw new Error(`回答内容を取得できませんでした: ${aggregateError.message}`)
  if (cardsError) throw new Error(`企画カードを取得できませんでした: ${cardsError.message}`)
  const aggregateMap = new Map((aggregateRows ?? []).map(row => [String(row.card_id), row as unknown as Record<string, unknown>]))
  const answers = (cards ?? []).map(link => {
    const row = aggregateMap.get(String(link.card_id)) ?? {}
    const card = link.cards as unknown as { name: string; image_url: string | null }
    const groupCounts = Object.fromEntries(groups.map(group => [group.key, Number(row[`${group.key}_count`] ?? 0)]))
    const total = isTier ? Number(row.rating_count ?? 0) : Number(row.selection_count ?? 0)
    return { cardId: String(link.card_id), name: card.name, imageUrl: card.image_url, total,
      rate: isTier ? 0 : Number(row.selection_rate ?? 0), average: isTier && row.average_tier != null ? Number(row.average_tier) : null, groups: groupCounts }
  })
  return { ...summary, config, answers }
}
