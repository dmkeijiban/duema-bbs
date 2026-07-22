'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import type { RepresentativeContentType } from '@/lib/user-content-representatives'

export async function setContentRepresentative(contentType: RepresentativeContentType, contentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'ログインが必要です。' }
  if (!contentId) return { ok: false, message: '作品を確認できませんでした。' }

  const admin = createAdminClient()
  if (contentType === 'my_duema_9') {
    const { data: project } = await admin.from('maker_projects').select('id').eq('slug', 'my-duema-9').maybeSingle()
    const { data: owned } = project
      ? await admin.from('maker_submissions').select('id').eq('id', contentId).eq('project_id', project.id).eq('user_id', user.id).eq('is_valid', true).maybeSingle()
      : { data: null }
    if (!owned) return { ok: false, message: '本人が作成した9選ではありません。' }
  } else if (contentType === 'deck') {
    const { data: owned } = await admin.from('deck_submissions').select('id').eq('id', contentId).eq('user_id', user.id).eq('format', 'original').maybeSingle()
    if (!owned) return { ok: false, message: '本人が作成したデッキではありません。' }
  } else {
    return { ok: false, message: '作品の種類が不正です。' }
  }

  const { error } = await admin.from('user_content_representatives').upsert({
    user_id: user.id,
    content_type: contentType,
    content_id: contentId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,content_type' })
  if (error) return { ok: false, message: '代表を設定できませんでした。migrationの適用状況を確認してください。' }

  revalidatePath('/mypage')
  revalidatePath('/makers/my-duema-9/submissions')
  revalidatePath('/makers/deck-maker/submissions')
  return { ok: true }
}

