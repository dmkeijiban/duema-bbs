'use server'

import { createPublicClient } from '@/lib/supabase-public'
import { revalidatePath } from 'next/cache'

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
  const displayName = (formData.get('display_name') as string | null)?.trim() || '名無しさん'
  const body = (formData.get('body') as string | null)?.trim() ?? ''

  if (body.length < 2) {
    return { status: 'error', message: '本文を2文字以上入力してください' }
  }
  if (body.length > 500) {
    return { status: 'error', message: '本文は500文字以内にしてください' }
  }
  if (displayName.length > 50) {
    return { status: 'error', message: '名前は50文字以内にしてください' }
  }

  const supabase = createPublicClient()
  const { error } = await supabase.from('zukan_card_reviews').insert({
    card_id: cardId,
    display_name: displayName,
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
    score_trauma:     parseScore('score_trauma'),
    score_still_like: parseScore('score_still_like'),
    score_name:       parseScore('score_name'),
    score_art:        parseScore('score_art'),
  }

  const hasAny = Object.values(scores).some(v => v !== null)
  if (!hasAny) {
    return { status: 'error', message: '少なくとも1項目は評価してください' }
  }

  const supabase = createPublicClient()
  const { error } = await supabase.from('zukan_card_ratings').insert({
    card_id: cardId,
    ...scores,
  })

  if (error) {
    return { status: 'error', message: '評価の送信に失敗しました。しばらくしてから再試行してください。' }
  }

  revalidatePath(`/zukan/card/${slug}`)
  return { status: 'success' }
}
