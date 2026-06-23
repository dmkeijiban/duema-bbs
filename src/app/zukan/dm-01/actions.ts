'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

import { createAdminClient } from '@/lib/supabase-admin'
import { getZukanDailyPostIssue, getZukanPosterContext } from '@/lib/zukan-server'
import { verifyAdminCookie, ADMIN_COOKIE } from '@/lib/admin-auth'

async function requireAdmin(): Promise<boolean> {
  return verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)
}

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
  const dailyIssue = await getZukanDailyPostIssue('zukan_pack_reviews', 'pack_id', packId, poster, body)
  if (dailyIssue === 'duplicate') {
    return { status: 'error', message: '同じ内容のレビューをすでに投稿しています。' }
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

export async function adminHidePackReview(reviewId: number, packId: string): Promise<void> {
  if (!await requireAdmin()) throw new Error('Unauthorized')
  const supabase = createAdminClient()
  await supabase.from('zukan_pack_reviews').update({ is_hidden: true }).eq('id', reviewId)
  revalidatePath('/zukan/dm-01')
}

export async function adminUnhidePackReview(reviewId: number, packId: string): Promise<void> {
  if (!await requireAdmin()) throw new Error('Unauthorized')
  const supabase = createAdminClient()
  await supabase.from('zukan_pack_reviews').update({ is_hidden: false }).eq('id', reviewId)
  revalidatePath('/zukan/dm-01')
}

export async function adminEditPackReview(reviewId: number, packId: string, newBody: string): Promise<void> {
  if (!await requireAdmin()) throw new Error('Unauthorized')
  const trimmed = newBody.trim()
  if (trimmed.length < 3 || trimmed.length > 1000) throw new Error('Invalid body length')
  const supabase = createAdminClient()
  await supabase.from('zukan_pack_reviews').update({ body: trimmed }).eq('id', reviewId)
  revalidatePath('/zukan/dm-01')
}
