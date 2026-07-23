import Link from 'next/link'
import { notFound } from 'next/navigation'
import MakerSubmissionBoard from '@/components/MakerSubmissionBoard'
import SelectSubmissionBoard from '@/components/SelectSubmissionBoard'
import MakerCommunityTier, { type MakerAggregate } from '@/components/MakerCommunityTier'
import SelectMakerSubmissionTabs, { parseSelectSubmissionTab, type SelectSubmissionTab } from '@/components/SelectMakerSubmissionTabs'
import SelectMakerAggregateGrid from '@/components/SelectMakerAggregateGrid'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import type { MakerCard } from '@/lib/maker'
import { parseSelectMakerConfig } from '@/lib/maker'
import { getCurrentHallCards, getHallCardOfficialId } from '@/lib/hall-of-fame'
import { getOwnedPublicSubmissions, getPublicMakerProject, getPublicSubmissions, getSelectMakerAggregates, makerSubmissionView, type PublicSubmission } from '@/lib/maker-submissions'
import { formatJapanDateTime } from '@/lib/date-time'
import SubmissionActions from './SubmissionActions'
import SmoothHashLink from '@/components/SmoothHashLink'
import { getOwnedMakerSubmissionIds } from '@/lib/maker-anonymous-owner'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { cookies } from 'next/headers'
import { RepresentativeButton } from '@/components/RepresentativeButton'
import { getRepresentativeId } from '@/lib/user-content-representatives'

export const dynamic = 'force-dynamic'

function selectExportTitle(submissionTitle: string, defaultTitle: string, resultTitle: string) {
  const normalizedTitle = submissionTitle.trim()
  return normalizedTitle && normalizedTitle !== defaultTitle.trim() ? normalizedTitle : resultTitle
}

