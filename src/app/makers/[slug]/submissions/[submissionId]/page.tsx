import Link from 'next/link'
import { notFound } from 'next/navigation'
import MakerSubmissionBoard from '@/components/MakerSubmissionBoard'
import { getPublicMakerProject, getPublicSubmission, makerSubmissionView } from '@/lib/maker-submissions'
import { createClient } from '@/lib/supabase-server'
import SubmissionActions from '../SubmissionActions'
import { getOwnedMakerSubmissionIds } from '@/lib/maker-anonymous-owner'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function MakerSubmissionDetailPage({ params }: { params: Promise<{ slug: string; submissionId: string }> }) {
  const { slug, submissionId } = await params
  const project = await getPublicMakerProject(slug)
  if (!project) notFound()
  const submission = await getPublicSubmission(project.id, submissionId)
  if (!submission) notFound()
  const { config, communityLabel } = makerSubmissionView(project)
  const url = `https://www.duema-bbs.com/makers/${slug}/submissions/${submissionId}`
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAdmin = verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)
  const prediction = project.type === 'prediction'
  const ownedSubmissionIds = await getOwnedMakerSubmissionIds(project.id, [submissionId], user?.id ?? null)
  const shareUrl = `https://twitter.com/intent/tweet?${new URLSearchParams({ text: `${submission.title}\n${project.title}`, url })}`
  return <main className="min-h-screen bg-slate-50 px-3 py-6"><article className="mx-auto max-w-5xl">
    <div className="flex flex-wrap gap-3 text-sm font-bold text-blue-700"><Link href={`/makers/${slug}/submissions`}>← {communityLabel}へ戻る</Link><Link href={`/makers/${slug}`}>メーカーへ戻る</Link></div>
    <h1 className="mt-5 break-words text-2xl font-black">{submission.title}</h1>
    <p className="mt-2 text-sm text-gray-600">{prediction ? '表示名' : '制作者'}: {submission.authorName}</p>
    <time className="mt-1 block text-xs text-gray-400">{new Date(submission.created_at).toLocaleString('ja-JP')}</time>
    {submission.comment && <p className="mt-4 whitespace-pre-wrap break-words rounded-xl border bg-white p-4 leading-7">{submission.comment}</p>}
    <div className="mt-5"><MakerSubmissionBoard submission={submission} groups={config.groups} enableActions exportTitle={prediction ? '2026年7月27日 殿堂解除選手権' : submission.title} showExportAuthor={false} exportLayout={prediction ? 'prediction' : 'tier'} shareUrl={shareUrl} /></div>
    <SubmissionActions slug={slug} submissionId={submissionId} canEdit={isAdmin || ownedSubmissionIds.has(submissionId)} />
  </article></main>
}
