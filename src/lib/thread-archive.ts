import { getThreadArchiveCutoff } from '@/lib/thread-auto-close'

function cutoffIso(now = new Date()) {
  return getThreadArchiveCutoff(now).toISOString()
}

export function applyActiveThreadFilter<T>(query: T, now = new Date()): T {
  const q = query as unknown as {
    eq: (column: string, value: unknown) => {
      is: (column: string, value: null) => {
        or: (filters: string) => unknown
      }
    }
  }
  return q
    .eq('is_archived', false)
    .is('archived_at', null)
    .or(`auto_lock_exempt.eq.true,created_at.gte.${cutoffIso(now)}`) as T
}

export function applyKakologThreadFilter<T>(query: T, now = new Date()): T {
  const q = query as unknown as {
    eq: (column: string, value: unknown) => {
      is: (column: string, value: null) => {
        eq: (column: string, value: unknown) => {
          lt: (column: string, value: string) => unknown
        }
      }
    }
  }
  return q
    .eq('is_archived', false)
    .is('archived_at', null)
    .eq('auto_lock_exempt', false)
    .lt('created_at', cutoffIso(now)) as T
}

export function applyLegacyActiveThreadFilter<T>(query: T): T {
  const q = query as unknown as {
    eq: (column: string, value: unknown) => unknown
  }
  return q.eq('is_archived', false) as T
}

export function applyLegacyKakologThreadFilter<T>(query: T): T {
  const q = query as unknown as {
    eq: (column: string, value: unknown) => {
      lt: (column: string, value: string) => unknown
    }
  }
  return q.eq('is_archived', false).lt('created_at', cutoffIso()) as T
}

export function isArchiveSchemaMissing(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  return error.code === '42703' ||
    Boolean(error.message?.includes('auto_lock_exempt')) ||
    Boolean(error.message?.includes('archived_at'))
}