export default async function MakerSubmissionsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ created?: string; page?: string; tab?: string }> }) {
  const { slug } = await params
  const { created, page: pageValue, tab: tabValue } = await searchParams
  const page = Math.max(1, Number.parseInt(pageValue ?? '1', 10) || 1)
  const project = await getPublicMakerProject(slug)
  if (!project) notFound()
  const { config, communityLabel, resultTitle } = makerSubmissionView(project)
  const isSelect = project.type === 'select'
  const selectConfig = isSelect ? parseSelectMakerConfig(project.config) : null
  // タブ・集計UIはSELECT型企画の共通機能。9選（maxChoices===9）を基本対象とし、slug個別分岐はしない
  const hasTabs = selectConfig !== null && selectConfig.maxChoices === 9
  const choiceLabel = selectConfig ? `${selectConfig.maxChoices}選` : ''
  const tab: SelectSubmissionTab = hasTabs ? parseSelectSubmissionTab(tabValue) : 'all'
  const backLabel = selectConfig ? (selectConfig.maxChoices === 9 ? `← ${selectConfig.maxChoices}選を作る` : '← この企画を作る') : '← メーカーへ戻る'
  const selectDefaultTitle = 'defaultTitle' in config ? config.defaultTitle : ''
  const pageSize = 12
  const { submissions, total } = tab === 'all' ? await getPublicSubmissions(project.id, page, pageSize) : { submissions: [] as PublicSubmission[], total: 0 }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAdmin = verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)
  const admin = createAdminClient()
  const [ownedSubmissionIds, mineSubmissions, selectAggregate] = await Promise.all([
    tab === 'all' ? getOwnedMakerSubmissionIds(project.id, submissions.map(submission => submission.id), user?.id ?? null) : Promise.resolve(new Set<string>()),
    tab === 'mine'
      ? getOwnedPublicSubmissions(project.id, user?.id ?? null).then(items => slug === 'my-duema-9' && user ? items.filter(item => item.user_id === user.id) : items)
      : Promise.resolve([] as PublicSubmission[]),
    tab === 'ranking' ? getSelectMakerAggregates(project.id) : Promise.resolve(null),
  ])
  const savedRepresentativeId = tab === 'mine' && slug === 'my-duema-9' && user
    ? await getRepresentativeId(user.id, 'my_duema_9')
    : null
  const [{ data: links }, { data: rows }] = await Promise.all([
    project.type === 'tier' || project.type === 'prediction' ? admin.from('maker_project_cards').select('cards!inner(id,name,image_url,civilization,cost,card_type,regulation,source_key,is_active)').eq('project_id', project.id).eq('cards.is_active', true).order('sort_order') : Promise.resolve({ data: [] }),
    project.type === 'tier' ? admin.from('maker_tier_aggregates').select('card_id,s_count,a_count,b_count,c_count,d_count,rating_count,average_tier').eq('project_id', project.id) : project.type === 'prediction' ? admin.from('maker_selection_aggregates').select('card_id,selection_count,submission_count,selection_rate').eq('project_id', project.id) : Promise.resolve({ data: [] }),
  ])
  type LinkedCard = { id: string; name: string; image_url: string | null; civilization: string[] | null; cost: number | null; card_type: string | null; regulation: string | null; source_key: string | null }
  const linkedCards = ((links ?? []) as unknown as { cards: LinkedCard }[]).map(({ cards: card }) => card)
  if (slug === 'hall-of-fame-release') {
    const hallOrder = new Map(
      [...getCurrentHallCards()]
        .sort((a, b) => Number(a.status !== 'hall') - Number(b.status !== 'hall'))
        .map((card, index) => [getHallCardOfficialId(card), index]),
    )
    linkedCards.sort((a, b) => (hallOrder.get(a.source_key ?? '') ?? Number.MAX_SAFE_INTEGER) - (hallOrder.get(b.source_key ?? '') ?? Number.MAX_SAFE_INTEGER))
  }
  const cards: MakerCard[] = linkedCards.map(card => ({ id: card.id, name: card.name, imageUrl: card.image_url, civilization: card.civilization ?? [], cost: card.cost, cardType: card.card_type, badge: card.regulation === 'premium_hall' ? { label: 'プレミアム殿堂', value: 'premium', className: 'bg-red-800 text-white' } : card.regulation === 'hall' ? { label: '殿堂', value: 'hall', className: 'bg-yellow-300 text-yellow-950' } : undefined }))
  const aggregates: MakerAggregate[] = project.type === 'tier'
    ? ((rows ?? []) as { card_id: string; s_count: number; a_count: number; b_count: number; c_count: number; d_count: number; rating_count: number; average_tier: number | string | null }[]).map(row => ({ cardId: row.card_id, counts: { s: row.s_count, a: row.a_count, b: row.b_count, c: row.c_count, d: row.d_count }, ratingCount: row.rating_count, averageTier: row.average_tier === null ? null : Number(row.average_tier) }))
    : ((rows ?? []) as { card_id: string; selection_count: number; submission_count: number; selection_rate: number | string }[]).map(row => ({ cardId: row.card_id, counts: { release: row.selection_count }, ratingCount: row.submission_count, averageTier: Number(row.selection_rate) }))
  const prediction = project.type === 'prediction'
  const aggregateByCard = new Map(aggregates.map(aggregate => [aggregate.cardId, aggregate]))
  if (prediction) {
    cards.sort((a, b) => (aggregateByCard.get(b.id)?.counts.release ?? 0) - (aggregateByCard.get(a.id)?.counts.release ?? 0))
  } else if (project.type === 'tier') {
    cards.sort((a, b) => {
      const aAggregate = aggregateByCard.get(a.id)
      const bAggregate = aggregateByCard.get(b.id)
      const averageDifference = (bAggregate?.averageTier ?? Number.NEGATIVE_INFINITY) - (aAggregate?.averageTier ?? Number.NEGATIVE_INFINITY)
      if (averageDifference !== 0) return averageDifference
      return (bAggregate?.ratingCount ?? 0) - (aAggregate?.ratingCount ?? 0)
    })
  }
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const heading = hasTabs
    ? (tab === 'ranking' ? '集計結果' : tab === 'mine' ? `自分の${choiceLabel}` : `みんなの${choiceLabel}`)
    : (prediction ? 'みんなの殿堂解除予想' : communityLabel)
  const description = hasTabs
    ? (tab === 'ranking' ? `みんなの${choiceLabel}で選ばれたカードをカード単位で集計しています。` : tab === 'mine' ? `あなたが登録した${choiceLabel}を表示しています。` : `登録された${choiceLabel}を新着順で表示しています。`)
    : (prediction ? '登録された殿堂解除予想を新着順で表示しています。' : `登録された${project.type === 'tier' ? 'Tier表' : '作品'}を新着順で表示しています。`)
  const pageHref = (targetPage: number) => hasTabs ? `?tab=all&page=${targetPage}#submissions-list` : `?page=${targetPage}#submissions-list`
  const renderSubmissionCard = (submission: PublicSubmission, canEdit: boolean) =>
    <article key={submission.id} className={`min-w-0 rounded-xl border bg-white p-3 shadow-sm ${created === submission.id ? 'border-emerald-500 ring-2 ring-emerald-200' : ''}`}>
      {created === submission.id && <p className="mb-2 text-sm font-bold text-emerald-700">登録しました</p>}
      <Link href={`/makers/${slug}/submissions/${submission.id}`} className="block transition hover:opacity-90">
        {isSelect
          ? <SelectSubmissionBoard slug={slug} cards={submission.items.map(item => ({ id: item.card_id, name: item.card.name, imageUrl: item.card.image_url }))} compact exportTitle={selectExportTitle(submission.title, selectDefaultTitle, resultTitle)} />
          : <MakerSubmissionBoard submission={submission} groups={config.groups} compact showRegulationBadges={!prediction} />}
        <h2 className="mt-3 line-clamp-2 font-black">{submission.title}</h2>
        <p className="mt-1 text-sm text-gray-600">{submission.authorName}</p>
        {submission.comment && <p className="mt-2 line-clamp-2 break-words text-sm text-gray-600">{submission.comment}</p>}
        <time className="mt-2 block text-xs text-gray-400">{formatJapanDateTime(submission.created_at)}</time>
      </Link>
      {tab === 'mine' && slug === 'my-duema-9' && user && (
        <div className="mt-3"><RepresentativeButton contentType="my_duema_9" contentId={submission.id} selected={savedRepresentativeId === submission.id} /></div>
      )}
      <SubmissionActions slug={slug} submissionId={submission.id} canEdit={canEdit} />
    </article>
  return <main className="min-h-screen bg-slate-50 px-3 pb-3 pt-1 sm:pb-5 sm:pt-1"><div className="mx-auto max-w-6xl">
    <Link href={`/makers/${slug}`} className="inline-flex h-8 items-center text-sm font-bold text-blue-700">{backLabel}</Link>
    <div className="mt-1 sm:flex sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-black">{heading}</h1>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      {hasTabs && <SelectMakerSubmissionTabs slug={slug} active={tab} choiceLabel={choiceLabel} className="hidden shrink-0 sm:flex" />}
    </div>
    {hasTabs && <div className="-mx-3 mt-3 overflow-x-auto px-3 sm:hidden"><SelectMakerSubmissionTabs slug={slug} active={tab} choiceLabel={choiceLabel} className="flex w-max" /></div>}
    {(project.type === 'tier' || prediction) && <SmoothHashLink targetId="community-tier" className="mt-4 inline-flex rounded-lg border border-blue-700 bg-white px-4 py-2 text-sm font-bold text-blue-700">{prediction ? '📊 カード別の解除予想率を見る' : '📊 カード別の評価を見る'}</SmoothHashLink>}
    <div id="submissions-list" className="scroll-mt-4" />
    {tab === 'ranking' && selectAggregate && <section className="mt-5">
      {selectAggregate.entries.length
        ? <>
          <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl border bg-white px-4 py-3 text-sm font-bold text-gray-700">
            <span>回答 <span className="text-blue-700">{selectAggregate.total}</span>件</span>
            {selectConfig && <span>選出枠 <span className="text-blue-700">{selectAggregate.total * selectConfig.maxChoices}</span>枠</span>}
          </div>
          <div className="mt-4"><SelectMakerAggregateGrid entries={selectAggregate.entries} total={selectAggregate.total} /></div>
        </>
        : <p className="mt-6 rounded-xl border bg-white p-8 text-center text-gray-500">まだ集計できる{choiceLabel}がありません。</p>}
    </section>}
    {tab === 'mine' && (mineSubmissions.length
      ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{mineSubmissions.map(submission => renderSubmissionCard(submission, true))}</div>
      : <div className="mt-6 rounded-xl border bg-white p-8 text-center">
        <p className="text-gray-500">まだ自分の{choiceLabel}はありません。</p>
        <Link href={`/makers/${slug}`} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-6 font-bold text-white">{choiceLabel}を作る</Link>
      </div>)}
    {tab === 'all' && (submissions.length
      ? <div className={`mt-5 grid gap-4 sm:grid-cols-2 ${slug === 'hall-of-fame-release' ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>{submissions.map(submission => renderSubmissionCard(submission, isAdmin || ownedSubmissionIds.has(submission.id)))}</div>
      : <p className="mt-6 rounded-xl border bg-white p-8 text-center text-gray-500">まだ{hasTabs ? choiceLabel : project.type === 'tier' ? 'Tier表' : '作品'}が登録されていません。</p>)}
    {tab === 'all' && totalPages > 1 && <nav className="mt-6 flex items-center justify-center gap-3 text-sm font-bold"><Link aria-disabled={page <= 1} className={page <= 1 ? 'pointer-events-none text-gray-300' : 'text-blue-700'} href={pageHref(page - 1)}>← 前へ</Link><span>{page} / {totalPages}</span><Link aria-disabled={page >= totalPages} className={page >= totalPages ? 'pointer-events-none text-gray-300' : 'text-blue-700'} href={pageHref(page + 1)}>次へ →</Link></nav>}
    {(project.type === 'tier' || prediction) && <div className="mt-8"><MakerCommunityTier cards={cards} groups={config.groups} aggregates={aggregates} title={prediction ? 'カード別のみんなの解除予想率' : undefined} mode={prediction ? 'selection' : 'tier'} showAllCards /><SmoothHashLink targetId="submissions-list" className="mt-3 inline-flex text-sm font-bold text-blue-700">↑ {prediction ? '予想一覧へ戻る' : 'Tier表一覧へ戻る'}</SmoothHashLink></div>}
  </div></main>
}
