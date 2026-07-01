import { unstable_cache } from 'next/cache'
import { createAdminClient } from './supabase-admin'

export const PUBLIC_HIDDEN_USERS_TAG = 'public-hidden-users'

export const getCachedPublicHiddenUserIds = unstable_cache(
  async (): Promise<string[]> => {
    try {
      const admin = createAdminClient()
      const { data, error } = await admin
        .from('profiles')
        .select('id')
        .or('account_suspended.eq.true,withdrawn_at.not.is.null')
        .limit(10000)

      if (error) {
        console.warn('public hidden users fetch failed:', error.message)
        return []
      }

      return (data ?? [])
        .map(row => String(row.id ?? '').trim())
        .filter(Boolean)
    } catch (error) {
      console.warn('public hidden users fetch failed:', error)
      return []
    }
  },
  ['public-hidden-users'],
  { revalidate: 3600, tags: [PUBLIC_HIDDEN_USERS_TAG, 'profiles'] }
)

export function isPublicVisibleUserContent(
  row: { user_id?: string | null },
  hiddenUserIds: readonly string[]
): boolean {
  return !row.user_id || !hiddenUserIds.includes(row.user_id)
}

export function filterPublicVisibleUserContent<T extends { user_id?: string | null }>(
  rows: readonly T[] | null | undefined,
  hiddenUserIds: readonly string[]
): T[] {
  if (!rows || rows.length === 0) return []
  if (hiddenUserIds.length === 0) return [...rows]
  return rows.filter(row => isPublicVisibleUserContent(row, hiddenUserIds))
}

export function getPublicVisibleUserContentOrFilter(hiddenUserIds: readonly string[]): string | null {
  if (hiddenUserIds.length === 0) return null
  return `user_id.is.null,user_id.not.in.(${hiddenUserIds.join(',')})`
}
