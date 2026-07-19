import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-admin'
import { parseSelectMakerConfig } from '@/lib/maker'
import { getOwnedMakerSubmissionIds } from '@/lib/maker-anonymous-owner'
import { createClient } from '@/lib/supabase-server'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { cookies } from 'next/headers'
import SelectMaker from './SelectMaker'
import { isMakerProjectPageAccessible } from '@/lib/maker-catalog'
import { MakerDefaultTitleProvider } from '@/components/MakerDefaultTitleContext'

export const dynamic = 'force-dynamic'
export default async function GenericMakerPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { slug } = await params
  const { edit } = await searchParams
  const admin = createAdminClient()
  const { data: project } = await admin.from('maker_projects').select('id,slug,title,type,status,is_public,config').eq('slug', slug).maybeSingle()
  if (!project || project.type !== 'select' || !isMakerProjectPageAccessible(project)) notFound()
  const parsedConfig = parseSelectMakerConfig(project.config)
  // Production DB migrations are applied separately from Vercel deploys. Keep the
  // public/export title correct even while an older DB value is still present.
  const config = slug === 'my-duema-9'
    ? { ...parsedConfig, resultTitle: '私を象徴するデュエマカード9選' }
    : parsedConfig
  let initialDraft: Parameters<typeof SelectMaker>[0]['initialDraft']
  if (edit && /^[0-9a-f-]{36}$/i.test(edit)) {
    const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
    const isAdmin = verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)
    const owned = await getOwnedMakerSubmissionIds(project.id, [edit], user?.id ?? null)
    if (!isAdmin && !owned.has(edit)) notFound()
    const [{ data: submission }, { data: items }] = await Promise.all([
      admin.from('maker_submissions').select('id,title,comment,creation_session_id,is_public').eq('id', edit).eq('project_id', project.id).eq('is_valid', true).maybeSingle(),
      admin.from('maker_submission_items').select('card_id,position,cards!inner(id,name,image_url,civilization,cost,card_type)').eq('submission_id', edit).eq('group_key', 'selected').order('position'),
    ])
    if (!submission?.creation_session_id) notFound()
    type Item = { cards: { id: string; name: string; image_url: string | null } }
    initialDraft = { cards: ((items ?? []) as unknown as Item[]).map(item => ({ id: item.cards.id, name: item.cards.name, nameKana: null, imageUrl: item.cards.image_url, officialPageUrl: null, sourceKey: null })), title: submission.title, comment: submission.comment ?? '', sessionId: submission.creation_session_id, submissionId: submission.id, completedEventSent: true }
  }
  return <main className="min-h-screen bg-slate-100 px-1 py-2 sm:px-3 sm:py-4"><div className="mx-auto max-w-[1440px] overflow-x-hidden"><MakerDefaultTitleProvider title={config.defaultTitle}><SelectMaker slug={slug} config={config} initialDraft={initialDraft}/></MakerDefaultTitleProvider></div></main>
}
