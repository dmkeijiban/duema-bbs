'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

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

export async function createProfile(formData: FormData): Promise<CreateProfileResult> {
  const displayName = String(formData.get('display_name') ?? '').trim()
  const profileSlug = String(formData.get('profile_slug') ?? '').trim().toLowerCase()
  const bio = String(formData.get('bio') ?? '').trim()

  if (displayName.length < 1 || displayName.length > 20) {
    return { error: '表示名は1〜20文字で入力してください。' }
  }

  const slugError = validateSlug(profileSlug)
  if (slugError) return { error: slugError }

  if (bio.length > 300) {
    return { error: '自己紹介は300文字以内で入力してください。' }
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
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (existingByUser) {
    redirect('/')
  }

  const { data: existingSlug } = await admin
    .from('profiles')
    .select('id')
    .eq('profile_slug', profileSlug)
    .maybeSingle()

  if (existingSlug) {
    return { error: 'このURL IDはすでに使われています。' }
  }

  const { error } = await admin.from('profiles').insert({
    id: user.id,
    display_name: displayName,
    profile_slug: profileSlug,
    bio: bio || null,
    ranking_enabled: true,
  })

  if (error) {
    return { error: '投稿者ページの作成に失敗しました。入力内容を確認してください。' }
  }

  redirect('/')
}
