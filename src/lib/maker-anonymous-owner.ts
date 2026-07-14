import 'server-only'

import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'

export const MAKER_ANONYMOUS_COOKIE = 'maker_anonymous_id'

export function hashMakerAnonymousOwner(value: string, purpose: 'actor' | 'edit') {
  const pepper = process.env.ADMIN_COOKIE_SECRET || process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!pepper) throw new Error('匿名登録のサーバー設定が不足しています')
  return createHash('sha256').update(`${pepper}:${purpose}:${value}`).digest('hex')
}

export async function getMakerAnonymousEditHash(): Promise<string | null> {
  const value = (await cookies()).get(MAKER_ANONYMOUS_COOKIE)?.value
  if (!value || !/^[A-Za-z0-9_-]{40,100}$/.test(value)) return null
  return hashMakerAnonymousOwner(value, 'edit')
}

export async function getOwnedMakerSubmissionIds(
  projectId: string,
  submissionIds: string[],
  userId: string | null,
): Promise<Set<string>> {
  if (submissionIds.length === 0) return new Set()
  const editHash = await getMakerAnonymousEditHash()
  if (!userId && !editHash) return new Set()

  const admin = createAdminClient()
  const { data } = await admin
    .from('maker_submissions')
    .select('id,user_id,anonymous_edit_token_hash')
    .eq('project_id', projectId)
    .in('id', submissionIds)
    .eq('is_valid', true)
    .eq('is_public', true)

  return new Set((data ?? []).filter(row => (
    (row.user_id !== null && row.user_id === userId)
    || (row.user_id === null && editHash !== null && row.anonymous_edit_token_hash === editHash)
  )).map(row => row.id))
}
