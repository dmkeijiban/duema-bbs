import { revalidatePath, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { notifyNewThread } from '@/lib/discord'

export const X_BUZZ_TITLES = [
  'Xで話題のデュエマ投稿、みんなはどう思う？',
  'Xで盛り上がっていたデュエマネタについて',
  'このデュエマ投稿、掲示板民はどう見る？',
  'Xで反応が多かったデュエマ話題を語ろう',
  'Xで見かけたデュエマの話題、どう思う？',
  'デュエマ界隈で話題になっていた投稿について',
  'このXのデュエマ投稿、みんなの意見も聞きたい',
] as const

export const X_BUZZ_BODY_TEMPLATES = [
  `Xで話題になっていたデュエマ投稿です。
掲示板でもみんなの意見を聞きたいです。

{URL}`,
  `Xで見かけて気になったデュエマの話題です。
みんなはこれについてどう思いますか？

{URL}`,
  `Xで反応が多かったデュエマ投稿です。
掲示板でも語ってみませんか？

{URL}`,
  `デュエマ界隈で少し話題になっていた投稿です。
みんなの感想や意見も聞かせてください。

{URL}`,
  `Xで盛り上がっていたデュエマネタです。
掲示板側でも自由に語ってください。

{URL}`,
  `気になったデュエマ投稿を共有します。
この話題について、みんなはどう感じましたか？

{URL}`,
  `Xで見かけたデュエマの話題です。
関連する思い出や意見があれば、ぜひコメントしてください。

{URL}`,
] as const

export type XBuzzQueueStatus = 'pending' | 'processing' | 'published' | 'failed' | 'hold' | 'rejected'

type XBuzzQueueRow = {
  id: number
  source_url: string
  status: XBuzzQueueStatus
  thread_id: number | null
}

export type XBuzzPublishResult =
  | { status: 'published'; queueId: number; sourceUrl: string; threadId: number }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; queueId?: number; sourceUrl?: string; error: string }

const STATUS_URL_PATTERN = /^https:\/\/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})\/?$/i

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function shortenError(message: string): string {
  return message.length > 1000 ? `${message.slice(0, 1000)}...` : message
}

export function normalizeXStatusUrl(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }

  if (url.protocol !== 'https:') return null
  const candidate = `${url.protocol}//${url.hostname}${url.pathname}`
  const match = candidate.match(STATUS_URL_PATTERN)
  if (!match) return null

  const user = match[1].toLowerCase()
  const statusId = match[2]
  return `https://x.com/${user}/status/${statusId}`
}

async function getXBuzzCategory(
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ id: number | null; name: string | null }> {
  const { data } = await admin
    .from('categories')
    .select('id, name, slug')
    .order('sort_order', { ascending: true })

  const rows = (data ?? []) as Array<{ id: number; name: string; slug: string }>
  const category =
    rows.find((c) => c.name === 'その他') ??
    rows.find((c) => c.slug === 'casual') ??
    rows.find((c) => c.name === '雑談') ??
    null

  return { id: category?.id ?? null, name: category?.name ?? null }
}

export async function publishXBuzzQueueItem(queueId?: number): Promise<XBuzzPublishResult> {
  const admin = createAdminClient()

  const query = admin
    .from('x_buzz_queue')
    .select('id, source_url, status, thread_id')
    .order('created_at', { ascending: true })
    .limit(1)

  const { data: selected, error: selectError } = queueId
    ? await query.eq('id', queueId).maybeSingle()
    : await query.eq('status', 'pending').maybeSingle()

  if (selectError) return { status: 'error', error: `select: ${selectError.message}` }
  if (!selected) return { status: 'skipped', reason: queueId ? 'queue_not_found' : 'no_pending_url' }

  const row = selected as XBuzzQueueRow
  if (row.status === 'published' && row.thread_id) {
    return { status: 'skipped', reason: 'already_published' }
  }

  const { data: locked, error: lockError } = await admin
    .from('x_buzz_queue')
    .update({ status: 'processing', error_message: null, updated_at: new Date().toISOString() })
    .eq('id', row.id)
    .neq('status', 'published')
    .select('id, source_url, status, thread_id')
    .maybeSingle()

  if (lockError) return { status: 'error', queueId: row.id, sourceUrl: row.source_url, error: `lock: ${lockError.message}` }
  if (!locked) return { status: 'skipped', reason: 'already_processing_or_published' }

  const sourceUrl = (locked as XBuzzQueueRow).source_url
  const normalizedUrl = normalizeXStatusUrl(sourceUrl)
  if (!normalizedUrl) {
    const error = 'invalid_x_status_url'
    await admin
      .from('x_buzz_queue')
      .update({ status: 'failed', error_message: error, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    return { status: 'error', queueId: row.id, sourceUrl, error }
  }

  const title = pickRandom(X_BUZZ_TITLES)
  const body = pickRandom(X_BUZZ_BODY_TEMPLATES).replace('{URL}', normalizedUrl)

  try {
    const category = await getXBuzzCategory(admin)
    const { data: thread, error: insertError } = await admin
      .from('threads')
      .insert({
        title,
        body,
        category_id: category.id,
        author_name: '名無しのデュエリスト',
      })
      .select('id')
      .single()

    if (insertError || !thread) {
      const message = `thread: ${insertError?.message ?? 'unknown'}`
      await admin
        .from('x_buzz_queue')
        .update({ status: 'failed', error_message: shortenError(message), updated_at: new Date().toISOString() })
        .eq('id', row.id)
      return { status: 'error', queueId: row.id, sourceUrl, error: message }
    }

    const threadId = Number(thread.id)
    const { error: updateError } = await admin
      .from('x_buzz_queue')
      .update({
        status: 'published',
        thread_id: threadId,
        published_at: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    if (updateError) {
      return { status: 'error', queueId: row.id, sourceUrl, error: `queue-update: ${updateError.message}` }
    }

    revalidatePath('/')
    revalidatePath('/admin/x-buzz')
    revalidateTag('threads', { expire: 0 })

    await notifyNewThread({ threadId, title, categoryName: category.name })
    return { status: 'published', queueId: row.id, sourceUrl, threadId }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    await admin
      .from('x_buzz_queue')
      .update({ status: 'failed', error_message: shortenError(message), updated_at: new Date().toISOString() })
      .eq('id', row.id)
    return { status: 'error', queueId: row.id, sourceUrl, error: message }
  }
}
