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

const EVENT_TYPES: MakerEventType[] = ['tier_created','image_saved','x_shared','aggregate_viewed','page_viewed','auth_cta_clicked','signup_completed','submission_after_signup','creation_started','card_searched','card_added','card_removed','card_reordered','selection_completed','image_save_started','submission_registered','submission_updated','submission_deleted','submissions_viewed','draft_restored','new_draft_started','listing_enabled','listing_disabled']
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
  if (rpcResult.error) {
    throw new Error(`企画分析RPCを実行できませんでした。migrationの適用状態を確認してください: ${rpcResult.error.message}`)
  }
  const summaries = ((rpcResult.data ?? []) as ProjectStatsRpcRow[]).map(row => ({
    id: row.project_id, slug: row.slug, title: row.title, type: row.project_type, status: row.status, isPublic: row.is_public,
    pv: Number(row.page_views), todayPv: Number(row.today_page_views), uniqueActors: Number(row.unique_visitors), registrants: Number(row.registrants), submissions: Number(row.submission_count),
    events: { ...emptyEvents(), tier_created: Number(row.tier_created), image_saved: Number(row.image_saved), x_shared: Number(row.x_shared), aggregate_viewed: Number(row.aggregate_viewed), signup_completed: Number(row.signup_completed), page_viewed: Number(row.page_views) },
  }))
  await Promise.all(summaries.map(async summary => {
    const { data } = await admin.rpc('maker_event_stats_v2', { p_project_id: summary.id, p_today_start: getJstTodayCutoffUtcIso() })
    for (const row of (data ?? []) as { event_type: string; total_count: number }[]) if (row.event_type in summary.events) summary.events[row.event_type as MakerEventType] = Number(row.total_count)
  }))
  return summaries
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
  const isSelect = project.type === 'select'
  const aggregatePromise = isTier
    ? admin.from('maker_tier_aggregates').select('card_id,s_count,a_count,b_count,c_count,d_count,rating_count,average_tier').eq('project_id', project.id)
    : isSelect ? admin.from('maker_select_aggregates').select('card_id,name,selection_count,center_count,selection_rate').eq('project_id', project.id)
    : admin.from('maker_selection_aggregates').select('card_id,selection_count,submission_count,selection_rate').eq('project_id', project.id)
  const [{ data: aggregateRows, error: aggregateError }, { data: cards, error: cardsError }] = await Promise.all([
    aggregatePromise,
    isSelect ? admin.from('maker_select_aggregates').select('card_id,name').eq('project_id', project.id) : admin.from('maker_project_cards').select('card_id,sort_order,cards!inner(name,image_url)').eq('project_id', project.id).order('sort_order'),
  ])
  if (aggregateError) throw new Error(`回答内容を取得できませんでした: ${aggregateError.message}`)
  if (cardsError) throw new Error(`企画カードを取得できませんでした: ${cardsError.message}`)
  const aggregateMap = new Map((aggregateRows ?? []).map(row => [String(row.card_id), row as unknown as Record<string, unknown>]))
  const selectCardIds = isSelect ? (cards ?? []).map(link => String(link.card_id)) : []
  const { data: selectCards } = selectCardIds.length ? await admin.from('cards').select('id,name,image_url').in('id', selectCardIds) : { data: [] }
  const selectCardMap = new Map((selectCards ?? []).map(card => [card.id, card]))
  const answers = (cards ?? []).map(link => {
    const row = aggregateMap.get(String(link.card_id)) ?? {}
    const linkedCard = (link as unknown as { cards?: { name: string; image_url: string | null } | { name: string; image_url: string | null }[] }).cards
    const card = isSelect
      ? selectCardMap.get(String(link.card_id)) ?? { name: String((link as { name?: string }).name ?? ''), image_url: null }
      : (Array.isArray(linkedCard) ? linkedCard[0] : linkedCard) ?? { name: '', image_url: null }
    const groupCounts = Object.fromEntries(groups.map(group => [group.key, Number(row[`${group.key}_count`] ?? 0)]))
    const total = isTier ? Number(row.rating_count ?? 0) : Number(row.selection_count ?? 0)
    return { cardId: String(link.card_id), name: card.name, imageUrl: card.image_url, total,
      rate: isTier ? 0 : Number(row.selection_rate ?? 0), average: isTier && row.average_tier != null ? Number(row.average_tier) : null, groups: groupCounts }
  })
  return { ...summary, config, answers }
}
