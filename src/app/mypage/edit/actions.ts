'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

type UpdateProfileResult = {
  error?: string
  success?: boolean
}

const X_HOSTS = ['x.com', 'twitter.com']
const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'youtu.be']

// 入力URLを検証する。空ならnull、httpsかつ許可ホストならそのURL、それ以外はinvalid。
function normalizeUrl(
  value: string,
  allowedHosts: string[]
): { ok: true; value: string | null } | { ok: false } {
  const trimmed = value.trim()
  if (!trimmed) return { ok: true, value: null }

  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:') return { ok: false }
    if (!allowedHosts.includes(url.hostname)) return { ok: false }
    return { ok: true, value: url.toString() }
  } catch {
    return { ok: false }
  }
}

export async function updateProfile(formData: FormData): Promise<UpdateProfileResult> {
  const displayName = String(formData.get('display_name') ?? '').trim()
  const bio = String(formData.get('bio') ?? '').trim()
  const xUrlRaw = String(formData.get('x_url') ?? '')
  const youtubeUrlRaw = String(formData.get('youtube_url') ?? '')
  const profileHidden = formData.get('profile_hidden') === 'on'
  const rankingEnabled = formData.get('ranking_enabled') === 'on'

  if (displayName.length < 1 || displayName.length > 20) {
    return { error: '表示名は1〜20文字で入力してください。' }
  }

  if (bio.length > 300) {
    return { error: '自己紹介は300文字以内で入力してください。' }
  }

  const xUrl = normalizeUrl(xUrlRaw, X_HOSTS)
  if (!xUrl.ok) {
    return { error: 'X（旧Twitter）のURLは https://x.com/... または https://twitter.com/... の形式で入力してください。' }
  }

  const youtubeUrl = normalizeUrl(youtubeUrlRaw, YOUTUBE_HOSTS)
  if (!youtubeUrl.ok) {
    return { error: 'YouTubeのURLは https://youtube.com/... / https://youtu.be/... の形式で入力してください。' }
  }

  // 本人確認：Server Action 内で getUser() を呼び、client からの user_id は一切受け取らない。
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData.user

  if (userError || !user) {
    return { error: 'ログイン状態を確認できませんでした。もう一度ログインしてください。' }
  }

  // 更新は本人の行（id = user.id）のみ。profile_slug・avatar 等は触らない。
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      display_name: displayName,
      bio: bio || null,
      x_url: xUrl.value,
      youtube_url: youtubeUrl.value,
      profile_hidden: profileHidden,
      ranking_enabled: rankingEnabled,
    })
    .eq('id', user.id)

  if (error) {
    console.error('Failed to update profile:', error.message)
    return { error: 'プロフィールの更新に失敗しました。入力内容を確認してください。' }
  }

  return { success: true }
}
