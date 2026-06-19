'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

const X_HOSTS = ['x.com', 'twitter.com']
const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'youtu.be']
const AVATAR_BUCKET = 'profile-avatars'
const MAX_AVATAR_SIZE = 500 * 1024
const AVATAR_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
} as const

const RESERVED_SLUGS = new Set([
  'admin',
  'administrator',
  'root',
  'system',
  'support',
  'help',
  'info',
  'api',
  'auth',
  'login',
  'logout',
  'signin',
  'signup',
  'register',
  'account',
  'accounts',
  'settings',
  'setting',
  'config',
  'user',
  'users',
  'profile',
  'profiles',
  'me',
  'about',
  'terms',
  'privacy',
  'policy',
  'contact',
  'faq',
  'mail',
  'email',
  'www',
  'app',
  'official',
  'staff',
  'mod',
  'moderator',
  'duema',
  'bbs',
  'board',
  'thread',
  'threads',
  'post',
  'posts',
  'null',
  'undefined',
  'none',
  'true',
  'false',
  'test',
])

type CreateProfileResult = {
  error?: string
  redirectTo?: string
}

function validateSlug(value: string) {
  if (!/^[a-z0-9](?:[a-z0-9_]{1,18}[a-z0-9])$/.test(value)) {
    return 'URL IDは半角英小文字・数字・_ の3〜20文字で、先頭末尾は英数字にしてください。'
  }
  if (RESERVED_SLUGS.has(value)) {
    return 'このURL IDは予約語のため使えません。'
  }
  return null
}

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

export async function createProfile(formData: FormData): Promise<CreateProfileResult> {
  const displayName = String(formData.get('display_name') ?? '').trim()
  const profileSlug = String(formData.get('profile_slug') ?? '').trim().toLowerCase()
  const bio = String(formData.get('bio') ?? '').trim()
  const xUrlRaw = String(formData.get('x_url') ?? '')
  const youtubeUrlRaw = String(formData.get('youtube_url') ?? '')
  const avatarFile = formData.get('avatar_file')

  if (displayName.length < 1 || displayName.length > 20) {
    return { error: '表示名は1〜20文字で入力してください。' }
  }

  const slugError = validateSlug(profileSlug)
  if (slugError) return { error: slugError }

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

  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData.user

  if (userError || !user) {
    return { error: 'ログイン状態を確認できませんでした。もう一度ログインしてください。' }
  }

  const admin = createAdminClient()
  const { data: existingByUser } = await admin
    .from('profiles')
    .select('profile_slug')
    .eq('id', user.id)
    .maybeSingle()

  if (existingByUser) {
    redirect(existingByUser.profile_slug ? `/u/${existingByUser.profile_slug}` : '/')
  }

  const { data: existingSlug } = await admin
    .from('profiles')
    .select('id')
    .eq('profile_slug', profileSlug)
    .maybeSingle()

  if (existingSlug) {
    return { error: 'このURL IDはすでに使われています。' }
  }

  let avatarUrl: string | null = null
  let avatarPath: string | null = null
  const hasAvatarFile = avatarFile instanceof File && avatarFile.size > 0

  if (hasAvatarFile) {
    const ext = AVATAR_TYPES[avatarFile.type as keyof typeof AVATAR_TYPES]
    if (!ext) {
      return { error: 'アイコンは jpg / png / webp の画像を選択してください。' }
    }
    if (avatarFile.size > MAX_AVATAR_SIZE) {
      return { error: 'アイコン画像は500KB以内にしてください。' }
    }

    const path = `${user.id}/avatar${ext}`
    avatarPath = path
    const { error: uploadError } = await admin.storage
      .from(AVATAR_BUCKET)
      .upload(path, avatarFile, {
        contentType: avatarFile.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('Failed to upload avatar on profile create:', uploadError.message)
      return { error: 'アイコンのアップロードに失敗しました。画像形式と容量を確認してください。' }
    }

    const { data: publicUrl } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path)
    avatarUrl = publicUrl.publicUrl
  }

  const { error } = await admin.from('profiles').insert({
    id: user.id,
    display_name: displayName,
    profile_slug: profileSlug,
    bio: bio || null,
    x_url: xUrl.value,
    youtube_url: youtubeUrl.value,
    avatar_url: avatarUrl,
    ranking_enabled: true,
  })

  if (error) {
    if (avatarPath) {
      await admin.storage.from(AVATAR_BUCKET).remove([avatarPath])
    }
    return { error: 'プロフィールの作成に失敗しました。入力内容を確認してください。' }
  }

  return { redirectTo: `/u/${profileSlug}` }
}
