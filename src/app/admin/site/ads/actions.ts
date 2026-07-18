'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'

import { GAM_SETTING_KEYS } from '@/lib/gam'

const GOODLIFE_BOOLEAN_SETTING_KEYS = [
  'goodlife_inline_enabled',
  'goodlife_inline_thread_list',
  'goodlife_inline_thread_detail',
  'goodlife_inline_footer',
  'goodlife_inline_desktop',
  'goodlife_inline_mobile',
] as const

export async function updateGoodlifeAdSettingsAction(formData: FormData) {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) throw new Error('Unauthorized')

  const updatedAt = new Date().toISOString()
  const rows = GOODLIFE_BOOLEAN_SETTING_KEYS.map(key => ({
    key,
    value: formData.get(key) === 'on' ? 'true' : 'false',
    updated_at: updatedAt,
  }))

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('site_settings')
    .upsert(rows, { onConflict: 'key' })

  if (error) throw new Error(`Goodlife広告設定の保存に失敗しました: ${error.message}`)

  revalidateTag('site_settings', { expire: 0 })
  revalidatePath('/', 'layout')
  revalidatePath('/admin/site/ads')
  redirect('/admin/site/ads?saved=1')
}

export async function updateGamAdSettingsAction(formData: FormData) {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) throw new Error('Unauthorized')

  const updatedAt = new Date().toISOString()
  const rows = GAM_SETTING_KEYS.map(key => ({
    key,
    value: formData.get(key) === 'on' ? 'true' : 'false',
    updated_at: updatedAt,
  }))

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('site_settings')
    .upsert(rows, { onConflict: 'key' })

  if (error) throw new Error(`GAM広告設定の保存に失敗しました: ${error.message}`)

  revalidateTag('site_settings', { expire: 0 })
  revalidatePath('/', 'layout')
  revalidatePath('/admin/site/ads')
  redirect('/admin/site/ads?saved=1')
}
