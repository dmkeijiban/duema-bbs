import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { emptyMakerDraft, parseMakerProjectConfig, TIER_GROUPS, type MakerCard, type MakerDraft, type MakerProjectConfig } from '@/lib/maker'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { fetchMakerUsageStats, type MakerUsageStats } from '@/lib/maker-usage-stats'
import fallbackCardsJson from '../../../../../scripts/fixtures/dm26-ex2-standard-89.import-candidates.json'
import TierMaker, { type TierAggregate } from './TierMaker'
import ProjectVisibilityControl from './ProjectVisibilityControl'
import UsageStatsSection from './UsageStatsSection'

export const metadata: Metadata = { title: 'DM26-EX2 Tier表（管理）', robots: { index: false, follow: false } }

type ProjectRow = { id: string; config: unknown; is_public: boolean; status: string }
type LinkRow = { cards: { id: string; name: string; image_url: string | null; civilization: string[] | null; cost: number | null; card_type: string | null } }
type SubmissionItem = { card_id: string; group_key: string; position: number }
type AggregateRow = { card_id: string; s_count: number; a_count: number; b_count: number; c_count: number; d_count: number; rating_count: number; average_tier: number | string | null }
type FallbackCard = { card_number: string; card_name: string; image_url: string | null; civilization: string[] | null; cost: number | null; card_type: string | null }
const fallbackCards = fallbackCardsJson as FallbackCard[]
const expectedCardCount = fallbackCards.length
const metadataByName = new Map(fallbackCards.map(card => [card.card_name, card]))

function getFallbackCards(): MakerCard[] {
  return fallbackCards.map(card => ({ id: `dm26-ex2-${card.card_number.replace('/', '-')}`, name: card.card_name, cardNumber: card.card_number, rarity: card.card_number.startsWith('SPR') ? 'SPR' : null, searchText: `${card.card_name} ${card.card_number}`, imageUrl: card.image_url, civilization: card.civilization ?? [], cost: card.cost, cardType: card.card_type }))
}

