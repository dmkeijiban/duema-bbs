'use server'

import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { checkModerationBan, checkPostingBan, hashModerationValue } from '@/lib/moderation'
import { headers } from 'next/headers'
import { toResultOptions, type ThreadPollViewerState } from '@/lib/thread-poll'

async function getOrCreatePollSessionId() {
  const cookieStore = await cookies()
  const existing = cookieStore.get('bbs_session')?.value
  if (existing) return existing

  const sessionId = uuidv4()
  cookieStore.set('bbs_session', sessionId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: 'lax',
  })
  return sessionId
}

async function getPollUserId() {
  const cookieStore = await cookies()
  const hasAuthCookie = cookieStore.getAll().some(cookie =>
    cookie.name.startsWith('sb-') && cookie.name.includes('auth-token') && cookie.value.length > 0
  )
  if (!hasAuthCookie) return null

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user.id
}

async function getPollIpHash() {
  const headerStore = await headers()
  const forwardedFor = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = headerStore.get('x-real-ip')?.trim()
  const candidate = forwardedFor || realIp
  return candidate ? hashModerationValue(candidate) : null
}

type ExistingVote = {
  id: number
  option_id: number
}

async function findVote(threadId: number, sessionId: string, userId: string | null) {
  const admin = createAdminClient()
  const bySession = await admin
    .from('thread_poll_votes')
    .select('id, option_id')
    .eq('thread_id', threadId)
    .eq('session_id', sessionId)
    .maybeSingle()
  if (bySession.data) return bySession.data as ExistingVote

  if (!userId) return null
  const byUser = await admin
    .from('thread_poll_votes')
    .select('id, option_id')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .maybeSingle()
  return byUser.data as ExistingVote | null
}

async function buildViewerState(
  threadId: number,
  sessionId: string,
  userId: string | null,
): Promise<ThreadPollViewerState> {
  const admin = createAdminClient()
  const [vote, optionsResult, votesResult] = await Promise.all([
    findVote(threadId, sessionId, userId),
    admin
      .from('thread_poll_options')
      .select('id, label, image_url, sort_order, vote_count, is_correct')
      .eq('thread_id', threadId)
      .order('sort_order', { ascending: true }),
    admin
      .from('thread_poll_votes')
      .select('option_id')
      .eq('thread_id', threadId),
  ])

  const options = optionsResult.data
  if (optionsResult.error || !options) {
    return {
      hasVoted: Boolean(vote),
      selectedOptionId: vote?.option_id ?? null,
      totalVotes: votesResult.data?.length ?? 0,
      options: null,
    }
  }

  const voteCounts = new Map<number, number>()
  for (const row of votesResult.data ?? []) {
    voteCounts.set(row.option_id, (voteCounts.get(row.option_id) ?? 0) + 1)
  }

  const resultOptions = toResultOptions(options.map(option => ({
    ...option,
    vote_count: voteCounts.get(option.id) ?? 0,
    is_correct: vote ? option.is_correct : false,
  })))

  return {
    hasVoted: Boolean(vote),
    selectedOptionId: vote?.option_id ?? null,
    totalVotes: votesResult.data?.length ?? 0,
    options: resultOptions,
  }
}

export async function getThreadPollViewerState(threadId: number) {
  if (!Number.isInteger(threadId) || threadId <= 0) {
    return { error: '投票が見つかりません' }
  }

  try {
    const sessionId = await getOrCreatePollSessionId()
    const userId = await getPollUserId()
    return { state: await buildViewerState(threadId, sessionId, userId) }
  } catch (error) {
    console.warn('poll viewer state failed:', error)
    return { error: '投票状況を取得できませんでした' }
  }
}

export async function voteThreadPoll(threadId: number, optionId: number) {
  if (!Number.isInteger(threadId) || threadId <= 0 || !Number.isInteger(optionId) || optionId <= 0) {
    return { error: '選択肢が無効です' }
  }

  try {
    const sessionId = await getOrCreatePollSessionId()
    const [userId, ipHash] = await Promise.all([getPollUserId(), getPollIpHash()])
    const admin = createAdminClient()

    const [postingBanned, ipBanned, existingVote, optionResult, threadResult, pollResult] = await Promise.all([
      checkPostingBan({ sessionId, userId }),
      checkModerationBan(admin, 'ip_hash', ipHash),
      findVote(threadId, sessionId, userId),
      admin
        .from('thread_poll_options')
        .select('id')
        .eq('id', optionId)
        .eq('thread_id', threadId)
        .maybeSingle(),
      admin
        .from('threads')
        .select('is_archived, archived_at')
        .eq('id', threadId)
        .maybeSingle(),
      admin
        .from('thread_polls')
        .select('kind')
        .eq('thread_id', threadId)
        .maybeSingle(),
    ])

    if (postingBanned || ipBanned) return { error: 'この環境からの投票は制限されています' }
    if (!optionResult.data) return { error: '選択肢が見つかりません' }
    if (!threadResult.data || threadResult.data.is_archived || threadResult.data.archived_at) {
      return { error: 'このスレッドの投票は終了しました' }
    }

    if (existingVote) {
      if (pollResult.data?.kind === 'quiz' && existingVote.option_id !== optionId) {
        return { error: 'クイズの回答は変更できません' }
      }

      if (existingVote.option_id === optionId) {
        return { state: await buildViewerState(threadId, sessionId, userId) }
      }

      const { error } = await admin
        .from('thread_poll_votes')
        .update({ option_id: optionId })
        .eq('id', existingVote.id)
        .eq('thread_id', threadId)

      if (error) {
        console.error('poll vote update failed:', error)
        return { error: '投票の変更に失敗しました' }
      }

      return { state: await buildViewerState(threadId, sessionId, userId) }
    }

    if (ipHash) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      const { count } = await admin
        .from('thread_poll_votes')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash)
        .gte('created_at', tenMinutesAgo)
      if ((count ?? 0) >= 30) return { error: '短時間の投票回数が多すぎます。しばらく待ってください' }
    }

    const { error } = await admin.from('thread_poll_votes').insert({
      thread_id: threadId,
      option_id: optionId,
      session_id: sessionId,
      user_id: userId,
      ip_hash: ipHash,
    })

    if (error && error.code !== '23505') {
      console.error('poll vote failed:', error)
      return { error: '投票に失敗しました' }
    }

    return { state: await buildViewerState(threadId, sessionId, userId) }
  } catch (error) {
    console.error('poll vote failed:', error)
    return { error: '投票に失敗しました' }
  }
}
