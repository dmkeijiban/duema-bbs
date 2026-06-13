'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'

type WithdrawAccountResult = {
  error?: string
  redirectTo?: string
}

export async function withdrawAccount(formData: FormData): Promise<WithdrawAccountResult> {
  const confirmation = String(formData.get('confirmation') ?? '').trim()
  if (confirmation !== '退会する') {
    return { error: '確認欄に「退会する」と入力してください。' }
  }

  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData.user

  if (userError || !user) {
    return { error: 'ログイン状態を確認できませんでした。もう一度ログインしてください。' }
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('profile_slug, withdrawn_at')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return { error: 'プロフィールを確認できませんでした。' }
  }

  if (profile.withdrawn_at) {
    await supabase.auth.signOut()
    return { redirectTo: '/' }
  }

  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .from('profiles')
    .update({
      display_name: '退会済みユーザー',
      bio: null,
      x_url: null,
      youtube_url: null,
      avatar_url: null,
      profile_hidden: true,
      ranking_enabled: false,
      rank_excluded: true,
      withdrawn_at: now,
      updated_at: now,
    })
    .eq('id', user.id)
    .is('withdrawn_at', null)

  if (updateError) {
    console.error('Failed to withdraw account:', updateError.message)
    return { error: '退会処理に失敗しました。時間を置いてもう一度お試しください。' }
  }

  revalidateTag('profiles', { expire: 0 })
  revalidateTag('user-rankings', { expire: 0 })
  revalidateTag('posts', { expire: 0 })
  revalidateTag('threads', { expire: 0 })
  revalidatePath('/mypage')
  revalidatePath('/mypage/edit')
  revalidatePath(`/u/${profile.profile_slug}`)
  revalidatePath('/ranking')

  await supabase.auth.signOut()
  return { redirectTo: '/' }
}
