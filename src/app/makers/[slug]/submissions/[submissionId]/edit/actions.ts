'use server'

import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { parseMakerProjectConfig, type MakerSubmissionMeta } from '@/lib/maker'

export async function updateMakerSubmission(slug: string, submissionId: string, payload: Record<string, string[]>, meta?: MakerSubmissionMeta) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'ログインが必要です' }
  const admin = createAdminClient()
  const { data: project } = await admin.from('maker_projects').select('id,config').eq('slug', slug).eq('is_public', true).eq('status', 'published').maybeSingle()
  if (!project) return { ok: false, message: '企画が見つかりません' }
  const { data: owned } = await admin.from('maker_submissions').select('id,user_id').eq('id', submissionId).eq('project_id', project.id).eq('user_id', user.id).eq('is_valid', true).eq('is_public', true).maybeSingle()
  if (!owned) return { ok: false, message: 'このTier表を編集する権限がありません' }
  const title = meta?.title.trim() || 'Tier表'
  const comment = meta?.comment.trim() ?? ''
  if (title.length > 40 || comment.length > 200) return { ok: false, message: 'タイトルまたはコメントが長すぎます' }
  const config = parseMakerProjectConfig(project.config)
  const groups = new Set(config.groups.map(group => group.key))
  if (Object.keys(payload).some(key => !groups.has(key))) return { ok: false, message: '不正なTierが含まれています' }
  const items = Object.entries(payload).flatMap(([group_key, ids]) => ids.map((card_id, position) => ({ card_id, group_key, position })))
  const { error } = await admin.rpc('update_owned_maker_submission', { p_project_id: project.id, p_submission_id: submissionId, p_user_id: user.id, p_title: title, p_comment: comment || null, p_items: items })
  return error ? { ok: false, message: '変更の保存に失敗しました' } : { ok: true, message: '変更を保存しました', redirectTo: `/makers/${slug}/submissions/${submissionId}` }
}
