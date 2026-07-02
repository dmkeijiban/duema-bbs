'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { normalizeXStatusUrl, publishXBuzzQueueItem, XBuzzQueueStatus } from '@/lib/x-buzz-queue'

const ADMIN_COOKIE = 'admin_auth'
const MAX_URLS_PER_SUBMIT = 200

async function requireAdmin() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) redirect('/admin')
}

function redirectWithResult(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  redirect(`/admin/x-buzz${search.size ? `?${search.toString()}` : ''}`)
}

export async function addXBuzzUrls(formData: FormData) {
  await requireAdmin()
  const raw = String(formData.get('urls') ?? '')
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)

  if (lines.length === 0) {
    redirectWithResult({ error: 'URLを1件以上貼ってください' })
  }
  if (lines.length > MAX_URLS_PER_SUBMIT) {
    redirectWithResult({ error: `1回に登録できるURLは${MAX_URLS_PER_SUBMIT}件までです` })
  }

  const seenInInput = new Set<string>()
  const normalized: string[] = []
  const invalid: string[] = []
  const duplicateInInput: string[] = []

  for (const line of lines) {
    const url = normalizeXStatusUrl(line)
    if (!url) {
      invalid.push(line)
      continue
    }
    if (seenInInput.has(url)) {
      duplicateInInput.push(url)
      continue
    }
    seenInInput.add(url)
    normalized.push(url)
  }

  const admin = createAdminClient()
  let inserted = 0
  const duplicateInDb: string[] = []
  const failed: string[] = []

  for (const sourceUrl of normalized) {
    const { error } = await admin
      .from('x_buzz_queue')
      .insert({ source_url: sourceUrl, status: 'pending' })

    if (!error) {
      inserted += 1
      continue
    }
    if (error.code === '23505') {
      duplicateInDb.push(sourceUrl)
      continue
    }
    failed.push(`${sourceUrl} (${error.message})`)
  }

  revalidatePath('/admin/x-buzz')
  redirectWithResult({
    added: inserted,
    duplicate: duplicateInInput.length + duplicateInDb.length,
    invalid: invalid.length,
    failed: failed.length,
    duplicateList: [...duplicateInInput, ...duplicateInDb].slice(0, 10).join('\n'),
    invalidList: invalid.slice(0, 10).join('\n'),
  })
}

export async function updateXBuzzStatus(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  const status = String(formData.get('status') ?? '') as XBuzzQueueStatus
  const allowed: XBuzzQueueStatus[] = ['pending', 'hold', 'rejected']

  if (!id || !allowed.includes(status)) redirect('/admin/x-buzz?error=不正な操作です')

  const admin = createAdminClient()
  const { error } = await admin
    .from('x_buzz_queue')
    .update({
      status,
      error_message: null,
      updated_at: new Date().toISOString(),
      ...(status === 'pending' ? { hold_reason: null } : {}),
    })
    .eq('id', id)
    .neq('status', 'published')

  if (error) redirectWithResult({ error: error.message })

  revalidatePath('/admin/x-buzz')
  redirect('/admin/x-buzz')
}

export async function holdXBuzzUrl(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  const holdReason = String(formData.get('hold_reason') ?? '').trim() || null
  if (!id) redirect('/admin/x-buzz?error=不正な操作です')

  const admin = createAdminClient()
  const { error } = await admin
    .from('x_buzz_queue')
    .update({
      status: 'hold',
      hold_reason: holdReason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .neq('status', 'published')

  if (error) redirectWithResult({ error: error.message })

  revalidatePath('/admin/x-buzz')
  redirect('/admin/x-buzz')
}

export async function publishOneXBuzzUrl() {
  await requireAdmin()
  const result = await publishXBuzzQueueItem()
  if (result.status === 'published') {
    redirectWithResult({ published: result.threadId })
  }
  if (result.status === 'skipped') {
    redirectWithResult({ error: result.reason === 'no_pending_url' ? 'pendingのURLがありません' : result.reason })
  }
  if (result.status === 'error') {
    redirectWithResult({ error: result.error })
  }
  redirectWithResult({ error: 'unknown_result' })
}

export async function publishSelectedXBuzzUrl(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!id) redirect('/admin/x-buzz?error=不正な操作です')

  const result = await publishXBuzzQueueItem(id)
  if (result.status === 'published') {
    redirectWithResult({ published: result.threadId })
  }
  if (result.status === 'skipped') {
    redirectWithResult({ error: result.reason })
  }
  if (result.status === 'error') {
    redirectWithResult({ error: result.error })
  }
  redirectWithResult({ error: 'unknown_result' })
}
