'use server'

import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'

export async function deleteMakerSubmission(slug: string, submissionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'ログインが必要です' }
  const admin = createAdminClient()
  const { data: project } = await admin.from('maker_projects').select('id').eq('slug', slug).eq('is_public', true).eq('status', 'published').maybeSingle()
  if (!project) return { ok: false, message: '企画が見つかりません' }
  const { data: owned } = await admin.from('maker_submissions').select('id').eq('id', submissionId).eq('project_id', project.id).eq('user_id', user.id).eq('is_valid', true).eq('is_public', true).maybeSingle()
  if (!owned) return { ok: false, message: 'このTier表を削除する権限がありません' }
  const { error } = await admin.rpc('delete_owned_maker_submission', { p_project_id: project.id, p_submission_id: submissionId, p_user_id: user.id })
  return error ? { ok: false, message: '削除に失敗しました' } : { ok: true, message: 'Tier表を削除しました' }
}
