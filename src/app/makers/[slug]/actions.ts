'use server'

import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { hashMakerAnonymousOwner, MAKER_ANONYMOUS_COOKIE } from '@/lib/maker-anonymous-owner'
import { parseSelectMakerConfig } from '@/lib/maker'

const SOURCE_KEY_PATTERN = /^[a-zA-Z0-9._-]{1,100}$/

export async function saveSelectSubmission(input: { slug: string; cards: { cardId: string; sourceKey?: string | null; faceSideIndex?: number | null }[]; title: string; comment: string; sessionId: string; submissionId?: string | null }) {
  try {
    if (!/^[a-z0-9][a-z0-9-]{1,80}$/.test(input.slug) || !/^[0-9a-f-]{36}$/i.test(input.sessionId)) return { ok: false, message: '作成セッションが不正です' }
    if (input.cards.some(card => card.sourceKey != null && !SOURCE_KEY_PATTERN.test(card.sourceKey))) return { ok: false, message: '選択したカードの情報が不正です' }
    const admin = createAdminClient()
    const { data: project } = await admin.from('maker_projects').select('id,type,config').eq('slug', input.slug).eq('is_public', true).eq('status', 'published').maybeSingle()
    if (!project || project.type !== 'select') return { ok: false, message: 'この企画は現在公開されていません' }
    const config = parseSelectMakerConfig(project.config)
    if ((config.exactChoices && input.cards.length !== config.maxChoices) || input.cards.length < config.minChoices || input.cards.length > config.maxChoices) return { ok: false, message: `${config.maxChoices}枚選んでください` }
    const title = (input.title.trim() || config.defaultTitle).slice(0, 40)
    const comment = input.comment.trim().slice(0, 200)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (input.slug === 'my-duema-9' && !user) {
      return { ok: false, message: '9選の作成にはログインが必要です' }
    }
    const cookieStore = await cookies()
    let anonymousId = cookieStore.get(MAKER_ANONYMOUS_COOKIE)?.value
    if (!user && (!anonymousId || !/^[A-Za-z0-9_-]{40,100}$/.test(anonymousId))) anonymousId = randomBytes(32).toString('base64url')
    const result = await admin.rpc('upsert_select_maker_submission', {
      p_project_id: project.id, p_user_id: user?.id ?? null,
      p_edit_token_hash: user ? null : hashMakerAnonymousOwner(anonymousId!, 'edit'),
      p_actor_hash: user ? null : hashMakerAnonymousOwner(anonymousId!, 'actor'),
      p_session_id: input.sessionId, p_submission_id: input.submissionId ?? null,
      p_title: title, p_comment: comment || null,
      p_card_ids: input.cards.map(card => card.cardId),
      p_source_keys: input.cards.map(card => card.sourceKey ?? null),
      p_face_side_indexes: input.cards.map(card => card.faceSideIndex ?? null),
    })
    if (result.error || !result.data) return { ok: false, message: '一覧登録に失敗しました。画像は保存できます' }
    if (!user) cookieStore.set(MAKER_ANONYMOUS_COOKIE, anonymousId!, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 31536000 })
    return { ok: true, message: input.submissionId ? '投稿を更新しました' : 'みんなの一覧に登録しました', submissionId: String(result.data) }
  } catch (error) {
    console.error('saveSelectSubmission failed', { message: error instanceof Error ? error.message : String(error) })
    return { ok: false, message: '一覧登録に失敗しました。画像は保存できます' }
  }
}
