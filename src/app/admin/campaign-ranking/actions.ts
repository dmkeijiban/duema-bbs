'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdminCookie } from '@/lib/admin-auth'

const ADMIN_COOKIE = 'admin_auth'

async function checkAdmin() {
  const cookieStore = await cookies()
  const val = cookieStore.get(ADMIN_COOKIE)?.value
  if (!verifyAdminCookie(val)) {
    throw new Error('Unauthorized')
  }
}

const VALID_STATUSES = ['draft', 'active', 'ended', 'finalized'] as const
type CampaignStatus = (typeof VALID_STATUSES)[number]

function isValidStatus(v: string): v is CampaignStatus {
  return (VALID_STATUSES as readonly string[]).includes(v)
}

// Returns normalized "/thread/{id}" or "" (empty = not set), or null if invalid
function validateAndNormalizeRulesUrl(raw: string): string | null {
  if (!raw) return ''
  const internalMatch = /^\/thread\/(\d+)$/.exec(raw)
  if (internalMatch) return `/thread/${internalMatch[1]}`
  const externalMatch = /^https:\/\/www\.duema-bbs\.com\/thread\/(\d+)$/.exec(raw)
  if (externalMatch) return `/thread/${externalMatch[1]}`
  return null
}

export async function saveCampaignRankingAction(formData: FormData): Promise<void> {
  try {
    await checkAdmin()
  } catch {
    redirect('/admin/campaign-ranking?error=unauthorized')
  }

  const status = (formData.get('campaign_status') as string)?.trim()
  const title = (formData.get('campaign_title') as string)?.trim()
  const startRaw = (formData.get('campaign_start') as string)?.trim()
  const endRaw = (formData.get('campaign_end') as string)?.trim()
  const prize = (formData.get('campaign_prize') as string)?.trim()
  const rulesUrlRaw = (formData.get('campaign_rules_url') as string)?.trim()

  if (!isValidStatus(status)) {
    redirect('/admin/campaign-ranking?error=invalid_status')
  }
  if (!title || !startRaw || !endRaw) {
    redirect('/admin/campaign-ranking?error=required')
  }

  // datetime-local → JST ISO 8601 (append :00+09:00, no UTC conversion)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startRaw) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(endRaw)) {
    redirect('/admin/campaign-ranking?error=invalid_datetime')
  }
  const start = `${startRaw}:00+09:00`
  const end = `${endRaw}:00+09:00`

  if (new Date(end) <= new Date(start)) {
    redirect('/admin/campaign-ranking?error=invalid_range')
  }

  const normalizedRulesUrl = validateAndNormalizeRulesUrl(rulesUrlRaw)
  if (normalizedRulesUrl === null) {
    redirect('/admin/campaign-ranking?error=invalid_rules_url')
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const rows = [
    { key: 'campaign_status', value: status },
    { key: 'campaign_title', value: title },
    { key: 'campaign_start', value: start },
    { key: 'campaign_end', value: end },
    { key: 'campaign_prize', value: prize ?? '' },
    { key: 'campaign_rules_url', value: normalizedRulesUrl },
  ].map(r => ({ ...r, updated_at: now }))

  const { error } = await supabase
    .from('site_settings')
    .upsert(rows, { onConflict: 'key' })

  if (error) {
    console.error('[saveCampaignRankingAction]', error)
    redirect('/admin/campaign-ranking?error=save_failed')
  }

  revalidatePath('/admin/campaign-ranking')
  redirect('/admin/campaign-ranking?saved=1')
}
