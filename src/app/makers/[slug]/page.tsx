import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-admin'
import { parseSelectMakerConfig } from '@/lib/maker'
import { getOwnedMakerSubmissionIds } from '@/lib/maker-anonymous-owner'
import { createClient } from '@/lib/supabase-server'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { cookies } from 'next/headers'
import SelectMaker from './SelectMaker'
import MyDuema9CrossLinkFix from './MyDuema9CrossLinkFix'
import { isMakerProjectPageAccessible } from '@/lib/maker-catalog'
import { MakerDefaultTitleProvider } from '@/components/MakerDefaultTitleContext'
import { resolveSelectPrintingImages, selectPrintingRefKey } from '@/lib/maker-select-printing'
import { makerRequiresLogin } from '@/lib/maker-auth-requirements'

export const dynamic = 'force-dynamic'
export default async function GenericMakerPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { slug } = await params
  const { edit } = await searchParams
  const admin = createAdminClient()
  const supabaseForUser = await createClient()
  const { data: { user: currentUser } } = await supabaseForUser.auth.getUser()
  if (slug === 'my-duema-9' && makerRequiresLogin() && !currentUser) {
    redirect('/login?next=/makers/my-duema-9')
  }
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
    const isAdmin = verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)
    const owned = await getOwnedMakerSubmissionIds(project.id, [edit], currentUser?.id ?? null)
    if (!isAdmin && !owned.has(edit)) notFound()
    const [{ data: submission }, { data: items }] = await Promise.all([
      admin.from('maker_submissions').select('id,title,comment,creation_session_id,is_public').eq('id', edit).eq('project_id', project.id).eq('is_valid', true).maybeSingle(),
      admin.from('maker_submission_items').select('card_id,source_key,face_side_index,position,cards!inner(id,name,name_kana,image_url,civilization,cost,card_type)').eq('submission_id', edit).eq('group_key', 'selected').order('position'),
    ])
    if (!submission?.creation_session_id) notFound()
    type Item = { card_id: string; source_key: string | null; face_side_index: number | null; cards: { id: string; name: string; name_kana: string | null; image_url: string | null } }
    const typedItems = (items ?? []) as unknown as Item[]
    const refs = typedItems.map(item => ({ cardId: item.card_id, sourceKey: item.source_key, faceSideIndex: item.face_side_index }))
    const resolved = await resolveSelectPrintingImages(refs)
    initialDraft = {
      cards: typedItems.map(item => {
        const printing = resolved.get(selectPrintingRefKey({ cardId: item.card_id, sourceKey: item.source_key, faceSideIndex: item.face_side_index }))
        return {
          id: item.cards.id,
          name: printing?.name ?? item.cards.name,
          nameKana: item.cards.name_kana,
          imageUrl: printing?.imageUrl ?? item.cards.image_url,
          officialPageUrl: printing?.officialPageUrl ?? null,
          sourceKey: item.source_key,
          matchedFace: item.face_side_index !== null ? { name: printing?.name ?? item.cards.name, imageUrl: printing?.imageUrl ?? null, sideIndex: item.face_side_index, sideKind: null } : null,
        }
      }),
      title: submission.title, comment: submission.comment ?? '', sessionId: submission.creation_session_id, submissionId: submission.id, completedEventSent: true,
    }
  }
  return (
    <main className="min-h-screen bg-slate-100 px-1 py-2 sm:px-3 sm:py-4">
      <style>{`
        @media (min-width: 1024px) {
          .nine-selection-width > .grid {
            grid-template-columns: minmax(0, 1fr) minmax(320px, 480px);
          }
        }
      `}</style>
      <div className="nine-selection-width mx-auto max-w-7xl overflow-x-hidden">
        <MakerDefaultTitleProvider title={config.resultTitle}>
          {slug === 'my-duema-9' && <MyDuema9CrossLinkFix />}
          <SelectMaker slug={slug} config={config} initialDraft={initialDraft} loggedIn={Boolean(currentUser)}/>
        </MakerDefaultTitleProvider>
      </div>
    </main>
  )
}
