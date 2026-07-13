import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { emptyMakerDraft, parseMakerProjectConfig, type MakerCard, type MakerDraft } from '@/lib/maker'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import type { TierAggregate } from '@/app/admin/makers/dm26-ex2-charisma-best-tier/TierMaker'
import PublicTierMaker from './PublicTierMaker'
import { savePublicTierSubmission } from './actions'
import officialCardsJson from '../../../../scripts/fixtures/dm26-ex2-standard-89.import-candidates.json'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'DM26-EX2 悪感謝祭 カリスマBEST Tier表メーカー',
  description: 'DM26-EX2「悪感謝祭 カリスマBEST」のカードをS〜Dに分けてTier表を作れます。',
  alternates: { canonical: '/makers/dm26-ex2-charisma-best-tier' },
}

type ProjectRow = { id: string; config: unknown }
type LinkRow = { cards: { id: string; name: string; image_url: string | null; civilization: string[] | null; cost: number | null; card_type: string | null } }
type AggregateRow = { card_id: string; s_count: number; a_count: number; b_count: number; c_count: number; d_count: number; rating_count: number; average_tier: number | string | null }
type SubmissionItem = { card_id: string; group_key: string; position: number }
type OfficialCard = { card_number: string; card_name: string }
const metadataByName = new Map((officialCardsJson as OfficialCard[]).map(card => [card.card_name, card]))

export default async function PublicTierMakerPage() {
  const admin = createAdminClient()
  const { data: projectData, error: projectError } = await admin
    .from('maker_projects')
    .select('id,config')
    .eq('slug', 'dm26-ex2-charisma-best-tier')
    .eq('is_public', true)
    .eq('status', 'published')
    .maybeSingle()

  if (projectError || !projectData) notFound()
  const project = projectData as ProjectRow
  const config = parseMakerProjectConfig(project.config)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: links, error: linksError }, { data: aggregateRows }] = await Promise.all([
    admin.from('maker_project_cards').select('sort_order,cards!inner(id,name,image_url,civilization,cost,card_type,is_active)').eq('project_id', project.id).eq('cards.is_active', true).order('sort_order'),
    admin.from('maker_tier_aggregates').select('card_id,s_count,a_count,b_count,c_count,d_count,rating_count,average_tier').eq('project_id', project.id),
  ])
  if (linksError || !links?.length) notFound()

  const cards: MakerCard[] = (links as unknown as LinkRow[]).map(link => {
    const metadata = metadataByName.get(link.cards.name)
    return {
      id: link.cards.id,
      name: link.cards.name,
      cardNumber: metadata?.card_number,
      rarity: metadata?.card_number.startsWith('SPR') ? 'SPR' : null,
      searchText: `${link.cards.name} ${metadata?.card_number ?? ''}`,
      imageUrl: link.cards.image_url,
      civilization: link.cards.civilization ?? [],
      cost: link.cards.cost,
      cardType: link.cards.card_type,
    }
  })
  const aggregates: TierAggregate[] = ((aggregateRows ?? []) as AggregateRow[]).map(row => ({
    cardId: row.card_id,
    counts: { s: row.s_count ?? 0, a: row.a_count ?? 0, b: row.b_count ?? 0, c: row.c_count ?? 0, d: row.d_count ?? 0 },
    ratingCount: row.rating_count ?? 0,
    averageTier: row.average_tier === null ? null : Number(row.average_tier),
  }))
  const draft: MakerDraft = emptyMakerDraft(config.groups)
  let hasSavedSubmission = false
  if (user) {
    const { data: submission } = await admin.from('maker_submissions').select('id').eq('project_id', project.id).eq('user_id', user.id).maybeSingle()
    if (submission) {
      hasSavedSubmission = true
      const { data: items } = await admin.from('maker_submission_items').select('card_id,group_key,position').eq('submission_id', submission.id).order('position')
      const validCardIds = new Set(cards.map(card => card.id))
      const seen = new Set<string>()
      for (const item of (items ?? []) as SubmissionItem[]) {
        if (!draft[item.group_key] || !validCardIds.has(item.card_id) || seen.has(item.card_id)) continue
        seen.add(item.card_id)
        draft[item.group_key].push(item.card_id)
      }
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-6">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-bold text-emerald-700">新弾カードTier表メーカー</p>
        <h1 className="mt-2 text-2xl font-black">DM26-EX2 悪感謝祭 カリスマBEST Tier表</h1>
        <p className="mt-1 text-sm text-gray-500">好きな評価グループに分けてオリジナルのTier表を作れます。</p>
        <PublicTierMaker
          cards={cards}
          groups={config.groups}
          initialDraft={draft}
          unrated={config.unrated}
          canSave={Boolean(user)}
          saveAction={savePublicTierSubmission}
          saveButtonLabel={user ? (hasSavedSubmission ? '更新' : '登録') : '登録'}
          hasSavedSubmission={hasSavedSubmission}
          aggregates={aggregates}
        />
      </div>
    </main>
  )
}
