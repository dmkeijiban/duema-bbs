'use server'

import { cookies } from 'next/headers'
import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdminCookie } from '@/lib/admin-auth'

type ToggleRankExcludedResult = {
  error?: string
  success?: boolean
  message?: string
}

/**
 * 投稿者ランキングからの除外 (rank_excluded) ON/OFF だけを切り替える管理者操作。
 *
 * 安全方針：
 * - 認証は admin_auth cookie + verifyAdminCookie() を Server Action 内で再確認する。
 * - service role は Server Action 内だけで使い、client には一切渡さない。
 * - 対象ユーザーは URL / hidden input 由来だが、必ず DB 側で profile の存在を確認する。
 * - UPDATE するのは rank_excluded / moderation_note / moderated_at だけ。
 *   profile_hidden / account_suspended / withdrawn_at / threads / posts には一切触らない。
 * - 物理削除はしない。
 */
export async function toggleRankExcluded(
  formData: FormData
): Promise<ToggleRankExcludedResult> {
  // 1. 管理者認証の再確認（このページの表示権限とは別に Server Action 側でも必ず確認する）
  const cookieStore = await cookies()
  const adminCookie = cookieStore.get('admin_auth')?.value
  if (!verifyAdminCookie(adminCookie)) {
    return { error: '管理者認証を確認できませんでした。再度ログインしてください。' }
  }

  // 2. 入力の取り出しとバリデーション
  const targetId = String(formData.get('target_id') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim()
  const confirmed = formData.get('confirm') === 'on'
  // 画面表示時点での現在値（楽観ロック用）。'true' / 'false' を期待する。
  const expectedCurrentRaw = String(formData.get('expected_current') ?? '').trim()

  if (!targetId) {
    return { error: '対象ユーザーが指定されていません。' }
  }
  if (!reason) {
    return { error: '操作理由を入力してください。' }
  }
  if (!confirmed) {
    return { error: '確認チェックボックスにチェックを入れてください。' }
  }
  if (expectedCurrentRaw !== 'true' && expectedCurrentRaw !== 'false') {
    return { error: '画面の状態を確認できませんでした。ページを再読み込みしてください。' }
  }
  const expectedCurrent = expectedCurrentRaw === 'true'

  // 3. service role は Server Action 内だけで使う
  const admin = createAdminClient()

  // 4. 対象 profile を DB 側で必ず存在確認する（URL/hidden input をそのまま信用しない）
  const { data: profile, error: fetchError } = await admin
    .from('profiles')
    .select('id, rank_excluded')
    .eq('id', targetId)
    .maybeSingle()

  if (fetchError) {
    console.error('Failed to fetch profile for rank_excluded toggle:', fetchError.message)
    return { error: '対象ユーザーの取得に失敗しました。' }
  }
  if (!profile) {
    return { error: '対象ユーザーが見つかりませんでした。' }
  }

  const current = profile.rank_excluded === true

  // 5. 楽観ロック：画面表示時点と現在の DB 値が食い違っていたら中断する
  if (current !== expectedCurrent) {
    return {
      error:
        '画面表示後に状態が変わっています。最新の状態を確認するためページを再読み込みしてください。',
    }
  }

  const nextValue = !current

  // 6. UPDATE 対象は rank_excluded / moderation_note / moderated_at のみ。
  //    moderated_by は uuid 型かつ管理者は auth.users の uuid を持たないため設定しない（触らない）。
  const { error: updateError } = await admin
    .from('profiles')
    .update({
      rank_excluded: nextValue,
      moderation_note: reason,
      moderated_at: new Date().toISOString(),
    })
    .eq('id', targetId)

  if (updateError) {
    console.error('Failed to update rank_excluded:', updateError.message)
    return { error: 'ランキング除外の更新に失敗しました。' }
  }

  // 7. 投稿者ランキングは1日1回更新（JST 0:00、tag: 'user-rankings'）。即時反映のため tag を失効させる。
  try {
    revalidateTag('user-rankings', { expire: 0 })
  } catch (e) {
    // revalidate に失敗しても更新自体は成功しているため、ブロックしない。
    console.error('Failed to revalidate user-rankings tag:', e)
  }

  return {
    success: true,
    message: nextValue
      ? 'このユーザーを投稿者ランキングから除外しました。'
      : 'このユーザーのランキング除外を解除しました。',
  }
}

type ToggleAccountSuspendedResult = {
  error?: string
  success?: boolean
  message?: string
}

/**
 * アカウント停止 (account_suspended) ON/OFF だけを切り替える管理者操作。
 *
 * この停止は「表示系・ランキング系の停止」であり、投稿やコメントそのものは削除しない。
 * account_suspended=true の既存影響：
 *  - /u/[slug] が 404
 *  - 投稿者ランキングから除外
 *  - 以降の新規投稿/コメントは user_id=null
 *  - /mypage/edit は編集不可
 *
 * 安全方針：
 * - 認証は admin_auth cookie + verifyAdminCookie() を Server Action 内で再確認する。
 * - service role は Server Action 内だけで使い、client には一切渡さない。
 * - 対象ユーザーは URL / hidden input 由来だが、必ず DB 側で profile の存在を確認する。
 * - UPDATE するのは account_suspended / moderation_note / moderated_at だけ。
 *   profile_hidden / rank_excluded / withdrawn_at / threads / posts には一切触らない。
 * - 物理削除はしない。投稿停止・コメント停止・セッションBAN・auth.users 削除は行わない。
 */
export async function toggleAccountSuspended(
  formData: FormData
): Promise<ToggleAccountSuspendedResult> {
  // 1. 管理者認証の再確認（このページの表示権限とは別に Server Action 側でも必ず確認する）
  const cookieStore = await cookies()
  const adminCookie = cookieStore.get('admin_auth')?.value
  if (!verifyAdminCookie(adminCookie)) {
    return { error: '管理者認証を確認できませんでした。再度ログインしてください。' }
  }

  // 2. 入力の取り出しとバリデーション
  const targetId = String(formData.get('target_id') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim()
  const confirmed = formData.get('confirm') === 'on'
  // 画面表示時点での現在値（楽観ロック用）。'true' / 'false' を期待する。
  const expectedCurrentRaw = String(formData.get('expected_current') ?? '').trim()

  if (!targetId) {
    return { error: '対象ユーザーが指定されていません。' }
  }
  if (!reason) {
    return { error: '操作理由を入力してください。' }
  }
  if (!confirmed) {
    return { error: '確認チェックボックスにチェックを入れてください。' }
  }
  if (expectedCurrentRaw !== 'true' && expectedCurrentRaw !== 'false') {
    return { error: '画面の状態を確認できませんでした。ページを再読み込みしてください。' }
  }
  const expectedCurrent = expectedCurrentRaw === 'true'

  // 3. service role は Server Action 内だけで使う
  const admin = createAdminClient()

  // 4. 対象 profile を DB 側で必ず存在確認する（URL/hidden input をそのまま信用しない）
  const { data: profile, error: fetchError } = await admin
    .from('profiles')
    .select('id, account_suspended')
    .eq('id', targetId)
    .maybeSingle()

  if (fetchError) {
    console.error('Failed to fetch profile for account_suspended toggle:', fetchError.message)
    return { error: '対象ユーザーの取得に失敗しました。' }
  }
  if (!profile) {
    return { error: '対象ユーザーが見つかりませんでした。' }
  }

  const current = profile.account_suspended === true

  // 5. 楽観ロック：画面表示時点と現在の DB 値が食い違っていたら中断する
  if (current !== expectedCurrent) {
    return {
      error:
        '画面表示後に状態が変わっています。最新の状態を確認するためページを再読み込みしてください。',
    }
  }

  const nextValue = !current

  // 6. UPDATE 対象は account_suspended / moderation_note / moderated_at のみ。
  //    profile_hidden / rank_excluded / withdrawn_at / threads / posts には触らない。
  //    moderated_by は uuid 型かつ管理者は auth.users の uuid を持たないため設定しない（触らない）。
  const { error: updateError } = await admin
    .from('profiles')
    .update({
      account_suspended: nextValue,
      moderation_note: reason,
      moderated_at: new Date().toISOString(),
    })
    .eq('id', targetId)

  if (updateError) {
    console.error('Failed to update account_suspended:', updateError.message)
    return { error: 'アカウント停止状態の更新に失敗しました。' }
  }

  // 7. 投稿者ランキングは1日1回更新（JST 0:00、tag: 'user-rankings'）。
  //    停止ユーザーはランキングから除外されるため、即時反映のため tag を失効させる。
  try {
    revalidateTag('user-rankings', { expire: 0 })
  } catch (e) {
    // revalidate に失敗しても更新自体は成功しているため、ブロックしない。
    console.error('Failed to revalidate user-rankings tag:', e)
  }

  return {
    success: true,
    message: nextValue
      ? 'このユーザーのアカウントを停止しました（表示・ランキング系）。'
      : 'このユーザーのアカウント停止を解除しました。',
  }
}
