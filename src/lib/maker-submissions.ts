import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase-admin'
import { makerCommunityLabel, parseMakerProjectConfig } from '@/lib/maker'

export type PublicMakerProject = { id: string; slug: string; title: string; type: string; config: unknown }
export type PublicSubmission = {
  id: string; title: string; comment: string | null; thumbnail_url: string | null; created_at: string
  user_id: string | null; authorName: string; items: { card_id: string; group_key: string; position: number; card: { name: string; image_url: string | null; regulation: string | null } }[]
}

export const getPublicMakerProject = cache(async (slug: string) => {
  const admin = createAdminClient()
  const { data } = await admin.from('maker_projects').select('id,slug,title,type,config').eq('slug', slug).eq('is_public', true).eq('status', 'published').maybeSingle()
  return data as PublicMakerProject | null
})

function visibleProfile(profile: Record<string, unknown> | null) {
  return profile && profile.account_suspended !== true && profile.profile_hidden !== true && !profile.withdrawn_at
}

async function hydrate(projectId: string, submissionRows: Record<string, unknown>[]): Promise<PublicSubmission[]> {
  if (!submissionRows.length) return []
  const admin = createAdminClient()
  const ids = submissionRows.map(row => String(row.id))
  const userIds = [...new Set(submissionRows.map(row => row.user_id).filter((id): id is string => typeof id === 'string'))]
  const [{ data: items }, { data: profiles }] = await Promise.all([
    admin.from('maker_submission_items').select('submission_id,card_id,group_key,position,cards(name,image_url,regulation)').in('submission_id', ids).order('position'),
    userIds.length ? admin.from('profiles').select('id,display_name,profile_hidden,account_suspended,withdrawn_at').in('id', userIds) : Promise.resolve({ data: [] }),
  ])
  const profilesById = new Map((profiles ?? []).map(profile => [profile.id, profile as Record<string, unknown>]))
  const itemsBySubmission = new Map<string, PublicSubmission['items']>()
  for (const item of items ?? []) {
    const cardValue = item.cards as unknown
    const card = (Array.isArray(cardValue) ? cardValue[0] : cardValue) as { name: string; image_url: string | null; regulation: string | null } | null
    if (!card) continue
    const list = itemsBySubmission.get(item.submission_id) ?? []
    list.push({ card_id: item.card_id, group_key: item.group_key, position: item.position, card })
    itemsBySubmission.set(item.submission_id, list)
  }
  return submissionRows.flatMap(row => {
    const userId = typeof row.user_id === 'string' ? row.user_id : null
    const profile = userId ? profilesById.get(userId) ?? null : null
    if (userId && !visibleProfile(profile)) return []
    return [{ ...row, user_id: userId, authorName: userId ? String(profile?.display_name || 'デュエマプレイヤー') : '名無しのデュエリスト', items: itemsBySubmission.get(String(row.id)) ?? [] } as PublicSubmission]
  })
}

export async function getPublicSubmissions(projectId: string, page = 1, pageSize = 30) {
  const admin = createAdminClient()
  const from = (Math.max(1, page) - 1) * pageSize
  const { data, count } = await admin.from('maker_submissions').select('id,user_id,title,comment,thumbnail_url,created_at', { count: 'exact' }).eq('project_id', projectId).eq('is_valid', true).eq('is_public', true).order('created_at', { ascending: false }).range(from, from + pageSize - 1)
  return { submissions: await hydrate(projectId, (data ?? []) as Record<string, unknown>[]), total: count ?? 0 }
}

export async function getPublicSubmission(projectId: string, id: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('maker_submissions').select('id,user_id,title,comment,thumbnail_url,created_at').eq('id', id).eq('project_id', projectId).eq('is_valid', true).eq('is_public', true).maybeSingle()
  if (!data) return null
  return (await hydrate(projectId, [data as Record<string, unknown>]))[0] ?? null
}

export function makerSubmissionView(project: PublicMakerProject) {
  return { config: parseMakerProjectConfig(project.config), communityLabel: makerCommunityLabel(project.type) }
}
