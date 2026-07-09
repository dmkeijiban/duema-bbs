'use server'

import { cookies } from 'next/headers'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdminCookie } from '@/lib/admin-auth'

const ADMIN_COOKIE = 'admin_auth'

const POST_GUIDANCE_SETTING_KEYS = [
  'show_thread_form_hint',
  'show_after_comment_thread_prompt',
  'show_comment_form_hint',
] as const

type PostGuidanceSettingKey = (typeof POST_GUIDANCE_SETTING_KEYS)[number]

async function checkAdmin() {
  const cookieStore = await cookies()
  const val = cookieStore.get(ADMIN_COOKIE)?.value
  if (!verifyAdminCookie(val)) throw new Error('Unauthorized')
}

export async function updatePostGuidanceSetting(
  key: PostGuidanceSettingKey,
  enabled: boolean
): Promise<{ error?: string }> {
  if (!POST_GUIDANCE_SETTING_KEYS.includes(key)) {
    return { error: 'Invalid key' }
  }
  try {
    await checkAdmin()
  } catch {
    return { error: 'Unauthorized' }
  }
  // site_settings の書き込みはサービスロールクライアント経由（RLS で anon/authenticated の書き込みを禁止するため）
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('site_settings')
    .upsert(
      { key, value: enabled ? 'true' : 'false', updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  if (error) return { error: error.message }

  revalidateTag('post-guidance-settings', { expire: 0 })
  revalidatePath('/', 'layout')
  return {}
}
