'use server'

import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import type { MakerSubmissionMeta } from '@/lib/maker'

const SLUG = 'hall-of-fame-release'
export async function saveHallReleaseSubmission(payload: Record<string, string[]>, meta?: MakerSubmissionMeta) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: '殿堂解除予想の登録にはログインが必要です' }
  const admin = createAdminClient()
  const { data: project } = await admin.from('maker_projects').select('id').eq('slug', SLUG).eq('status', 'published').eq('is_public', true).maybeSingle()
  if (!project) return { ok: false, message: 'この企画は現在公開されていません' }
  const title = meta?.title.trim() || '殿堂解除予想'
  const comment = meta?.comment.trim() ?? ''
  if (title.length > 40) return { ok: false, message: 'タイトルは40文字以内で入力してください' }
  if (comment.length > 200) return { ok: false, message: '一言コメントは200文字以内で入力してください' }
  const ids = payload.release ?? []
  if (!ids.length) return { ok: false, message: '解除予想カードを1枚以上選んでください' }
  if (Object.keys(payload).some(key => key !== 'release') || new Set(ids).size !== ids.length) return { ok: false, message: '不正な回答です' }
  const items = ids.map((card_id, position) => ({ card_id, group_key: 'release', position }))
  const { data: allowed } = await admin.from('maker_project_cards').select('card_id,cards!inner(is_active)').eq('project_id', project.id).in('card_id', ids).eq('cards.is_active', true)
  if ((allowed ?? []).length !== ids.length) return { ok: false, message: '企画対象外のカードが含まれています' }

  const result = await admin.rpc('create_maker_submission', { p_project_id: project.id, p_user_id: user.id, p_title: title, p_comment: comment || null, p_items: items })
  const submissionId: string | null = result.data
  const error: { message: string } | null = result.error
  if (error || !submissionId) {
    const message = error?.message.includes('MAKER_RATE_LIMITED') ? '連続登録を防ぐため、少し時間をおいてください' : error?.message ?? '登録IDを取得できませんでした'
    return { ok: false, message: `保存に失敗しました: ${message}` }
  }
  return { ok: true, message: '殿堂解除予想を登録しました', redirectTo: `/makers/${SLUG}/submissions?created=${submissionId}#submissions-list` }
}