export default async function Page() {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) redirect('/admin')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let cards: MakerCard[] = []
  let aggregates: TierAggregate[] = []
  let projectConfig: MakerProjectConfig = { groups: TIER_GROUPS, unrated: true, allowDuplicates: false, allowAnonymousSubmission: false, ordered: true, overwrite: true, maxChoices: null }
  let draft: MakerDraft = emptyMakerDraft(projectConfig.groups)
  let unavailableMessage = ''
  let usingFallbackCards = false
  let projectIsPublic: boolean | null = null
  let projectIsReady = false
  let projectId: string | null = null

  try {
    const admin = createAdminClient()
    const { data: projectData, error: projectError } = await admin.from('maker_projects').select('id,config,is_public,status').eq('slug', 'dm26-ex2-charisma-best-tier').single()
    if (projectError || !projectData) throw new Error('Tier表企画がまだ準備されていません')
    const project = projectData as ProjectRow
    projectId = project.id
    projectIsPublic = project.is_public && project.status === 'published'
    projectConfig = parseMakerProjectConfig(project.config)
    draft = emptyMakerDraft(projectConfig.groups)

    const { data: links, error: linksError } = await admin.from('maker_project_cards').select('sort_order,cards!inner(id,name,image_url,civilization,cost,card_type,is_active)').eq('project_id', project.id).eq('cards.is_active', true).order('sort_order')
    if (linksError) throw new Error('企画カードを取得できませんでした')
    cards = ((links ?? []) as unknown as LinkRow[]).map(link => { const metadata = metadataByName.get(link.cards.name); return { id: link.cards.id, name: link.cards.name, cardNumber: metadata?.card_number, rarity: metadata?.card_number.startsWith('SPR') ? 'SPR' : null, searchText: `${link.cards.name} ${metadata?.card_number ?? ''}`, imageUrl: link.cards.image_url, civilization: link.cards.civilization ?? [], cost: link.cards.cost, cardType: link.cards.card_type } })
    projectIsReady = cards.length === expectedCardCount
    if (!projectIsReady) throw new Error(`企画カードが不足しています（${cards.length}/${expectedCardCount}枚）`)

    const { data: aggregateRows, error: aggregateError } = await admin.from('maker_tier_aggregates').select('card_id,s_count,a_count,b_count,c_count,d_count,rating_count,average_tier').eq('project_id', project.id)
    if (!aggregateError) {
      aggregates = ((aggregateRows ?? []) as AggregateRow[]).map(row => ({ cardId: row.card_id, counts: { s: row.s_count ?? 0, a: row.a_count ?? 0, b: row.b_count ?? 0, c: row.c_count ?? 0, d: row.d_count ?? 0 }, ratingCount: row.rating_count ?? 0, averageTier: row.average_tier === null ? null : Number(row.average_tier) }))
    }

    if (user) {
      const { data: submission, error: submissionError } = await admin.from('maker_submissions').select('id').eq('project_id', project.id).eq('user_id', user.id).eq('is_overwrite_slot', true).maybeSingle()
      if (submissionError) throw new Error('保存済みTier表を確認できませんでした')
      if (submission) {
        const { data: items, error: itemsError } = await admin.from('maker_submission_items').select('card_id,group_key,position').eq('submission_id', submission.id).order('position')
        if (itemsError) throw new Error('保存済みTier表を読み込めませんでした')
        const validCardIds = new Set(cards.map(card => card.id))
        const seen = new Set<string>()
        for (const item of (items ?? []) as SubmissionItem[]) {
          if (!draft[item.group_key] || !validCardIds.has(item.card_id) || seen.has(item.card_id)) continue
          seen.add(item.card_id)
          draft[item.group_key].push(item.card_id)
        }
      }
    }
  } catch (error) {
    unavailableMessage = error instanceof Error ? error.message : 'Tier表を読み込めませんでした'
    usingFallbackCards = true
    cards = getFallbackCards()
    projectConfig = { groups: TIER_GROUPS, unrated: true, allowDuplicates: false, allowAnonymousSubmission: false, ordered: true, overwrite: true, maxChoices: null }
    draft = emptyMakerDraft(projectConfig.groups)
    console.warn('DM26-EX2 Tier表は確認用データで表示します', { message: unavailableMessage })
  }

  // 統計取得の失敗は利用状況セクション内のエラー表示だけに留め、公開設定やTier操作には影響させない。
  let usageStats: MakerUsageStats | null = null
  let usageStatsError: string | null = null
  if (projectId) {
    try {
      usageStats = await fetchMakerUsageStats(projectId)
    } catch (error) {
      usageStatsError = error instanceof Error ? error.message : '利用状況を取得できませんでした'
      console.warn('fetchMakerUsageStats failed', { projectId, message: usageStatsError })
    }
  } else {
    usageStatsError = '企画データが未登録です'
  }

  const canSave = Boolean(user) && !usingFallbackCards && process.env.VERCEL_ENV === 'preview'
  return <main className="min-h-screen bg-slate-50 px-3 py-6"><div className="mx-auto max-w-7xl">
    <p className="text-xs font-bold text-blue-700">管理者限定 · 公開設定</p>
    <h1 className="mt-2 text-2xl font-black">DM26-EX2 悪感謝祭 カリスマBEST Tier表</h1>
    <p className="mt-1 text-sm text-gray-500">好きな評価グループに分けてオリジナルのTier表を作れます。</p>
    <ProjectVisibilityControl isPublic={projectIsPublic === true} isReady={projectIsReady} />
    <UsageStatsSection stats={usageStats} errorMessage={usageStatsError} />
    {(!user || usingFallbackCards || process.env.VERCEL_ENV !== 'preview') && <p className="mt-4 rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">現在は確認用モードです。{cards.length}枚の表示・検索・Tier操作・端末内の下書き保存を確認できます。DBへの上書き保存は無効です。</p>}
    {usingFallbackCards && unavailableMessage && <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm">本番DBにはまだメーカー用データを入れていないため、公式{cards.length}枚の確認用データを表示しています。</p>}
    <TierMaker cards={cards} groups={projectConfig.groups} initialDraft={draft} unrated={projectConfig.unrated} canSave={canSave} aggregates={aggregates} />
  </div></main>
}
