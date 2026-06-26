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

export async function blockReportSourceAction(formData: FormData) {
  await requireAdmin()

  const reportId = Number(formData.get('reportId'))
  const reason = String(formData.get('reason') ?? '').trim() || '通報機能の悪用対策'
  if (!reportId || Number.isNaN(reportId)) redirect('/admin/reports?error=invalid_report')

  const admin = createAdminClient()
  const { data: report } = await admin
    .from('reports')
    .select('id, reporter_user_id, reporter_session_id')
    .eq('id', reportId)
    .maybeSingle()

  if (!report) redirect('/admin/reports?error=report_not_found')

  const reporterUserId = report.reporter_user_id as string | null
  const reporterSessionId = report.reporter_session_id as string | null

  if (!reporterUserId && !reporterSessionId) {
    redirect('/admin/reports?error=no_identifier')
  }

  const payload = reporterUserId
    ? { user_id: reporterUserId, session_id: null, reason, is_active: true }
    : { user_id: null, session_id: reporterSessionId, reason, is_active: true }

  const { error } = await admin.from('report_mutes').insert(payload)
  if (error) {
    console.error('Failed to block report source:', error.message)
    redirect('/admin/reports?error=block_failed')
  }

  revalidatePath('/admin/reports')
  redirect('/admin/reports?blocked=1')
}

export async function unblockReportSourceAction(formData: FormData) {
  await requireAdmin()

  const muteId = Number(formData.get('muteId'))
  if (!muteId || Number.isNaN(muteId)) redirect('/admin/reports?error=invalid_block')

  const admin = createAdminClient()
  const { error } = await admin
    .from('report_mutes')
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('id', muteId)
    .eq('is_active', true)

  if (error) {
    console.error('Failed to unblock report source:', error.message)
    redirect('/admin/reports?error=unblock_failed')
  }

  revalidatePath('/admin/reports')
  redirect('/admin/reports?unblocked=1')
}
