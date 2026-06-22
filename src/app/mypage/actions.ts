'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { anonymizeUserContent } from '@/lib/anonymize-user-content'

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

  // 方式A: 退会と同時に過去の投稿・スレッド・図鑑の評価/レビューを匿名化する（user_id を外す）。
  //
  // 公開投稿者ページ・通常/キャンペーンランキングは既に withdrawn_at で除外しているが、
  // 各テーブルの user_id を本人に残したままだと、将来アカウントを再開（= profiles の
  // フラグを戻す）した際に、過去の投稿実績やランキングポイントまで一緒に復活して
  // しまう。退会の時点で本人との紐付けを物理的に断つことで、「プロフィールは再利用
  // できるが、退会前の投稿実績は復活しない」を保証する。
  //
  // - 対象は退会する本人 1 名のみ（eq user_id）。全ユーザーへの一括更新ではない。
  // - 本文・session_id・いいね・画像・スコアなど投稿データ本体は一切変更しない。
  // - 物理削除はしない（user_id を null にするだけ）。
  // - 先に匿名化してから profiles を退会済みにする。万一途中で失敗しても
  //   withdrawn_at は未設定のまま残り、再実行で匿名化からやり直せる（冪等）。
  const anonymizeResult = await anonymizeUserContent(admin, user.id)
  if (anonymizeResult.error) {
    return { error: '退会処理に失敗しました。時間を置いてもう一度お試しください。' }
  }

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
