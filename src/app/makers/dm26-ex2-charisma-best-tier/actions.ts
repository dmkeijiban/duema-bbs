'use server'

import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { parseMakerProjectConfig, type MakerSubmissionMeta } from '@/lib/maker'
import { recordMakerEvent } from '@/lib/maker-events'

const PROJECT_SLUG = 'dm26-ex2-charisma-best-tier'
const ANONYMOUS_COOKIE = 'maker_anonymous_id'

function anonymousHash(value: string, purpose: 'actor' | 'edit') {
  const pepper = process.env.ADMIN_COOKIE_SECRET || process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!pepper) throw new Error('匿名登録のサーバー設定が不足しています')
  return createHash('sha256').update(`${pepper}:${purpose}:${value}`).digest('hex')
}

export async function savePublicTierSubmission(payload: Record<string, string[]>, meta?: MakerSubmissionMeta) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const title = meta?.title.trim() || 'カリスマBEST Tier表'
    const comment = meta?.comment.trim() ?? ''
    if (title.length > 40) return { ok: false, message: 'タイトルは40文字以内で入力してください' }
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
    const allowedGroups = new Set(config.groups.map(group => group.key))
    if (Object.keys(payload).some(group => !allowedGroups.has(group))) return { ok: false, message: '不正なTierが含まれています' }

    const items = Object.entries(payload).flatMap(([groupKey, cardIds]) =>
      cardIds.map((cardId, position) => ({ card_id: cardId, group_key: groupKey, position })),
    )
    if (!items.length) return { ok: false, message: 'カードを1枚以上評価してください' }
    const seen = new Set<string>()
    if (!config.allowDuplicates && items.some(item => seen.has(item.card_id) || !seen.add(item.card_id))) {
      return { ok: false, message: '同じカードは複数配置できません' }
    }
    if (config.maxChoices !== null && items.length > config.maxChoices) return { ok: false, message: `選択できるカードは最大${config.maxChoices}枚です` }

    // 操作中に非公開化された場合も、RPC直前で保存を拒否する。
    const { data: publishState, error: publishStateError } = await admin.from('maker_projects').select('id').eq('id', project.id).eq('slug', PROJECT_SLUG).eq('is_public', true).eq('status', 'published').maybeSingle()
    if (publishStateError || !publishState) return { ok: false, message: 'この企画は現在公開されていません' }

    let submissionId: string | null = null
    let saveError: { message: string } | null = null
    if (user) {
      const { data: latestAuth } = await supabase.auth.getUser()
      if (!latestAuth.user || latestAuth.user.id !== user.id) return { ok: false, message: 'ログイン状態を確認できません。下書きは端末に保存されています' }
      const result = await admin.rpc('create_maker_submission', { p_project_id: project.id, p_user_id: user.id, p_title: title, p_comment: comment || null, p_items: items })
      submissionId = result.data
      saveError = result.error
    } else {
      const cookieStore = await cookies()
      let anonymousId = cookieStore.get(ANONYMOUS_COOKIE)?.value
      if (!anonymousId || !/^[A-Za-z0-9_-]{40,100}$/.test(anonymousId)) anonymousId = randomBytes(32).toString('base64url')
      const result = await admin.rpc('create_anonymous_maker_submission', {
        p_project_id: project.id,
        p_title: title,
        p_comment: comment || null,
        p_items: items,
        p_edit_token_hash: anonymousHash(anonymousId, 'edit'),
        p_actor_hash: anonymousHash(anonymousId, 'actor'),
      })
      submissionId = result.data
      saveError = result.error
      if (!saveError) cookieStore.set(ANONYMOUS_COOKIE, anonymousId, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 })
    }
    if (saveError || !submissionId) {
      const message = saveError?.message.includes('MAKER_RATE_LIMITED') ? '連続登録を防ぐため、少し時間をおいてください' : saveError?.message ?? '登録IDを取得できませんでした'
      return { ok: false, message: `保存に失敗しました: ${message}` }
    }
    if (user) {
      const { data: signup } = await admin.from('maker_events').select('id').eq('project_id', project.id).eq('event_type', 'signup_completed').eq('user_id', user.id).maybeSingle()
      if (signup) await recordMakerEvent({ slug: PROJECT_SLUG, eventType: 'submission_after_signup' })
    }
    return { ok: true, message: 'Tier表を登録しました', redirectTo: `/makers/${PROJECT_SLUG}/submissions?created=${submissionId}` }
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存に失敗しました'
    console.error('savePublicTierSubmission failed', { message })
    return { ok: false, message }
  }
}
