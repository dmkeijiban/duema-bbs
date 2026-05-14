'use server'

import { cookies } from 'next/headers'
import { revalidatePath, revalidateTag } from 'next/cache'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from '@/lib/supabase-server'
import { hasJapanese } from '@/lib/spam'
import { checkNgWords, checkSessionBan } from '@/lib/moderation'

function hasHoneypotValue(formData: FormData): boolean {
  const value = formData.get('website')
  return typeof value === 'string' && value.trim().length > 0
}

async function getOrCreateSessionId(): Promise<string> {
  const cookieStore = await cookies()
  const existing = cookieStore.get('bbs_session')?.value
  if (existing) return existing
  const newId = uuidv4()
  cookieStore.set('bbs_session', newId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: 'lax',
  })
  return newId
}

export async function createSummaryComment(formData: FormData) {
  if (hasHoneypotValue(formData)) return { error: '投稿に失敗しました' }

  const summaryId = Number(formData.get('summary_id'))
  const slug = String(formData.get('slug') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  const authorName = String(formData.get('author_name') ?? '').trim() || '名無しさん'

  if (!summaryId || !slug) return { error: '記事が見つかりません' }
  if (body.length < 2) return { error: '本文は2文字以上で入力してください' }
  if (body.length > 3000) return { error: '本文は3000文字以内で入力してください' }
  if (authorName.length > 15) return { error: '名前は15文字以内で入力してください' }
  if (!hasJapanese(body)) return { error: '日本語を含めて投稿してください' }

  const supabase = await createClient()
  const sessionId = await getOrCreateSessionId()

  if (await checkSessionBan(supabase, sessionId)) {
    return { error: 'Posting is restricted.' }
  }
  const ngWord = await checkNgWords(supabase, [body, authorName])
  if (ngWord) return { error: `NG word detected: ${ngWord}` }

  const { count } = await supabase
    .from('summary_comments')
    .select('id', { count: 'exact', head: true })
    .eq('summary_id', summaryId)
    .eq('is_deleted', false)

  const { error } = await supabase.from('summary_comments').insert({
    summary_id: summaryId,
    comment_number: (count ?? 0) + 1,
    body,
    author_name: authorName,
    session_id: sessionId,
  })

  if (error) {
    console.error('Summary comment insert error:', error)
    return { error: '記事コメント機能のDB準備がまだです' }
  }

  revalidateTag('summaries', { expire: 0 })
  revalidatePath(`/summary/${slug}`)
  return { success: true }
}
