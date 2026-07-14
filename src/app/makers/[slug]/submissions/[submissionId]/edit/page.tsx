import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { emptyMakerDraft, parseMakerProjectConfig, type MakerCard } from '@/lib/maker'
import { getCurrentHallCards, getHallCardOfficialId } from '@/lib/hall-of-fame'
import { getOwnedMakerSubmissionIds } from '@/lib/maker-anonymous-owner'
import EditTierMaker from './EditTierMaker'
import { updateMakerSubmission } from './actions'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

type LinkedCard = {
  id: string
  name: string
  image_url: string | null
  civilization: string[] | null
  cost: number | null
  card_type: string | null
  regulation: string | null
  source_key: string | null
}

export default async function EditMakerSubmissionPage({ params }: { params: Promise<{ slug: string; submissionId: string }> }) {
  const { slug, submissionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAdmin = verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)
  const admin = createAdminClient()
  const { data: project } = await admin.from('maker_projects').select('id,type,config').eq('slug', slug).eq('is_public', true).eq('status', 'published').maybeSingle()
  if (!project || !['tier', 'prediction'].includes(project.type)) notFound()

  const { data: submission } = await admin
    .from('maker_submissions')
    .select('id,title,comment')
    .eq('id', submissionId)
    .eq('project_id', project.id)
    .eq('is_valid', true)
    .eq('is_public', true)
    .maybeSingle()
  if (!submission) notFound()
  const ownedIds = await getOwnedMakerSubmissionIds(project.id, [submissionId], user?.id ?? null)
  if (!isAdmin && !ownedIds.has(submissionId)) notFound()

  const config = parseMakerProjectConfig(project.config)
  const [{ data: links }, { data: items }] = await Promise.all([
    admin.from('maker_project_cards').select('sort_order,cards!inner(id,name,image_url,civilization,cost,card_type,regulation,source_key,is_active)').eq('project_id', project.id).eq('cards.is_active', true).order('sort_order'),
    admin.from('maker_submission_items').select('card_id,group_key,position').eq('submission_id', submissionId).order('position'),
  ])
  const linkedCards = ((links ?? []) as unknown as { cards: LinkedCard }[]).map(({ cards }) => cards)
  if (slug === 'hall-of-fame-release') {
    const order = new Map(
      [...getCurrentHallCards()]
        .sort((a, b) => Number(a.status !== 'hall') - Number(b.status !== 'hall'))
        .map((card, index) => [getHallCardOfficialId(card), index]),
    )
    linkedCards.sort((a, b) => (order.get(a.source_key ?? '') ?? Number.MAX_SAFE_INTEGER) - (order.get(b.source_key ?? '') ?? Number.MAX_SAFE_INTEGER))
  }
  const cards: MakerCard[] = linkedCards.map(card => ({
    id: card.id,
    name: card.name,
    imageUrl: card.image_url,
    civilization: card.civilization ?? [],
    cost: card.cost,
    cardType: card.card_type,
    badge: card.regulation === 'premium_hall'
      ? { label: 'プレ殿', value: 'premium', className: 'bg-red-800 text-white' }
      : card.regulation === 'hall'
        ? { label: '殿堂', value: 'hall', className: 'bg-yellow-300 text-yellow-950' }
        : undefined,
  }))
  const draft = emptyMakerDraft(config.groups)
  for (const item of items ?? []) if (draft[item.group_key]) draft[item.group_key].push(item.card_id)
  const prediction = project.type === 'prediction'
  const saveAction = updateMakerSubmission.bind(null, slug, submissionId)

  return <main className="min-h-screen bg-slate-50 px-3 py-6"><div className="mx-auto max-w-7xl">
    <Link href={`/makers/${slug}/submissions/${submissionId}`} className="text-sm font-bold text-blue-700">← {prediction ? '予想' : 'Tier表'}へ戻る</Link>
    <h1 className="mt-3 text-2xl font-black">{prediction ? '殿堂解除予想を編集' : 'Tier表を編集'}</h1>
    <EditTierMaker cards={cards} groups={config.groups} draft={draft} title={submission.title} comment={submission.comment ?? ''} saveAction={saveAction} slug={slug} submissionId={submissionId} prediction={prediction} />
  </div></main>
}
