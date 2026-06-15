'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

import { createAdminClient } from '@/lib/supabase-admin'
import { getZukanDailyPostIssue, getZukanPosterContext, hasRecentZukanPost } from '@/lib/zukan-server'
import { verifyAdminCookie, ADMIN_COOKIE } from '@/lib/admin-auth'

async function requireAdmin(): Promise<boolean> {
  return verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)
}

export type CardReviewFormState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string }

export async function submitCardReview(
  cardId: string,
  slug: string,
  _prev: CardReviewFormState,
  formData: FormData,
): Promise<CardReviewFormState> {
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
  if (await hasRecentZukanPost('zukan_card_reviews', 'card_id', cardId, poster)) {
    return { status: 'error', message: '短時間に連続して投稿されています。少し待ってから投稿してください。' }
  }

  const dailyIssue = await getZukanDailyPostIssue('zukan_card_reviews', 'card_id', cardId, poster, body)
  if (dailyIssue === 'duplicate') {
    return { status: 'error', message: '同じ内容のレビューをすでに投稿しています。' }
  }
  if (dailyIssue === 'limit') {
    return { status: 'error', message: '本日の投稿上限（3件）に達しました。明日また投稿してください。' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('zukan_card_reviews').insert({
    card_id: cardId,
    user_id: poster.userId,
    anon_key: poster.anonKey,
    display_name: poster.displayName,
    body,
  })

  if (error) {
    return { status: 'error', message: '投稿に失敗しました。しばらくしてから再試行してください。' }
  }

  revalidatePath(`/zukan/card/${slug}`)
  return { status: 'success' }
}

export type CardRatingFormState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string }

export async function submitCardRating(
  cardId: string,
  slug: string,
  _prev: CardRatingFormState,
  formData: FormData,
): Promise<CardRatingFormState> {
  const parseScore = (key: string): number | null => {
    const v = formData.get(key)
    if (!v) return null
    const n = parseInt(v as string, 10)
    return n >= 1 && n <= 5 ? n : null
  }

  const scores = {
    score_admiration: parseScore('score_admiration'),
    score_trauma: parseScore('score_trauma'),
    score_still_like: parseScore('score_still_like'),
    score_name: parseScore('score_name'),
    score_art: parseScore('score_art'),
  }

  const hasAny = Object.values(scores).some(v => v !== null)
  if (!hasAny) {
    return { status: 'error', message: '少なくとも1項目は評価してください' }
  }

  const poster = await getZukanPosterContext(null)
  if (poster.blockedMessage) {
    return { status: 'error', message: poster.blockedMessage }
  }

  const supabase = createAdminClient()
  let existingQuery = supabase
    .from('zukan_card_ratings')
    .select('id, score_admiration, score_trauma, score_still_like, score_name, score_art')
    .eq('card_id', cardId)
    .eq('is_deleted', false)
    .limit(1)

  if (poster.userId) {
    existingQuery = existingQuery.eq('user_id', poster.userId)
  } else {
    existingQuery = existingQuery.eq('anon_key', poster.anonKey).is('user_id', null)
  }

  const { data: existingRows, error: selectError } = await existingQuery
  if (selectError) {
    return { status: 'error', message: '評価の確認に失敗しました。しばらくしてから再試行してください。' }
  }

  const existing = existingRows?.[0]
  const payload = {
    ...scores,
    user_id: poster.userId,
    anon_key: poster.anonKey,
    display_name: poster.displayName,
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from('zukan_card_ratings')
      .update(scores)
      .eq('id', existing.id)
    if (updateError) {
      return { status: 'error', message: '評価の更新に失敗しました。しばらくしてから再試行してください。' }
    }
    revalidatePath(`/zukan/card/${slug}`)
    return { status: 'success' }
  }

  const { error } = await supabase.from('zukan_card_ratings').insert({
    card_id: cardId,
    ...payload,
  })

  if (error) {
    return { status: 'error', message: '評価の送信に失敗しました。しばらくしてから再試行してください。' }
  }

  revalidatePath(`/zukan/card/${slug}`)
  return { status: 'success' }
}

export async function adminHideReview(reviewId: number, slug: string): Promise<void> {
  if (!await requireAdmin()) throw new Error('Unauthorized')
  const supabase = createAdminClient()
  await supabase.from('zukan_card_reviews').update({ is_hidden: true }).eq('id', reviewId)
  revalidatePath(`/zukan/card/${slug}`)
}

export async function adminUnhideReview(reviewId: number, slug: string): Promise<void> {
  if (!await requireAdmin()) throw new Error('Unauthorized')
  const supabase = createAdminClient()
  await supabase.from('zukan_card_reviews').update({ is_hidden: false }).eq('id', reviewId)
  revalidatePath(`/zukan/card/${slug}`)
}

export async function adminEditReview(reviewId: number, slug: string, newBody: string): Promise<void> {
  if (!await requireAdmin()) throw new Error('Unauthorized')
  const trimmed = newBody.trim()
  if (trimmed.length < 3 || trimmed.length > 1000) throw new Error('Invalid body length')
  const supabase = createAdminClient()
  await supabase.from('zukan_card_reviews').update({ body: trimmed }).eq('id', reviewId)
  revalidatePath(`/zukan/card/${slug}`)
}
