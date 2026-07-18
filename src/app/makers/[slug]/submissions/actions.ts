'use server'

import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { getMakerAnonymousEditHash } from '@/lib/maker-anonymous-owner'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { cookies } from 'next/headers'

export async function deleteMakerSubmission(slug: string, submissionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAdmin = verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)
  const editHash = await getMakerAnonymousEditHash()
  const admin = createAdminClient()
  const { data: project } = await admin.from('maker_projects').select('id,type').eq('slug', slug).eq('is_public', true).eq('status', 'published').maybeSingle()
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

  let error: { message: string } | null = null
  if (isAdmin) {
    const result = await admin.rpc('delete_admin_maker_submission', { p_project_id: project.id, p_submission_id: submissionId })
    error = result.error
  } else if (submission.user_id !== null) {
    if (!user || submission.user_id !== user.id) return { ok: false, message: 'この投稿を削除する権限がありません' }
    const result = await admin.rpc('delete_owned_maker_submission', { p_project_id: project.id, p_submission_id: submissionId, p_user_id: user.id })
    error = result.error
  } else {
    if (!editHash || submission.anonymous_edit_token_hash !== editHash) return { ok: false, message: 'この投稿を削除する権限がありません' }
    const result = await admin.rpc('delete_anonymous_maker_submission', { p_project_id: project.id, p_submission_id: submissionId, p_edit_token_hash: editHash })
    error = result.error
  }

  const label = project.type === 'prediction' ? '予想' : project.type === 'select' ? '作品' : 'Tier表'
  return error ? { ok: false, message: '削除に失敗しました' } : { ok: true, message: `${label}を削除しました` }
}
