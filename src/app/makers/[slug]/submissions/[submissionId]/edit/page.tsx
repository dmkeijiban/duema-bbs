import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { emptyMakerDraft, parseMakerProjectConfig, type MakerCard } from '@/lib/maker'
import EditTierMaker from './EditTierMaker'
import { updateMakerSubmission } from './actions'

export const dynamic = 'force-dynamic'

export default async function EditMakerSubmissionPage({ params }: { params: Promise<{ slug: string; submissionId: string }> }) {
  const { slug, submissionId } = await params
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const admin = createAdminClient()
  const { data: project } = await admin.from('maker_projects').select('id,type,config').eq('slug', slug).eq('is_public', true).eq('status', 'published').maybeSingle()
  if (!project || project.type !== 'tier') notFound()
  const { data: submission } = await admin.from('maker_submissions').select('id,title,comment').eq('id', submissionId).eq('project_id', project.id).eq('user_id', user.id).eq('is_valid', true).eq('is_public', true).maybeSingle()
  if (!submission) notFound()
  const config = parseMakerProjectConfig(project.config)
  const [{ data: links }, { data: items }] = await Promise.all([
    admin.from('maker_project_cards').select('cards!inner(id,name,image_url,civilization,cost,card_type,is_active)').eq('project_id', project.id).eq('cards.is_active', true).order('sort_order'),
    admin.from('maker_submission_items').select('card_id,group_key,position').eq('submission_id', submissionId).order('position'),
  ])
  const cards: MakerCard[] = ((links ?? []) as unknown as { cards: { id: string; name: string; image_url: string | null; civilization: string[] | null; cost: number | null; card_type: string | null } }[]).map(({ cards: card }) => ({ id: card.id, name: card.name, imageUrl: card.image_url, civilization: card.civilization ?? [], cost: card.cost, cardType: card.card_type }))
  const draft = emptyMakerDraft(config.groups)
  for (const item of items ?? []) if (draft[item.group_key]) draft[item.group_key].push(item.card_id)
  const saveAction = updateMakerSubmission.bind(null, slug, submissionId)
  return <main className="min-h-screen bg-slate-50 px-3 py-6"><div className="mx-auto max-w-7xl"><Link href={`/makers/${slug}/submissions/${submissionId}`} className="text-sm font-bold text-blue-700">← Tier表へ戻る</Link><h1 className="mt-3 text-2xl font-black">Tier表を編集</h1><EditTierMaker cards={cards} groups={config.groups} draft={draft} title={submission.title} comment={submission.comment ?? ''} saveAction={saveAction} slug={slug} /></div></main>
}
