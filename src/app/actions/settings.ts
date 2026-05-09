'use server'

import { cookies } from 'next/headers'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase-server'
import { verifyAdminCookie } from '@/lib/admin-auth'

const ADMIN_COOKIE = 'admin_auth'

async function checkAdmin() {
  const cookieStore = await cookies()
  const val = cookieStore.get(ADMIN_COOKIE)?.value
  if (!verifyAdminCookie(val)) throw new Error('Unauthorized')
}

export async function updateSetting(key: string, value: string): Promise<{ error?: string }> {
  try {
    await checkAdmin()
  } catch {
    return { error: 'Unauthorized' }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from('site_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  revalidatePath('/terms')
  revalidateTag('settings', { expire: 0 })
  return {}
}
