'use server'

import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
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

// Returns normalized "/thread/{id}" or "" (empty = not set), or null if invalid
function validateAndNormalizeRulesUrl(raw: string): string | null {
  if (!raw) return ''
  const internalMatch = /^\/thread\/(\d+)$/.exec(raw)
  if (internalMatch) return `/thread/${internalMatch[1]}`
  const externalMatch = /^https:\/\/www\.duema-bbs\.com\/thread\/(\d+)$/.exec(raw)
  if (externalMatch) return `/thread/${externalMatch[1]}`
  return null
}

type ParsedForm = {
  status: 'active' | 'draft'
  title: string
  start: string
  end: string
  prize: string
  rulesUrl: string
  error: string | null
}

function parseCampaignForm(formData: FormData): ParsedForm {
  const enabled = (formData.get('campaign_enabled') as string)?.trim()
  const status = enabled === 'on' ? 'active' : 'draft'
  const title = (formData.get('campaign_title') as string)?.trim() ?? ''
  const startRaw = (formData.get('campaign_start') as string)?.trim() ?? ''
  const endRaw = (formData.get('campaign_end') as string)?.trim() ?? ''
  const prize = (formData.get('campaign_prize') as string)?.trim() ?? ''
  const rulesUrlRaw = (formData.get('campaign_rules_url') as string)?.trim() ?? ''

  if (!title || !startRaw || !endRaw) {
    return { status, title, start: '', end: '', prize, rulesUrl: '', error: 'required' }
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startRaw) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(endRaw)) {
    return { status, title, start: '', end: '', prize, rulesUrl: '', error: 'invalid_datetime' }
  }

  const start = `${startRaw}:00+09:00`
  const end = `${endRaw}:00+09:00`

  if (new Date(end) <= new Date(start)) {
    return { status, title, start, end, prize, rulesUrl: '', error: 'invalid_range' }
  }

  const rulesUrl = validateAndNormalizeRulesUrl(rulesUrlRaw)
  if (rulesUrl === null) {
    return { status, title, start, end, prize, rulesUrl: '', error: 'invalid_rules_url' }
  }

  return { status, title, start, end, prize, rulesUrl, error: null }
}

export async function createCampaignEventAction(formData: FormData): Promise<void> {
  try {
    await checkAdmin()
  } catch {
    redirect('/admin/campaign-ranking?error=unauthorized')
  }

  const parsed = parseCampaignForm(formData)
  if (parsed.error) {
    redirect(`/admin/campaign-ranking/new?error=${parsed.error}`)
  }

  const supabase = createAdminClient()
  const { data: created, error } = await supabase
    .from('campaign_events')
    .insert({
      title: parsed.title,
      status: parsed.status,
      start_at: parsed.start,
      end_at: parsed.end,
      prize: parsed.prize,
      rules_url: parsed.rulesUrl,
    })
    .select('id')
    .single()

  if (error || !created) {
    console.error('[createCampaignEventAction]', error)
    redirect('/admin/campaign-ranking/new?error=save_failed')
  }

  revalidatePath('/admin/campaign-ranking')
  revalidatePath('/ranking')
  revalidateTag('campaign-ranking', { expire: 0 })
  redirect(`/admin/campaign-ranking/${created.id}?created=1`)
}

export async function updateCampaignEventAction(formData: FormData): Promise<void> {
  try {
    await checkAdmin()
  } catch {
    redirect('/admin/campaign-ranking?error=unauthorized')
  }

  const id = Number(formData.get('id'))
  if (!id || isNaN(id)) redirect('/admin/campaign-ranking?error=invalid_id')

  const parsed = parseCampaignForm(formData)
  if (parsed.error) {
    redirect(`/admin/campaign-ranking/${id}?error=${parsed.error}`)
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('campaign_events')
    .update({
      title: parsed.title,
      status: parsed.status,
      start_at: parsed.start,
      end_at: parsed.end,
      prize: parsed.prize,
      rules_url: parsed.rulesUrl,
    })
    .eq('id', id)

  if (error) {
    console.error('[updateCampaignEventAction]', error)
    redirect(`/admin/campaign-ranking/${id}?error=save_failed`)
  }

  revalidatePath('/admin/campaign-ranking')
  revalidatePath('/ranking')
  revalidateTag('campaign-ranking', { expire: 0 })
  redirect(`/admin/campaign-ranking/${id}?saved=1`)
}

export async function deleteCampaignEventAction(formData: FormData): Promise<void> {
  try {
    await checkAdmin()
  } catch {
    redirect('/admin/campaign-ranking?error=unauthorized')
  }

  const id = Number(formData.get('id'))
  if (!id || isNaN(id)) redirect('/admin/campaign-ranking?error=invalid_id')

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('campaign_events')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[deleteCampaignEventAction]', error)
    redirect('/admin/campaign-ranking?error=delete_failed')
  }

  revalidatePath('/admin/campaign-ranking')
  revalidatePath('/ranking')
  revalidateTag('campaign-ranking', { expire: 0 })
  redirect('/admin/campaign-ranking?deleted=1')
}
