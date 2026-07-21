import 'server-only'

import { createAdminClient } from '@/lib/supabase-admin'
import { resolveSelectPrintingImages, selectPrintingRefKey } from '@/lib/maker-select-printing'
import { RESUME_MAKER_SLUG, sanitizeResumeData, type ResumeData } from '@/lib/maker-resume'

export type ResumeSubmissionRecord = { id: string; data: ResumeData; isPublic: boolean }

let cachedProjectId: string | null | undefined

async function getResumeProjectId(): Promise<string | null> {
  if (cachedProjectId !== undefined) return cachedProjectId
  const admin = createAdminClient()
  const { data } = await admin.from('maker_projects').select('id').eq('slug', RESUME_MAKER_SLUG).eq('type', 'resume').eq('is_public', true).eq('status', 'published').maybeSingle()
  const resolved: string | null = data?.id ?? null
  cachedProjectId = resolved
  return resolved
}

async function resolvePhotoImage(data: ResumeData): Promise<ResumeData> {
  if (data.photo?.type !== 'card') return data
  const ref = { cardId: data.photo.cardId, sourceKey: data.photo.sourceKey, faceSideIndex: data.photo.faceSideIndex }
  const resolved = (await resolveSelectPrintingImages([ref])).get(selectPrintingRefKey(ref))
  if (!resolved?.imageUrl) return data
  return { ...data, photo: { ...data.photo, imageUrl: resolved.imageUrl } }
}

/** ユーザー本人の履歴書投稿を、公開・非公開を問わず取得する（マイページ・所有者本人の投稿者ページ表示用）。 */
export async function getOwnResumeSubmission(userId: string): Promise<ResumeSubmissionRecord | null> {
  const projectId = await getResumeProjectId()
  if (!projectId) return null
  const admin = createAdminClient()
  const { data } = await admin.from('maker_submissions').select('id, resume_data, is_public').eq('project_id', projectId).eq('user_id', userId).eq('is_overwrite_slot', true).eq('is_valid', true).maybeSingle()
  if (!data?.resume_data) return null
  return { id: data.id, data: await resolvePhotoImage(sanitizeResumeData(data.resume_data)), isPublic: data.is_public }
}

/** 公開設定の履歴書のみを取得する（第三者からの投稿者ページ表示用）。 */
export async function getPublicResumeSubmission(userId: string): Promise<ResumeSubmissionRecord | null> {
  const record = await getOwnResumeSubmission(userId)
  return record?.isPublic ? record : null
}
