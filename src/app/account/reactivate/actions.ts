'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { anonymizeUserContent } from '@/lib/anonymize-user-content'

type ReactivateAccountResult = {
  error?: string
  redirectTo?: string
}

/**
 * 退会済みアカウントを再開する。
 *
 * 仕様（方式A）:
 * - プロフィール枠（URL ID 等）は再利用できるが、退会前の投稿実績は復活させない。
 * - そのため withdrawn_at を解除する「前」に、本人の過去コンテンツを匿名化する。
 * - 匿名化が失敗した場合は再開を完了させない（withdrawn_at を解除しない）。
 * - postsだけ成功・threads失敗のような中途半端な場合も、フラグは戻さない。
 * - 冪等。再実行しても壊れない。
 */
export async function reactivateAccount(): Promise<ReactivateAccountResult> {
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

  if (profileError) {
    return { error: 'プロフィールを確認できませんでした。' }
  }

  // プロフィールが無い場合は通常の新規作成へ。
  if (!profile) {
    return { redirectTo: '/profile/new' }
  }

  // 退会済みでなければ再開不要。そのままマイページへ。
  if (!profile.withdrawn_at) {
    return { redirectTo: '/mypage' }
  }

  // 1〜3. 本人の過去コンテンツ（posts / threads / zukan 評価・レビュー）を匿名化。
  //        既存退会者は過去 user_id が残っている可能性があるため、再開前にここで確実に外す。
  // 4.     これにより過去活動はランキング集計（user_id ベース）に再加算されない。
  const anonymizeResult = await anonymizeUserContent(admin, user.id)
  if (anonymizeResult.error) {
    // 匿名化に失敗したら再開を完了させない（withdrawn_at は解除しない）。
    return { error: 'アカウントの再開に失敗しました。時間を置いてもう一度お試しください。' }
  }

  // 5〜6. 匿名化が完了してから、退会フラグを解除し再開に必要なフラグを通常状態へ戻す。
  //        display_name 等は退会時にクリア済みのため、再開後にプロフィール編集で再設定する。
  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .from('profiles')
    .update({
      withdrawn_at: null,
      profile_hidden: false,
      ranking_enabled: true,
      rank_excluded: false,
      updated_at: now,
    })
    .eq('id', user.id)
    .not('withdrawn_at', 'is', null)

  if (updateError) {
    console.error('Failed to reactivate account:', updateError.message)
    return { error: 'アカウントの再開に失敗しました。時間を置いてもう一度お試しください。' }
  }

  revalidateTag('profiles', { expire: 0 })
  revalidateTag('user-rankings', { expire: 0 })
  revalidateTag('posts', { expire: 0 })
  revalidateTag('threads', { expire: 0 })
  revalidatePath('/mypage')
  revalidatePath('/mypage/edit')
  if (profile.profile_slug) {
    revalidatePath(`/u/${profile.profile_slug}`)
  }
  revalidatePath('/ranking')

  // 7. 再開後はプロフィール編集へ。退会時にクリアした名前・アイコン等をここで再設定できる。
  return { redirectTo: '/mypage/edit?reactivated=1' }
}
