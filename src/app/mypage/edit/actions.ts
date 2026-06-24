'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath, revalidateTag } from 'next/cache'
import {
  DUEMA_GENERATIONS,
  DUEMA_CIVILIZATIONS,
  DUEMA_PLAY_STYLES,
  FAVORITE_CARD_MAX_LENGTH,
} from '@/lib/duema-profile'

type UpdateProfileResult = {
  error?: string
  redirectTo?: string
  success?: boolean
  avatarUrl?: string | null
}

const X_HOSTS = ['x.com', 'twitter.com']
const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'youtu.be']
const AVATAR_BUCKET = 'profile-avatars'
const MAX_AVATAR_SIZE = 500 * 1024
const AVATAR_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
} as const

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
  const deleteAvatar = formData.get('delete_avatar') === 'on'
  const avatarFile = formData.get('avatar_file')
  const duemaGeneration = String(formData.get('duema_generation') ?? '').trim() || null
  const favoriteCard = String(formData.get('favorite_card') ?? '').trim() || null
  const favoriteCivilization = String(formData.get('favorite_civilization') ?? '').trim() || null
  const playStyle = String(formData.get('play_style') ?? '').trim() || null

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

  if (favoriteCard && favoriteCard.length > FAVORITE_CARD_MAX_LENGTH) {
    return { error: `好きなカードは${FAVORITE_CARD_MAX_LENGTH}文字以内で入力してください。` }
  }

  const validGenerations = new Set(DUEMA_GENERATIONS.map(o => o.value))
  if (duemaGeneration && !validGenerations.has(duemaGeneration)) {
    return { error: 'プレイ開始時期の値が正しくありません。' }
  }

  const validCivilizations = new Set(DUEMA_CIVILIZATIONS.map(o => o.value))
  if (favoriteCivilization && !validCivilizations.has(favoriteCivilization)) {
    return { error: '好きな文明の値が正しくありません。' }
  }

  const validPlayStyles = new Set(DUEMA_PLAY_STYLES.map(o => o.value))
  if (playStyle && !validPlayStyles.has(playStyle)) {
    return { error: 'プレイスタイルの値が正しくありません。' }
  }

  // 本人確認：Server Action 内で getUser() を呼び、client からの user_id は一切受け取らない。
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData.user

  if (userError || !user) {
    return { error: 'ログイン状態を確認できませんでした。もう一度ログインしてください。' }
  }

  const admin = createAdminClient()

  // アカウント停止中・退会済みなら保存を拒否する（UI だけに頼らず Server Action 側でも再確認）。
  const { data: guardProfile, error: guardError } = await admin
    .from('profiles')
    .select('profile_slug, account_suspended, withdrawn_at')
    .eq('id', user.id)
    .maybeSingle()

  if (guardError) {
    console.error('Failed to fetch profile for edit guard:', guardError.message)
    return { error: 'プロフィールの更新に失敗しました。入力内容を確認してください。' }
  }

  if (
    guardProfile?.account_suspended === true ||
    (guardProfile?.withdrawn_at ?? null) !== null
  ) {
    return { error: 'このアカウントではプロフィール編集を利用できません。' }
  }

  let nextAvatarUrl: string | null | undefined
  const hasAvatarFile = avatarFile instanceof File && avatarFile.size > 0

  if (deleteAvatar || hasAvatarFile) {
    const existingPaths = ['.jpg', '.jpeg', '.png', '.webp'].map(ext => `${user.id}/avatar${ext}`)
    const { error: removeError } = await admin.storage.from(AVATAR_BUCKET).remove(existingPaths)
    if (removeError) {
      console.error('Failed to remove existing avatar:', removeError.message)
      return { error: 'アイコンの更新に失敗しました。少し時間を置いて再試行してください。' }
    }
    nextAvatarUrl = null
  }

  if (hasAvatarFile) {
    const ext = AVATAR_TYPES[avatarFile.type as keyof typeof AVATAR_TYPES]
    if (!ext) {
      return { error: 'アイコンは jpg / png / webp の画像を選択してください。' }
    }
    if (avatarFile.size > MAX_AVATAR_SIZE) {
      return { error: 'アイコン画像は500KB以内にしてください。' }
    }

    const path = `${user.id}/avatar${ext}`
    const { error: uploadError } = await admin.storage
      .from(AVATAR_BUCKET)
      .upload(path, avatarFile, {
        contentType: avatarFile.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('Failed to upload avatar:', uploadError.message)
      return { error: 'アイコンのアップロードに失敗しました。画像形式と容量を確認してください。' }
    }

    const { data: publicUrl } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path)
    nextAvatarUrl = `${publicUrl.publicUrl}?v=${Date.now()}`
  }

  const updatePayload: {
    display_name: string
    bio: string | null
    x_url: string | null
    youtube_url: string | null
    profile_hidden: boolean
    ranking_enabled: boolean
    duema_generation: string | null
    favorite_card: string | null
    favorite_civilization: string | null
    play_style: string | null
    avatar_url?: string | null
  } = {
    display_name: displayName,
    bio: bio || null,
    x_url: xUrl.value,
    youtube_url: youtubeUrl.value,
    profile_hidden: profileHidden,
    ranking_enabled: rankingEnabled,
    duema_generation: duemaGeneration,
    favorite_card: favoriteCard,
    favorite_civilization: favoriteCivilization,
    play_style: playStyle,
  }

  if (nextAvatarUrl !== undefined) {
    updatePayload.avatar_url = nextAvatarUrl
  }

  const { error } = await admin
    .from('profiles')
    .update(updatePayload)
    .eq('id', user.id)

  if (error) {
    console.error('Failed to update profile:', error.message)
    return { error: 'プロフィールの更新に失敗しました。入力内容を確認してください。' }
  }

  revalidateTag('profiles', { expire: 0 })
  revalidatePath('/mypage')
  revalidatePath('/mypage/edit')
  if (guardProfile?.profile_slug) {
    revalidatePath(`/u/${guardProfile.profile_slug}`)
    revalidatePath('/zukan/dm-01')
  }

  // 保存後は投稿者ページへ自動遷移せず編集画面に留まる。
  // 続けて編集しやすいよう、成功フラグと更新後アイコンURLを返す。
  return { success: true, avatarUrl: nextAvatarUrl }
}
