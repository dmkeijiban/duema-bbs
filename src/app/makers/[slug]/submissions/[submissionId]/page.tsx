import Link from 'next/link'
import { notFound } from 'next/navigation'
import MakerSubmissionBoard from '@/components/MakerSubmissionBoard'
import { getPublicMakerProject, getPublicSubmission, makerSubmissionView } from '@/lib/maker-submissions'
import SubmissionsViewEvent from '../view-event'

export const dynamic = 'force-dynamic'

export default async function MakerSubmissionDetailPage({ params }: { params: Promise<{ slug: string; submissionId: string }> }) {
  const { slug, submissionId } = await params
  const project = await getPublicMakerProject(slug)
  if (!project) notFound()
  const submission = await getPublicSubmission(project.id, submissionId)
  if (!submission) notFound()
  const { config, communityLabel } = makerSubmissionView(project)
  const url = `https://www.duema-bbs.com/makers/${slug}/submissions/${submissionId}`
  const shareUrl = `https://twitter.com/intent/tweet?${new URLSearchParams({ text: `${submission.title}\n${project.title}`, url })}`
  return <main className="min-h-screen bg-slate-50 px-3 py-6"><article className="mx-auto max-w-5xl">
    <SubmissionsViewEvent slug={slug} eventType="submission_detail_view" />
    <div className="flex flex-wrap gap-3 text-sm font-bold text-blue-700"><Link href={`/makers/${slug}/submissions`}>← {communityLabel}へ戻る</Link><Link href={`/makers/${slug}`}>メーカーへ戻る</Link></div>
    <h1 className="mt-5 break-words text-2xl font-black">{submission.title}</h1>
    <p className="mt-2 text-sm text-gray-600">制作者: {submission.authorName}</p>
    <time className="mt-1 block text-xs text-gray-400">{new Date(submission.created_at).toLocaleString('ja-JP')}</time>
    {submission.comment && <p className="mt-4 whitespace-pre-wrap break-words rounded-xl border bg-white p-4 leading-7">{submission.comment}</p>}
    <div className="mt-5"><MakerSubmissionBoard submission={submission} groups={config.groups} /></div>
    <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex rounded-lg bg-black px-5 py-3 font-bold text-white">Xで共有</a>
  </article></main>
}
