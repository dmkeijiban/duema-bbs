import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCurrentHallCards, getHallCardOfficialId } from '@/lib/hall-of-fame'
import type { MakerCard, MakerDraft } from '@/lib/maker'
import { AdstirBannerClient } from '@/components/AdstirBannerClient'
import HallReleaseMaker from './HallReleaseMaker'
import { makerRequiresLogin } from '@/lib/maker-auth-requirements'

export const metadata = { title: '殿堂解除選手権 | デュエマ掲示板', description: '次に殿堂解除されると思うカードを選ぼう！', openGraph: { title: '殿堂解除選手権', description: '次に殿堂解除されると思うカードを選ぼう！', images: ['/hall-of-fame-release-og.svg'] }, twitter: { card: 'summary_large_image' as const, images: ['/hall-of-fame-release-og.svg'] } }

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (makerRequiresLogin() && !user) redirect('/login?next=/makers/hall-of-fame-release')

  const admin = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : null
  const current = [...getCurrentHallCards()].sort(
    (a, b) => Number(a.status !== 'hall') - Number(b.status !== 'hall'),
  )
  const sourceKeys = current.map(getHallCardOfficialId).filter((value): value is string => Boolean(value))
  const [projectResult, cardsResult] = admin ? await Promise.all([
    admin.from('maker_projects').select('id,status,is_public').eq('slug', 'hall-of-fame-release').maybeSingle(),
    admin.from('cards').select('id,name,image_url,civilization,cost,card_type,source_key').eq('source_kind', 'takaratomy_card_id').in('source_key', sourceKeys).eq('is_active', true),
  ]) : [{ data: null, error: null }, { data: [], error: null }]
  const { data: project } = projectResult
  const { data: dbCards } = cardsResult
  const fetchError = projectResult.error || cardsResult.error
  if (fetchError) {
    console.error('[hall-of-fame-release] Supabase data fetch failed', { code: fetchError.code })
  }
  const projectPublished = Boolean(project?.is_public && project.status === 'published')
  const bySourceKey = new Map((dbCards ?? []).map(card => [card.source_key, card]))
  const missing = current.filter(card => !bySourceKey.has(getHallCardOfficialId(card)))
  const projectReady = Boolean(admin && !fetchError && projectPublished && missing.length === 0)
  const unavailableMessage = !admin
    ? '回答登録・集計に必要なサーバー設定を確認中です。'
    : fetchError
      ? 'カード情報を取得できませんでした。時間をおいて再読み込みしてください。'
      : !projectPublished
        ? '回答登録・集計は現在準備中です。'
        : missing.length > 0
          ? `回答登録・集計の対象カードが不足しています（不足 ${missing.length}枚）。`
          : null
  const cards: MakerCard[] = current.map(item => {
    const sourceKey = getHallCardOfficialId(item)
    const card = bySourceKey.get(sourceKey)
    return { id: card?.id ?? `hall:${item.name}`, name: item.name, imageUrl: card?.image_url ?? item.imageUrl ?? null, civilization: card?.civilization ?? [], cost: card?.cost ?? null, cardType: card?.card_type ?? null, searchText: item.name, badge: item.status === 'hall' ? { label: '殿堂', value: 'hall', className: 'bg-yellow-300' } : { label: 'プレ殿', value: 'premium', className: 'bg-red-700 text-white' } }
  })
  const draft: MakerDraft = { release: [] }; let saved = false
  if (user && projectReady && project && admin) { const { data: submissions } = await admin.from('maker_submissions').select('id').eq('project_id', project.id).eq('user_id', user.id).eq('is_valid', true).order('created_at', { ascending: false }).limit(1); const submission = submissions?.[0]; if (submission) { saved = true; const { data: items } = await admin.from('maker_submission_items').select('card_id').eq('submission_id', submission.id).eq('group_key', 'release').order('position'); draft.release = (items ?? []).map(item => item.card_id) } }
  const { data: rows } = projectReady && project && admin ? await admin.from('maker_selection_aggregates').select('card_id,selection_count,submission_count,selection_rate').eq('project_id', project.id) : { data: [] }
  const aggregates = (rows ?? []).map(row => ({ cardId: row.card_id, counts: { release: row.selection_count }, ratingCount: row.submission_count, averageTier: Number(row.selection_rate) }))
  return <main className="min-h-screen bg-slate-50 px-3 py-5"><div className="mx-auto max-w-7xl"><AdstirBannerClient slot="sp_list_top" className="mb-3 mt-0" /><h1 className="text-2xl font-black">殿堂解除選手権</h1><p className="mt-1 text-sm text-gray-600">次に殿堂解除されると思うカードを選ぼう！</p>{unavailableMessage && <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">{unavailableMessage}</p>}<HallReleaseMaker cards={cards} draft={draft} canSave={projectReady} saved={saved} aggregates={aggregates} /></div></main>
}
