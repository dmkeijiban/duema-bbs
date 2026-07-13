import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { getCurrentHallCards, getHallCardOfficialId } from '@/lib/hall-of-fame'
import type { MakerCard, MakerDraft } from '@/lib/maker'
import HallReleaseMaker from './HallReleaseMaker'

export const metadata = { title: '殿堂解除選手権 | デュエマ掲示板', description: '次に殿堂解除されると思うカードを選ぼう！', openGraph: { title: '殿堂解除選手権', description: '次に殿堂解除されると思うカードを選ぼう！', images: ['/hall-of-fame-release-og.svg'] }, twitter: { card: 'summary_large_image' as const, images: ['/hall-of-fame-release-og.svg'] } }

export default async function Page() {
  const admin = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : null
  const current = getCurrentHallCards()
  const sourceKeys = current.map(getHallCardOfficialId).filter((value): value is string => Boolean(value))
  const [{ data: project }, { data: dbCards }] = admin ? await Promise.all([
    admin.from('maker_projects').select('id,status,is_public').eq('slug', 'hall-of-fame-release').maybeSingle(),
    admin.from('cards').select('id,name,image_url,civilization,cost,card_type,source_key').eq('source_kind', 'takaratomy_card_id').in('source_key', sourceKeys).eq('is_active', true),
  ]) : [{ data: null }, { data: [] }]
  const projectPublished = Boolean(project?.is_public && project.status === 'published')
  const bySourceKey = new Map((dbCards ?? []).map(card => [card.source_key, card]))
  const missing = current.filter(card => !bySourceKey.has(getHallCardOfficialId(card)))
  const projectReady = projectPublished && missing.length === 0
  const cards: MakerCard[] = current.map(item => {
    const sourceKey = getHallCardOfficialId(item)
    const card = bySourceKey.get(sourceKey)
    return { id: card?.id ?? `hall:${item.name}`, name: item.name, imageUrl: card?.image_url ?? item.imageUrl ?? null, civilization: card?.civilization ?? [], cost: card?.cost ?? null, cardType: card?.card_type ?? null, searchText: item.name, badge: item.status === 'hall' ? { label: '殿堂', value: 'hall', className: 'bg-yellow-300' } : { label: 'プレ殿', value: 'premium', className: 'bg-red-700 text-white' } }
  })
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
  const draft: MakerDraft = { release: [] }; let saved = false
  if (user && projectReady && project && admin) { const { data: submission } = await admin.from('maker_submissions').select('id').eq('project_id', project.id).eq('user_id', user.id).maybeSingle(); if (submission) { saved = true; const { data: items } = await admin.from('maker_submission_items').select('card_id').eq('submission_id', submission.id).eq('group_key', 'release').order('position'); draft.release = (items ?? []).map(item => item.card_id) } }
  const { data: rows } = projectReady && project && admin ? await admin.from('maker_selection_aggregates').select('card_id,selection_count,submission_count,selection_rate').eq('project_id', project.id) : { data: [] }
  const aggregates = (rows ?? []).map(row => ({ cardId: row.card_id, counts: { release: row.selection_count }, ratingCount: row.submission_count, averageTier: Number(row.selection_rate) }))
  return <main className="min-h-screen bg-slate-50 px-3 py-5"><div className="mx-auto max-w-7xl"><h1 className="text-2xl font-black">殿堂解除選手権</h1><p className="mt-1 text-sm text-gray-600">次に殿堂解除されると思うカードを選ぼう！</p>{!projectReady && <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">Preview確認中：回答登録・集計は共通カードDBとの同期migration適用後に有効になります（未同期 {missing.length}枚）。</p>}<HallReleaseMaker cards={cards} draft={draft} canSave={Boolean(user && projectReady)} saved={saved} aggregates={aggregates} /></div></main>
}
