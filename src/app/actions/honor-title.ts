'use server'

import { cookies } from 'next/headers'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdminCookie } from '@/lib/admin-auth'

const ADMIN_COOKIE = 'admin_auth'

async function checkAdmin() {
  const cookieStore = await cookies()
  const val = cookieStore.get(ADMIN_COOKIE)?.value
  if (!verifyAdminCookie(val)) throw new Error('Unauthorized')
}

export async function toggleHonorTitleEnabled(enabled: boolean): Promise<{ error?: string }> {
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
      { key: 'honor_title_enabled', value: enabled ? 'true' : 'false', updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  if (error) return { error: error.message }

  revalidateTag('honor-title-enabled', { expire: 0 })
  revalidatePath('/', 'layout')
  return {}
}
