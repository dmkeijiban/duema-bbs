'use server'

import { createHash, randomBytes } from 'node:crypto'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { parseMakerProjectConfig, type MakerSubmissionMeta } from '@/lib/maker'
import { recordMakerEvent } from '@/lib/maker-events'
import { isValidAnonymousId } from '@/lib/maker-events-shared'

const PROJECT_SLUG = 'dm26-ex2-charisma-best-tier'

export async function savePublicTierSubmission(payload: Record<string, string[]>, meta?: MakerSubmissionMeta, anonymousId?: string | null) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const title = meta?.title.trim() ?? ''
    const comment = meta?.comment.trim() ?? ''
    if (!title || title.length > 40) return { ok: false, message: 'タイトルは1〜40文字で入力してください' }
    if (comment.length > 200) return { ok: false, message: '一言コメントは200文字以内で入力してください' }

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
    if (!user && !config.allowAnonymousSubmission) return { ok: false, message: 'ログインが必要です' }
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
    if (user && (!latestAuth.user || latestAuth.user.id !== user.id)) return { ok: false, message: 'ログイン状態を確認できません。下書きは端末に保存されています' }
    if (publishStateError || !publishState) return { ok: false, message: 'この企画は現在公開されていません' }

    if (!user) {
      const secret = process.env.MAKER_ANONYMOUS_SECRET || process.env.ADMIN_COOKIE_SECRET || process.env.NEXTAUTH_SECRET
      const headerStore = await headers()
      const forwardedFor = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
      const userAgent = headerStore.get('user-agent') ?? ''
      if (!secret || !isValidAnonymousId(anonymousId) || !forwardedFor || !userAgent) return { ok: false, message: '匿名登録を確認できませんでした' }
      const ownerToken = randomBytes(32).toString('hex')
      const ownerTokenHash = createHash('sha256').update(ownerToken).digest('hex')
      const actorHash = createHash('sha256').update(`${secret}\n${anonymousId}\n${forwardedFor}\n${userAgent}`).digest('hex')
      const { data: submissionId, error } = await admin.rpc('create_anonymous_maker_submission', { p_project_id: project.id, p_title: title, p_comment: comment || null, p_items: items, p_edit_token_hash: ownerTokenHash, p_actor_hash: actorHash })
      if (error || !submissionId) {
        const limited = error?.message.includes('MAKER_ANONYMOUS_RATE_LIMITED')
        return { ok: false, message: limited ? '登録回数が多いため、しばらく時間をおいてください。' : '保存に失敗しました' }
      }
      return { ok: true, message: 'Tier表を登録しました', submissionId, ownerToken, redirectTo: `/makers/${PROJECT_SLUG}/submissions?created=${submissionId}` }
    }

    const { data: submissionId, error } = await admin.rpc('create_maker_submission', { p_project_id: project.id, p_user_id: user.id, p_title: title, p_comment: comment || null, p_items: items })
    if (error || !submissionId) return { ok: false, message: `保存に失敗しました: ${error?.message ?? '登録IDを取得できませんでした'}` }
    const { data: signup } = await admin.from('maker_events').select('id').eq('project_id', project.id).eq('event_type', 'signup_completed').eq('user_id', user.id).maybeSingle()
    if (signup) await recordMakerEvent({ slug: PROJECT_SLUG, eventType: 'submission_after_signup' })
    return { ok: true, message: 'Tier表を登録しました', redirectTo: `/makers/${PROJECT_SLUG}/submissions?created=${submissionId}` }
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存に失敗しました'
    console.error('savePublicTierSubmission failed', { message })
    return { ok: false, message }
  }
}
