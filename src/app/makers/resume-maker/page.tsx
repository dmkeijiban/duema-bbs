import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { RESUME_MAKER_SLUG, sanitizeResumeData } from '@/lib/maker-resume'
import { resolveSelectPrintingImages, selectPrintingRefKey } from '@/lib/maker-select-printing'
import ResumeMaker from './ResumeMaker'
import type { ResumeInitialState } from './types'

export const dynamic = 'force-dynamic'

export default async function ResumeMakerPage() {
  const admin = createAdminClient()
  const supabase = await createClient()
  const [{ data: project }, { data: { user } }] = await Promise.all([
    admin.from('maker_projects').select('id').eq('slug', RESUME_MAKER_SLUG).eq('is_public', true).eq('status', 'published').maybeSingle(),
    supabase.auth.getUser(),
  ])

  let initial: ResumeInitialState = { submissionId: null, data: null, isPublic: true, profileDefaults: null, profileSlug: null, loggedIn: Boolean(user) }

  if (user) {
    const [{ data: profile }, { data: submission }] = await Promise.all([
      admin.from('profiles').select('display_name, avatar_url, profile_slug').eq('id', user.id).maybeSingle(),
      project ? admin.from('maker_submissions').select('id, resume_data, is_public').eq('project_id', project.id).eq('user_id', user.id).eq('is_overwrite_slot', true).eq('is_valid', true).maybeSingle() : Promise.resolve({ data: null }),
    ])

    let data = submission?.resume_data ? sanitizeResumeData(submission.resume_data) : null
    if (data?.photo?.type === 'card') {
      const ref = { cardId: data.photo.cardId, sourceKey: data.photo.sourceKey, faceSideIndex: data.photo.faceSideIndex }
      const resolved = (await resolveSelectPrintingImages([ref])).get(selectPrintingRefKey(ref))
      if (resolved?.imageUrl) data = { ...data, photo: { ...data.photo, imageUrl: resolved.imageUrl } }
    }

    initial = {
      submissionId: submission?.id ?? null,
      data,
      isPublic: submission ? submission.is_public : true,
      profileDefaults: profile ? { displayName: profile.display_name, avatarUrl: profile.avatar_url ?? null } : null,
      profileSlug: profile?.profile_slug ?? null,
      loggedIn: true,
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-1 py-2 sm:px-3 sm:py-4">
      <style>{`
        .resume-maker-shell:has(nav > button:nth-child(3).border-emerald-700) > div {
          padding-bottom: 1.5rem;
        }
        .resume-maker-shell:has(nav > button:nth-child(3).border-emerald-700) .fixed.inset-x-0.bottom-0 {
          display: none;
        }
        .resume-maker-shell:has(nav > button:nth-child(3).border-emerald-700) .min-w-0.space-y-3 > .flex.gap-2 > button:nth-child(2),
        .resume-maker-shell:has(nav > button:nth-child(3).border-emerald-700) .min-w-0.space-y-3 > .flex.gap-2 > button:nth-child(3) {
          display: none;
        }
      `}</style>
      <div className="resume-maker-shell mx-auto max-w-[1200px] overflow-x-hidden">
        <ResumeMaker initial={initial} />
      </div>
    </main>
  )
}
