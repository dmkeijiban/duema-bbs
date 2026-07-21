import 'server-only'

import { createAdminClient } from '@/lib/supabase-admin'
import { resolveSelectPrintingImages, selectPrintingRefKey } from '@/lib/maker-select-printing'
import { RESUME_MAKER_SLUG, sanitizeResumeData, type ResumeData } from '@/lib/maker-resume'

export type ResumeSubmissionRecord = { id: string; data: ResumeData; isPublic: boolean; updatedAt: string }
export type PublicResumeSubmission = { id: string; userId: string; profileSlug: string; displayName: string; avatarUrl: string | null; data: ResumeData; updatedAt: string }
export type ResumeListingSort = 'new' | 'updated'

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
  const { data } = await admin.from('maker_submissions').select('id, resume_data, is_public, updated_at').eq('project_id', projectId).eq('user_id', userId).eq('is_overwrite_slot', true).eq('is_valid', true).maybeSingle()
  if (!data?.resume_data) return null
  return { id: data.id, data: await resolvePhotoImage(sanitizeResumeData(data.resume_data)), isPublic: data.is_public, updatedAt: data.updated_at }
}

/** 公開設定の履歴書のみを取得する（第三者からの投稿者ページ表示用）。 */
export async function getPublicResumeSubmission(userId: string): Promise<ResumeSubmissionRecord | null> {
  const record = await getOwnResumeSubmission(userId)
  return record?.isPublic ? record : null
}

function visibleResumeProfile(profile: Record<string, unknown> | null) {
  return profile && profile.account_suspended !== true && profile.profile_hidden !== true && !profile.withdrawn_at && profile.profile_slug && profile.display_name
}

/**
 * 「みんなの履歴書」一覧向けに、公開設定かつ有効なユーザーの履歴書のみをページネーションして取得する。
 * BAN/凍結/退会/非公開プロフィールのユーザーはアプリ層（visibleResumeProfile）で除外する
 * （maker-submissions.tsのgetPublicSubmissions/visibleProfileと同じ方針）。
 */
export async function getPublicResumeSubmissions(page = 1, pageSize = 24, sort: ResumeListingSort = 'new'): Promise<{ submissions: PublicResumeSubmission[]; total: number }> {
  const projectId = await getResumeProjectId()
  if (!projectId) return { submissions: [], total: 0 }
  const admin = createAdminClient()
  const from = (Math.max(1, page) - 1) * pageSize
  const orderColumn = sort === 'updated' ? 'updated_at' : 'created_at'
  const { data, count } = await admin
    .from('maker_submissions')
    .select('id, user_id, resume_data, updated_at', { count: 'exact' })
    .eq('project_id', projectId)
    .eq('is_valid', true)
    .eq('is_public', true)
    .eq('is_overwrite_slot', true)
    .order(orderColumn, { ascending: false })
    .range(from, from + pageSize - 1)
  const rows = (data ?? []) as { id: string; user_id: string; resume_data: unknown; updated_at: string }[]
  if (!rows.length) return { submissions: [], total: count ?? 0 }

  const userIds = [...new Set(rows.map(row => row.user_id))]
  const { data: profiles } = await admin.from('profiles').select('id, display_name, profile_slug, avatar_url, profile_hidden, account_suspended, withdrawn_at').in('id', userIds)
  const profileById = new Map((profiles ?? []).map(profile => [profile.id, profile as Record<string, unknown>]))

  const sanitizedRows = rows.map(row => ({ ...row, data: sanitizeResumeData(row.resume_data) }))
  const photoRefs = sanitizedRows.flatMap(row => {
    const photo = row.data.photo
    return photo?.type === 'card' ? [{ cardId: photo.cardId, sourceKey: photo.sourceKey, faceSideIndex: photo.faceSideIndex }] : []
  })
  const resolvedPhotos = photoRefs.length ? await resolveSelectPrintingImages(photoRefs) : new Map()

  const submissions = sanitizedRows.flatMap((row): PublicResumeSubmission[] => {
    const profile = profileById.get(row.user_id) ?? null
    if (!visibleResumeProfile(profile)) return []
    let resumeData = row.data
    if (resumeData.photo?.type === 'card') {
      const key = selectPrintingRefKey({ cardId: resumeData.photo.cardId, sourceKey: resumeData.photo.sourceKey, faceSideIndex: resumeData.photo.faceSideIndex })
      const resolved = resolvedPhotos.get(key)
      if (resolved?.imageUrl) resumeData = { ...resumeData, photo: { ...resumeData.photo, imageUrl: resolved.imageUrl } }
    }
    return [{
      id: row.id,
      userId: row.user_id,
      profileSlug: String(profile!.profile_slug),
      displayName: String(profile!.display_name),
      avatarUrl: (profile!.avatar_url as string | null) ?? null,
      data: resumeData,
      updatedAt: row.updated_at,
    }]
  })

  return { submissions, total: count ?? 0 }
}
