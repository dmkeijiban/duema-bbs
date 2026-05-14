'use server'

import { cookies } from 'next/headers'
import { revalidatePath, revalidateTag } from 'next/cache'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from '@/lib/supabase-server'
import { hasJapanese } from '@/lib/spam'
import { checkNgWords, checkSessionBan } from '@/lib/moderation'

const SUMMARY_COMMENT_PREFIX = '[summary-comment]'

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

  const commentThreadTitle = `${SUMMARY_COMMENT_PREFIX} ${slug}`
  const { data: existingThread, error: threadFetchError } = await supabase
    .from('threads')
    .select('id')
    .eq('title', commentThreadTitle)
    .maybeSingle()

  if (threadFetchError) {
    console.error('Summary comment thread fetch error:', threadFetchError)
    return { error: 'コメント欄の取得に失敗しました' }
  }

  let thread = existingThread

  if (!thread?.id) {
    const insertData = {
      title: commentThreadTitle,
      body: `Article comments for summary ${summaryId}`,
      author_name: '記事コメント',
      session_id: sessionId,
      is_archived: true,
    }

    let createResult = await supabase
      .from('threads')
      .insert(insertData)
      .select('id')
      .single()

    if (createResult.error && (createResult.error.code === '42703' || createResult.error.message?.includes('is_archived'))) {
      createResult = await supabase
        .from('threads')
        .insert({
          title: commentThreadTitle,
          body: `Article comments for summary ${summaryId}`,
          author_name: '記事コメント',
          session_id: sessionId,
        })
        .select('id')
        .single()
    }

    if (createResult.error || !createResult.data) {
      console.error('Summary comment thread create error:', createResult.error)
      return { error: 'コメント欄の作成に失敗しました' }
    }

    thread = createResult.data
  }

  const { data: maxPost } = await supabase
    .from('posts')
    .select('post_number')
    .eq('thread_id', thread.id)
    .order('post_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextPostNumber = (maxPost?.post_number ?? 0) + 1

  let { error } = await supabase.from('posts').insert({
    thread_id: thread.id,
    post_number: nextPostNumber,
    body,
    author_name: authorName,
    session_id: sessionId,
  })

  if (error && (error.code === '42703' || error.message?.includes('session_id'))) {
    const { error: retryError } = await supabase.from('posts').insert({
      thread_id: thread.id,
      post_number: nextPostNumber,
      body,
      author_name: authorName,
    })
    error = retryError
  }

  if (error) {
    console.error('Summary comment insert error:', error)
    return { error: 'コメントの投稿に失敗しました' }
  }

  await supabase.rpc('increment_post_count', { p_thread_id: thread.id })

  revalidateTag('summaries', { expire: 0 })
  revalidatePath(`/summary/${slug}`)
  return { success: true }
}
