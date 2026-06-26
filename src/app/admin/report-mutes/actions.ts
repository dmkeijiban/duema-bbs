'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdminCookie } from '@/lib/admin-auth'

const ADMIN_COOKIE = 'admin_auth'

async function requireAdmin() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) {
    redirect('/admin')
  }
}

export async function revokeReportMuteAction(formData: FormData) {
  await requireAdmin()

  const muteId = Number(formData.get('muteId'))
  if (!muteId || Number.isNaN(muteId)) redirect('/admin/report-mutes?error=invalid_id')

  const admin = createAdminClient()
  const { error } = await admin
    .from('report_mutes')
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('id', muteId)
    .eq('is_active', true)

  if (error) {
    console.error('Failed to revoke report mute:', error.message)
    redirect('/admin/report-mutes?error=revoke_failed')
  }

  revalidatePath('/admin/report-mutes')
  redirect('/admin/report-mutes?revoked=1')
}
