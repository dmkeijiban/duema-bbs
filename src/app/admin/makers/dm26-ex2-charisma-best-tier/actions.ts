'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { parseMakerProjectConfig } from '@/lib/maker'
import { assertPreviewDatabaseTarget } from '@/lib/preview-safety'

const PROJECT_SLUG = 'dm26-ex2-charisma-best-tier'

export async function setTierProjectVisibility(isPublic: boolean) {
  if (typeof isPublic !== 'boolean') return { ok: false, message: '公開状態が不正です' }
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return { ok: false, message: '管理者認証が必要です' }
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('maker_projects')
      .update({
        is_public: isPublic,
        status: isPublic ? 'published' : 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('slug', PROJECT_SLUG)
      .select('id')
      .single()

    if (error || !data) return { ok: false, message: '公開状態を更新できませんでした' }
    revalidatePath('/admin/makers/dm26-ex2-charisma-best-tier')
    revalidatePath('/admin/tier-maker')
    revalidatePath('/makers/dm26-ex2-charisma-best-tier')
    return { ok: true, message: isPublic ? 'Tier表メーカーを公開しました' : 'Tier表メーカーを非公開にしました' }
  } catch (error) {
    const message = error instanceof Error ? error.message : '公開状態を更新できませんでした'
    console.error('setTierProjectVisibility failed', { message })
    return { ok: false, message }
  }
}

export async function saveTierSubmission(payload: Record<string, string[]>) {
  try {
    assertPreviewDatabaseTarget()

    if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) {
      return { ok: false, message: '管理者認証が必要です' }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, message: 'ログインが必要です' }

    const admin = createAdminClient()
    const { data: project, error: projectError } = await admin
      .from('maker_projects')
      .select('id,config')
      .eq('slug', PROJECT_SLUG)
      .single()

    if (projectError || !project) return { ok: false, message: '企画が未準備です' }

    const config = parseMakerProjectConfig(project.config)
    const allowed = new Set(config.groups.map(group => group.key))
    const unknownGroups = Object.keys(payload).filter(group => !allowed.has(group))
    if (unknownGroups.length > 0) {
      return { ok: false, message: `不正なTierが含まれています: ${unknownGroups.join(', ')}` }
    }

    const items = Object.entries(payload).flatMap(([groupKey, ids]) =>
      ids.map((cardId, position) => ({ card_id: cardId, group_key: groupKey, position })),
    )

    const seen = new Set<string>()
    if (!config.allowDuplicates && items.some(item => seen.has(item.card_id) || !seen.add(item.card_id))) {
      return { ok: false, message: '同じカードは複数配置できません' }
    }
    if (config.maxChoices !== null && items.length > config.maxChoices) {
      return { ok: false, message: `選択できるカードは最大${config.maxChoices}枚です` }
    }

    const { error } = await admin.rpc('save_maker_submission', {
      p_project_id: project.id,
      p_user_id: user.id,
      p_items: items,
    })
    if (error) return { ok: false, message: `保存に失敗しました: ${error.message}` }

    return { ok: true, message: 'Tier表を上書き保存しました' }
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存に失敗しました'
    console.error('saveTierSubmission failed', { message })
    return { ok: false, message }
  }
}
