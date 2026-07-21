'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { sanitizeResumeData, RESUME_MAKER_SLUG, type ResumeData } from '@/lib/maker-resume'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

async function getResumeProjectId(admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin.from('maker_projects').select('id').eq('slug', RESUME_MAKER_SLUG).eq('type', 'resume').eq('is_public', true).eq('status', 'published').maybeSingle()
  return data?.id as string | undefined
}

export async function saveResumeSubmission(input: { data: ResumeData; isPublic: boolean }) {
  try {
    const user = await requireUser()
    if (!user) return { ok: false, message: 'ログインが必要です' }
    const data = sanitizeResumeData(input.data)
    if (!data.handleName) return { ok: false, message: 'ハンドルネームを入力してください' }
    const admin = createAdminClient()
    const projectId = await getResumeProjectId(admin)
    if (!projectId) return { ok: false, message: '履歴書メーカーは現在利用できません' }
    const photoCardId = data.photo?.type === 'card' ? data.photo.cardId : null
    const result = await admin.rpc('upsert_resume_maker_submission', {
      p_project_id: projectId,
      p_user_id: user.id,
      p_resume_data: data,
      p_photo_card_id: photoCardId,
      p_is_public: input.isPublic,
    })
    if (result.error || !result.data) return { ok: false, message: '保存に失敗しました' }
    revalidatePath('/mypage')
    return { ok: true, message: '履歴書を保存しました', submissionId: String(result.data) }
  } catch (error) {
    console.error('saveResumeSubmission failed', { message: error instanceof Error ? error.message : String(error) })
    return { ok: false, message: '保存に失敗しました' }
  }
}

export async function setResumeVisibility(isPublic: boolean) {
  try {
    const user = await requireUser()
    if (!user) return { ok: false, message: 'ログインが必要です' }
    const admin = createAdminClient()
    const projectId = await getResumeProjectId(admin)
    if (!projectId) return { ok: false, message: '履歴書メーカーは現在利用できません' }
    const result = await admin.rpc('set_resume_maker_visibility', { p_project_id: projectId, p_user_id: user.id, p_is_public: isPublic })
    if (result.error) return { ok: false, message: '公開設定の変更に失敗しました' }
    revalidatePath('/mypage')
    return { ok: true, message: isPublic ? '公開しました' : '非公開にしました' }
  } catch (error) {
    console.error('setResumeVisibility failed', { message: error instanceof Error ? error.message : String(error) })
    return { ok: false, message: '公開設定の変更に失敗しました' }
  }
}
