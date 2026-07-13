import Link from 'next/link'
import { notFound } from 'next/navigation'
import MakerSubmissionBoard from '@/components/MakerSubmissionBoard'
import { getPublicMakerProject, getPublicSubmissions, makerSubmissionView } from '@/lib/maker-submissions'

export const dynamic = 'force-dynamic'

export default async function MakerSubmissionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const project = await getPublicMakerProject(slug)
  if (!project) notFound()
  const { config, communityLabel } = makerSubmissionView(project)
  const submissions = await getPublicSubmissions(project.id)
  return <main className="min-h-screen bg-slate-50 px-3 py-6"><div className="mx-auto max-w-6xl">
    <Link href={`/makers/${slug}`} className="text-sm font-bold text-blue-700">← メーカーへ戻る</Link>
    <h1 className="mt-3 text-2xl font-black">{communityLabel}</h1>
    <p className="mt-1 text-sm text-gray-500">登録された作品を新着順で表示しています。</p>
    {submissions.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{submissions.map(submission =>
      <Link key={submission.id} href={`/makers/${slug}/submissions/${submission.id}`} className="min-w-0 rounded-xl border bg-white p-3 shadow-sm transition hover:border-blue-400">
        <MakerSubmissionBoard submission={submission} groups={config.groups} compact />
        <h2 className="mt-3 line-clamp-2 font-black">{submission.title}</h2>
        <p className="mt-1 text-sm text-gray-600">{submission.authorName}</p>
        {submission.comment && <p className="mt-2 line-clamp-2 break-words text-sm text-gray-600">{submission.comment}</p>}
        <time className="mt-2 block text-xs text-gray-400">{new Date(submission.created_at).toLocaleString('ja-JP')}</time>
      </Link>)}</div> : <p className="mt-6 rounded-xl border bg-white p-8 text-center text-gray-500">まだ作品が登録されていません。</p>}
  </div></main>
}
