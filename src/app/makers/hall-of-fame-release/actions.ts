'use server'

import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'

const SLUG = 'hall-of-fame-release'

export async function saveHallReleaseSubmission(payload: Record<string, string[]>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'ログインが必要です' }
  const admin = createAdminClient()
  const { data: project } = await admin.from('maker_projects').select('id').eq('slug', SLUG).eq('status', 'published').eq('is_public', true).maybeSingle()
  if (!project) return { ok: false, message: 'この企画は現在公開されていません' }
  const ids = payload.release ?? []
  if (Object.keys(payload).some(key => key !== 'release') || new Set(ids).size !== ids.length) return { ok: false, message: '不正な回答です' }
  const items = ids.map((card_id, position) => ({ card_id, group_key: 'release', position }))
  const { error } = await admin.rpc('save_maker_submission', { p_project_id: project.id, p_user_id: user.id, p_items: items })
  return error ? { ok: false, message: `保存に失敗しました: ${error.message}` } : { ok: true, message: '殿堂解除予想を保存しました' }
}
