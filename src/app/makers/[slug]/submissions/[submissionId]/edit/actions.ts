'use server'

import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { parseMakerProjectConfig, type MakerSubmissionMeta } from '@/lib/maker'
import { getMakerAnonymousEditHash } from '@/lib/maker-anonymous-owner'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { cookies } from 'next/headers'

export async function updateMakerSubmission(slug: string, submissionId: string, payload: Record<string, string[]>, meta?: MakerSubmissionMeta) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAdmin = verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)
  const editHash = await getMakerAnonymousEditHash()
  const admin = createAdminClient()
  const { data: project } = await admin.from('maker_projects').select('id,type,config').eq('slug', slug).eq('is_public', true).eq('status', 'published').maybeSingle()
  if (!project) return { ok: false, message: '企画が見つかりません' }

  const { data: submission } = await admin
    .from('maker_submissions')
    .select('id,user_id,anonymous_edit_token_hash')
    .eq('id', submissionId)
    .eq('project_id', project.id)
    .eq('is_valid', true)
    .eq('is_public', true)
    .maybeSingle()
  if (!submission) return { ok: false, message: '投稿が見つかりません' }

  const ownedByUser = submission.user_id !== null && user?.id === submission.user_id
  const ownedAnonymously = submission.user_id === null && editHash !== null && submission.anonymous_edit_token_hash === editHash
  if (!isAdmin && !ownedByUser && !ownedAnonymously) return { ok: false, message: 'この投稿を編集する権限がありません' }

  const fallbackTitle = project.type === 'prediction' ? '殿堂解除予想' : 'カリスマBEST Tier表'
  const title = meta?.title.trim() || fallbackTitle
  const comment = meta?.comment.trim() ?? ''
  if (title.length > 40 || comment.length > 200) return { ok: false, message: 'タイトルまたはコメントが長すぎます' }

  const config = parseMakerProjectConfig(project.config)
  const groups = new Set(config.groups.map(group => group.key))
  if (Object.keys(payload).some(key => !groups.has(key))) return { ok: false, message: '不正なグループが含まれています' }
  const items = Object.entries(payload).flatMap(([group_key, ids]) => ids.map((card_id, position) => ({ card_id, group_key, position })))
  if (project.type === 'prediction' && items.length === 0) return { ok: false, message: '解除予想カードを1枚以上選んでください' }

  let error: { message: string } | null = null
  if (isAdmin) {
    const result = await admin.rpc('update_admin_maker_submission', { p_project_id: project.id, p_submission_id: submissionId, p_title: title, p_comment: comment || null, p_items: items })
    error = result.error
  } else if (ownedByUser && user) {
    const result = await admin.rpc('update_owned_maker_submission', { p_project_id: project.id, p_submission_id: submissionId, p_user_id: user.id, p_title: title, p_comment: comment || null, p_items: items })
    error = result.error
  } else if (ownedAnonymously && editHash) {
    const result = await admin.rpc('update_anonymous_maker_submission', { p_project_id: project.id, p_submission_id: submissionId, p_edit_token_hash: editHash, p_title: title, p_comment: comment || null, p_items: items })
    error = result.error
  }

  return error
    ? { ok: false, message: '変更の保存に失敗しました' }
    : { ok: true, message: '変更を保存しました', redirectTo: `/makers/${slug}/submissions/${submissionId}` }
}
