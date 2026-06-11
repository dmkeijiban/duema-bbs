'use server'

import { createPublicClient } from '@/lib/supabase-public'
import { revalidatePath } from 'next/cache'

export type PackReviewFormState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string }

export async function submitPackReview(
  packId: string,
  _prev: PackReviewFormState,
  formData: FormData,
): Promise<PackReviewFormState> {
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
  const { error } = await supabase.from('zukan_pack_reviews').insert({
    pack_id: packId,
    display_name: displayName,
    body,
  })

  if (error) {
    return { status: 'error', message: '投稿に失敗しました。しばらくしてから再試行してください。' }
  }

  revalidatePath('/zukan/dm-01')
  return { status: 'success' }
}
