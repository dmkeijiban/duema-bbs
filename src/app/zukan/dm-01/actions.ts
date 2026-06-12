'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase-admin'
import { getZukanDailyPostIssue, getZukanPosterContext, hasRecentZukanPost } from '@/lib/zukan-server'

export type PackReviewFormState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string }

export async function submitPackReview(
  packId: string,
  _prev: PackReviewFormState,
  formData: FormData,
): Promise<PackReviewFormState> {
  const rawDisplayName = (formData.get('display_name') as string | null)?.trim() || null
  const body = (formData.get('body') as string | null)?.trim() ?? ''

  if (body.length < 3) {
    return { status: 'error', message: '本文を3文字以上入力してください' }
  }
  if (body.length > 1000) {
    return { status: 'error', message: '本文は1000文字以内にしてください' }
  }

  const poster = await getZukanPosterContext(rawDisplayName)
  if (poster.blockedMessage) {
    return { status: 'error', message: poster.blockedMessage }
  }
  if (await hasRecentZukanPost('zukan_pack_reviews', 'pack_id', packId, poster)) {
    return { status: 'error', message: '短時間に連続して投稿されています。少し待ってから投稿してください。' }
  }
  const dailyIssue = await getZukanDailyPostIssue('zukan_pack_reviews', 'pack_id', packId, poster, body)
  if (dailyIssue === 'limit') {
    return { status: 'error', message: '同じパックへの思い出投稿は1日3件までです。明日また投稿してください。' }
  }
  if (dailyIssue === 'duplicate') {
    return { status: 'error', message: '同じ内容の思い出は今日はすでに投稿済みです。' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('zukan_pack_reviews').insert({
    pack_id: packId,
    user_id: poster.userId,
    anon_key: poster.anonKey,
    display_name: poster.displayName,
    body,
  })

  if (error) {
    return { status: 'error', message: '投稿に失敗しました。しばらくしてから再試行してください。' }
  }

  revalidatePath('/zukan/dm-01')
  return { status: 'success' }
}
