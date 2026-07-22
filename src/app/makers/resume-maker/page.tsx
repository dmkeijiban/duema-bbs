import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { RESUME_MAKER_SLUG, sanitizeResumeData } from '@/lib/maker-resume'
import { resolveSelectPrintingImages, selectPrintingRefKey } from '@/lib/maker-select-printing'
import ResumeMaker from './ResumeMaker'
import type { ResumeInitialState } from './types'
import { makerRequiresLogin } from '@/lib/maker-auth-requirements'

export const dynamic = 'force-dynamic'

export default async function ResumeMakerPage() {
  const admin = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (makerRequiresLogin() && !user) redirect('/login?next=/makers/resume-maker')

  const { data: project } = await admin.from('maker_projects').select('id').eq('slug', RESUME_MAKER_SLUG).eq('is_public', true).eq('status', 'published').maybeSingle()

  const [{ data: profile }, { data: submission }] = user ? await Promise.all([
    admin.from('profiles').select('display_name, avatar_url, profile_slug').eq('id', user.id).maybeSingle(),
    project ? admin.from('maker_submissions').select('id, resume_data, is_public, updated_at').eq('project_id', project.id).eq('user_id', user.id).eq('is_overwrite_slot', true).eq('is_valid', true).maybeSingle() : Promise.resolve({ data: null }),
  ]) : [{ data: null }, { data: null }]

  let data = submission?.resume_data ? sanitizeResumeData(submission.resume_data) : null
  if (data?.photo?.type === 'card') {
    const ref = { cardId: data.photo.cardId, sourceKey: data.photo.sourceKey, faceSideIndex: data.photo.faceSideIndex }
    const resolved = (await resolveSelectPrintingImages([ref])).get(selectPrintingRefKey(ref))
    if (resolved?.imageUrl) data = { ...data, photo: { ...data.photo, imageUrl: resolved.imageUrl } }
  }

  const initial: ResumeInitialState = {
    submissionId: submission?.id ?? null,
    data,
    isPublic: submission ? submission.is_public : true,
    profileDefaults: profile ? { displayName: profile.display_name, avatarUrl: profile.avatar_url ?? null } : null,
    profileSlug: profile?.profile_slug ?? null,
    resumeDate: submission?.updated_at ?? null,
  }

  return (
    <main className="min-h-screen bg-slate-100 px-1 py-2 sm:px-3 sm:py-4">
      <div className="mx-auto max-w-[1200px] overflow-x-hidden">
        <ResumeMaker initial={initial} loggedIn={Boolean(user)} />
      </div>
    </main>
  )
}
