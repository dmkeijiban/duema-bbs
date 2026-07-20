import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'

// 投票・クイズの新規作成を一時的に非公開にするスイッチ。
// 再公開するときは true に戻すだけで、既存データ・表示機能には影響しない。
const THREAD_POLL_CREATION_ENABLED = false

export type ThreadPollKind = 'poll' | 'quiz'

export type ThreadPollOption = {
  id: number
  label: string
  imageUrl: string | null
  sortOrder: number
}

export type ThreadPoll = {
  kind: ThreadPollKind
  options: ThreadPollOption[]
}

export type ThreadPollResultOption = ThreadPollOption & {
  voteCount: number
  isCorrect: boolean
}

export type ThreadPollViewerState = {
  hasVoted: boolean
  selectedOptionId: number | null
  totalVotes: number
  options: ThreadPollResultOption[] | null
}

type PollRow = {
  kind: ThreadPollKind
}

type PollOptionRow = {
  id: number
  label: string
  image_url: string | null
  sort_order: number
  vote_count?: number | null
  is_correct?: boolean | null
}

function isMissingPollSchema(error: { code?: string; message?: string } | null) {
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    Boolean(error?.message?.includes('thread_poll'))
  )
}

function toOption(row: PollOptionRow): ThreadPollOption {
  return {
    id: row.id,
    label: row.label,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
  }
}

export function getCachedThreadPoll(threadId: number): Promise<ThreadPoll | null> {
  return unstable_cache(
    async () => {
      try {
        const admin = createAdminClient()
        const [{ data: poll, error: pollError }, { data: options, error: optionsError }] = await Promise.all([
          admin.from('thread_polls').select('kind').eq('thread_id', threadId).maybeSingle(),
          admin
            .from('thread_poll_options')
            .select('id, label, image_url, sort_order')
            .eq('thread_id', threadId)
            .order('sort_order', { ascending: true }),
        ])

        if (pollError || optionsError) {
          if (isMissingPollSchema(pollError) || isMissingPollSchema(optionsError)) return null
          console.warn('thread poll fetch failed:', pollError?.message ?? optionsError?.message)
          return null
        }
        if (!poll || !options || options.length < 2) return null

        return {
          kind: (poll as PollRow).kind,
          options: (options as PollOptionRow[]).map(toOption),
        }
      } catch (error) {
        console.warn('thread poll fetch failed:', error)
        return null
      }
    },
    [`thread-poll-${threadId}`],
    { revalidate: 21600, tags: [`thread-poll-${threadId}`, `thread-${threadId}`] },
  )()
}

export function getThreadPollFeatureAvailable(): Promise<boolean> {
  if (!THREAD_POLL_CREATION_ENABLED) return Promise.resolve(false)

  return unstable_cache(
    async () => {
      try {
        const admin = createAdminClient()
        const { error } = await admin
          .from('thread_polls')
          .select('thread_id', { head: true })
          .limit(1)
        return !error
      } catch {
        return false
      }
    },
    ['thread-poll-feature-available'],
    { revalidate: 60, tags: ['thread-poll-feature'] },
  )()
}

export function toResultOptions(rows: PollOptionRow[]): ThreadPollResultOption[] {
  return rows.map(row => ({
    ...toOption(row),
    voteCount: row.vote_count ?? 0,
    isCorrect: row.is_correct === true,
  }))
}
