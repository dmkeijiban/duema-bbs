import Link from 'next/link'
import { notFound } from 'next/navigation'
import MakerSubmissionBoard from '@/components/MakerSubmissionBoard'
import MakerCommunityTier, { type MakerAggregate } from '@/components/MakerCommunityTier'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import type { MakerCard } from '@/lib/maker'
import { getPublicMakerProject, getPublicSubmissions, makerSubmissionView } from '@/lib/maker-submissions'
import SubmissionActions from './SubmissionActions'
import SmoothHashLink from '@/components/SmoothHashLink'

export const dynamic = 'force-dynamic'

export default async function MakerSubmissionsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ created?: string }> }) {
  const { slug } = await params
  const { created } = await searchParams
  const project = await getPublicMakerProject(slug)
  if (!project) notFound()
  const { config, communityLabel } = makerSubmissionView(project)
  const submissions = await getPublicSubmissions(project.id)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()
  const [{ data: links }, { data: rows }] = await Promise.all([
    admin.from('maker_project_cards').select('cards!inner(id,name,image_url,civilization,cost,card_type,is_active)').eq('project_id', project.id).eq('cards.is_active', true).order('sort_order'),
    project.type === 'tier' ? admin.from('maker_tier_aggregates').select('card_id,s_count,a_count,b_count,c_count,d_count,rating_count,average_tier').eq('project_id', project.id) : Promise.resolve({ data: [] }),
  ])
  const cards: MakerCard[] = ((links ?? []) as unknown as { cards: { id: string; name: string; image_url: string | null; civilization: string[] | null; cost: number | null; card_type: string | null } }[]).map(({ cards: card }) => ({ id: card.id, name: card.name, imageUrl: card.image_url, civilization: card.civilization ?? [], cost: card.cost, cardType: card.card_type }))
  const aggregates: MakerAggregate[] = ((rows ?? []) as { card_id: string; s_count: number; a_count: number; b_count: number; c_count: number; d_count: number; rating_count: number; average_tier: number | string | null }[]).map(row => ({ cardId: row.card_id, counts: { s: row.s_count, a: row.a_count, b: row.b_count, c: row.c_count, d: row.d_count }, ratingCount: row.rating_count, averageTier: row.average_tier === null ? null : Number(row.average_tier) }))
  return <main className="min-h-screen bg-slate-50 px-3 py-6"><div className="mx-auto max-w-6xl">
    <Link href={`/makers/${slug}`} className="text-sm font-bold text-blue-700">← メーカーへ戻る</Link>
    <h1 className="mt-3 text-2xl font-black">{communityLabel}</h1>
    <p className="mt-1 text-sm text-gray-500">登録された{project.type === 'tier' ? 'Tier表' : '作品'}を新着順で表示しています。</p>
    {project.type === 'tier' && <SmoothHashLink targetId="community-tier" className="mt-4 inline-flex rounded-lg border border-blue-700 bg-white px-4 py-2 text-sm font-bold text-blue-700">📊 カード別の評価を見る</SmoothHashLink>}
    <div id="submissions-list" className="scroll-mt-4" />
    {submissions.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{submissions.map(submission =>
      <article key={submission.id} className={`min-w-0 rounded-xl border bg-white p-3 shadow-sm ${created === submission.id ? 'border-emerald-500 ring-2 ring-emerald-200' : ''}`}>
      {created === submission.id && <p className="mb-2 text-sm font-bold text-emerald-700">登録しました</p>}
      <Link href={`/makers/${slug}/submissions/${submission.id}`} className="block transition hover:opacity-90">
        <MakerSubmissionBoard submission={submission} groups={config.groups} compact />
        <h2 className="mt-3 line-clamp-2 font-black">{submission.title}</h2>
        <p className="mt-1 text-sm text-gray-600">{submission.authorName}</p>
        {submission.comment && <p className="mt-2 line-clamp-2 break-words text-sm text-gray-600">{submission.comment}</p>}
        <time className="mt-2 block text-xs text-gray-400">{new Date(submission.created_at).toLocaleString('ja-JP')}</time>
      </Link><SubmissionActions slug={slug} submissionId={submission.id} canEdit={submission.user_id !== null && user?.id === submission.user_id} anonymousOwner={submission.user_id === null} /></article>)}</div> : <p className="mt-6 rounded-xl border bg-white p-8 text-center text-gray-500">まだ{project.type === 'tier' ? 'Tier表' : '作品'}が登録されていません。</p>}
    {project.type === 'tier' && <div className="mt-8"><MakerCommunityTier cards={cards} groups={config.groups} aggregates={aggregates} showAllCards /><SmoothHashLink targetId="submissions-list" className="mt-3 inline-flex text-sm font-bold text-blue-700">↑ Tier表一覧へ戻る</SmoothHashLink></div>}
  </div></main>
}
