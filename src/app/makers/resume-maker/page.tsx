import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { RESUME_MAKER_SLUG, sanitizeResumeData } from '@/lib/maker-resume'
import { resolveSelectPrintingImages, selectPrintingRefKey } from '@/lib/maker-select-printing'
import ResumeMaker from './ResumeMaker'
import type { ResumeInitialState } from './types'

export const dynamic = 'force-dynamic'

const RESUME_SIGNUP_BENEFITS = [
  '後から何度でも編集できる',
  '投稿者ページに掲載できる',
  '公開・非公開を切り替えられる',
  'PNG画像として保存できる',
  'Xで共有できる',
  '別端末からも編集できる',
] as const

function ResumeSignupInvite() {
  return (
    <main className="min-h-screen bg-slate-100 px-3 py-8">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h1 className="text-xl font-black text-slate-900">デュエマ履歴書を作ろう</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">あなたの好きなカードや使用デッキ、デュエマ歴を、本物の履歴書風にまとめられます。</p>
        <ul className="mt-4 space-y-2">
          {RESUME_SIGNUP_BENEFITS.map(benefit => (
            <li key={benefit} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="mt-0.5 text-emerald-600">✓</span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
        <Link href="/login?mode=signup&next=/mypage" className="mt-5 block min-h-12 rounded-xl bg-emerald-700 px-4 py-3 text-center text-base font-black text-white hover:bg-emerald-800">無料登録して履歴書を作る</Link>
        <Link href="/login?next=/mypage" className="mt-2 block min-h-11 rounded-xl border border-slate-300 px-4 py-2.5 text-center text-sm font-bold text-slate-700 hover:bg-slate-50">ログインする</Link>
        <p className="mt-3 text-center text-xs text-slate-400">デュエマ履歴書の作成にはアカウント登録が必要です。</p>
      </div>
    </main>
  )
}

export default async function ResumeMakerPage() {
  const admin = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <ResumeSignupInvite />

  const { data: project } = await admin.from('maker_projects').select('id').eq('slug', RESUME_MAKER_SLUG).eq('is_public', true).eq('status', 'published').maybeSingle()

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

  const initial: ResumeInitialState = {
    submissionId: submission?.id ?? null,
    data,
    isPublic: submission ? submission.is_public : true,
    profileDefaults: profile ? { displayName: profile.display_name, avatarUrl: profile.avatar_url ?? null } : null,
    profileSlug: profile?.profile_slug ?? null,
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
