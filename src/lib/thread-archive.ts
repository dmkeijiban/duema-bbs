import { getThreadArchiveCutoff } from '@/lib/thread-auto-close'

function cutoffIso(now = new Date()) {
  return getThreadArchiveCutoff(now).toISOString()
}

function activeByLastResponseFilter(now = new Date()) {
  const cutoff = cutoffIso(now)
  return `last_posted_at.gt.${cutoff},and(last_posted_at.is.null,created_at.gt.${cutoff})`
}

function staleByLastResponseFilter(now = new Date()) {
  const cutoff = cutoffIso(now)
  return `last_posted_at.lte.${cutoff},and(last_posted_at.is.null,created_at.lte.${cutoff})`
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
    .or(`auto_lock_exempt.eq.true,${activeByLastResponseFilter(now)}`) as T
}

export function applyKakologThreadFilter<T>(query: T, now = new Date()): T {
  const q = query as unknown as {
    eq: (column: string, value: unknown) => {
      is: (column: string, value: null) => {
        eq: (column: string, value: unknown) => {
          or: (filters: string) => unknown
        }
      }
    }
  }
  return q
    .eq('is_archived', false)
    .is('archived_at', null)
    .eq('auto_lock_exempt', false)
    .or(staleByLastResponseFilter(now)) as T
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
      lte: (column: string, value: string) => unknown
    }
  }
  return q.eq('is_archived', false).lte('created_at', cutoffIso()) as T
}

export function applyThreadArchiveBaseRange<T>(
  query: T,
  startIso?: string,
  endIso?: string,
): T {
  if (!startIso && !endIso) return query
  const q = query as unknown as {
    or: (filters: string) => unknown
  }

  const lastPostedFilters = [
    startIso ? `last_posted_at.gte.${startIso}` : '',
    endIso ? `last_posted_at.lt.${endIso}` : '',
  ].filter(Boolean)
  const createdAtFilters = [
    'last_posted_at.is.null',
    startIso ? `created_at.gte.${startIso}` : '',
    endIso ? `created_at.lt.${endIso}` : '',
  ].filter(Boolean)

  return q.or(`and(${lastPostedFilters.join(',')}),and(${createdAtFilters.join(',')})`) as T
}

export function getThreadArchiveBaseAt(thread: {
  last_posted_at?: string | null
  created_at?: string | null
}) {
  return thread.last_posted_at ?? thread.created_at ?? null
}

export function isArchiveSchemaMissing(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  return error.code === '42703' ||
    Boolean(error.message?.includes('auto_lock_exempt')) ||
    Boolean(error.message?.includes('archived_at'))
}
