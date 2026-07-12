'use server'

import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { parseMakerProjectConfig } from '@/lib/maker'

const PROJECT_SLUG = 'dm26-ex2-charisma-best-tier'

export async function savePublicTierSubmission(payload: Record<string, string[]>) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, message: 'ログインが必要です' }

    const admin = createAdminClient()
    const { data: project, error: projectError } = await admin
      .from('maker_projects')
      .select('id,config')
      .eq('slug', PROJECT_SLUG)
      .eq('is_public', true)
      .eq('status', 'published')
      .single()
    if (projectError || !project) return { ok: false, message: 'この企画は現在公開されていません' }

    const config = parseMakerProjectConfig(project.config)
    const allowedGroups = new Set(config.groups.map(group => group.key))
    if (Object.keys(payload).some(group => !allowedGroups.has(group))) return { ok: false, message: '不正なTierが含まれています' }

    const items = Object.entries(payload).flatMap(([groupKey, cardIds]) =>
      cardIds.map((cardId, position) => ({ card_id: cardId, group_key: groupKey, position })),
    )
    const seen = new Set<string>()
    if (!config.allowDuplicates && items.some(item => seen.has(item.card_id) || !seen.add(item.card_id))) {
      return { ok: false, message: '同じカードは複数配置できません' }
    }
    if (config.maxChoices !== null && items.length > config.maxChoices) return { ok: false, message: `選択できるカードは最大${config.maxChoices}枚です` }

    // 操作中にログアウト・非公開化された場合も、RPC直前で保存を拒否する。
    const [{ data: latestAuth }, { data: publishState, error: publishStateError }] = await Promise.all([
      supabase.auth.getUser(),
      admin.from('maker_projects').select('id').eq('id', project.id).eq('slug', PROJECT_SLUG).eq('is_public', true).eq('status', 'published').maybeSingle(),
    ])
    if (!latestAuth.user || latestAuth.user.id !== user.id) return { ok: false, message: 'ログイン状態を確認できません。下書きは端末に保存されています' }
    if (publishStateError || !publishState) return { ok: false, message: 'この企画は現在公開されていません' }

    const { error } = await admin.rpc('save_maker_submission', { p_project_id: project.id, p_user_id: user.id, p_items: items })
    if (error) return { ok: false, message: `保存に失敗しました: ${error.message}` }
    return { ok: true, message: 'Tier表を上書き保存しました' }
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存に失敗しました'
    console.error('savePublicTierSubmission failed', { message })
    return { ok: false, message }
  }
}
