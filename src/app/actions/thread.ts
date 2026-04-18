'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase-server'
import { hasJapanese } from '@/lib/spam'
import { v4 as uuidv4 } from 'uuid'
import { uploadImage, validateImageFile } from '@/lib/upload'

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

export async function createThread(formData: FormData) {
  const title = (formData.get('title') as string)?.trim()
  const body = (formData.get('body') as string)?.trim()
  const authorName = (formData.get('author_name') as string)?.trim() || '名無しのデュエリスト'
  const categoryId = formData.get('category_id') as string
  const imageFile = formData.get('image') as File | null

  if (!title || title.length < 2) return { error: 'タイトルは2文字以上で入力してください' }
  if (title.length > 100) return { error: 'タイトルは100文字以内で入力してください' }
  if (!body || body.length < 5) return { error: '本文は5文字以上で入力してください' }
  if (body.length > 5000) return { error: '本文は5000文字以内で入力してください' }

  if (!hasJapanese(title) && !hasJapanese(body)) {
    return { error: 'スレッドには日本語を含めてください（スパム対策）' }
  }

  const supabase = await createClient()

  let imageUrl: string | null = null
  let imageWidth: number | null = null
  let imageHeight: number | null = null

  if (imageFile && imageFile.size > 0) {
    const validErr = validateImageFile(imageFile)
    if (validErr) return { error: validErr }

    const result = await uploadImage(imageFile, supabase, uuidv4(), 'thumbnail')
    if (result.error || !result.data) return { error: result.error ?? '画像のアップロードに失敗しました' }
    imageUrl = result.data.url
    imageWidth = result.data.width || null
    imageHeight = result.data.height || null
  }

  const sessionId = await getOrCreateSessionId()

  const insertData = {
    title,
    body,
    author_name: authorName,
    category_id: categoryId ? parseInt(categoryId) : null,
    image_url: imageUrl,
    image_width: imageWidth,
    image_height: imageHeight,
    session_id: sessionId,
  }

  let { data: thread, error } = await supabase
    .from('threads')
    .insert(insertData)
    .select('id')
    .single()

  // image_width/height カラムが未作成の場合はなしで再試行
  if (error && (error.code === '42703' || error.message?.includes('image_width'))) {
    const { data: t2, error: e2 } = await supabase
      .from('threads')
      .insert({ title, body, author_name: authorName, category_id: categoryId ? parseInt(categoryId) : null, image_url: imageUrl, session_id: sessionId })
      .select('id')
      .single()
    thread = t2
    error = e2
  }

  // session_id カラムが未作成の場合はなしで再試行
  if (error && (error.code === '42703' || error.message?.includes('session_id'))) {
    const { data: t3, error: e3 } = await supabase
      .from('threads')
      .insert({ title, body, author_name: authorName, category_id: categoryId ? parseInt(categoryId) : null, image_url: imageUrl })
      .select('id')
      .single()
    thread = t3
    error = e3
  }

  if (error || !thread) {
    console.error('Thread insert error:', error)
    return { error: 'スレッドの作成に失敗しました' }
  }

  revalidatePath('/')
  revalidateTag('threads', { expire: 0 })
  redirect(`/thread/${thread.id}`)
}

export async function createPost(formData: FormData) {
  const threadId = parseInt(formData.get('thread_id') as string)
  const body = (formData.get('body') as string)?.trim()
  const authorName = (formData.get('author_name') as string)?.trim() || '名無しのデュエリスト'
  const imageFile = formData.get('image') as File | null

  if (!threadId) return { error: 'スレッドIDが無効です' }
  if (!body || body.length < 1) return { error: '本文を入力してください' }
  if (body.length > 3000) return { error: '本文は3000文字以内で入力してください' }

  if (!hasJapanese(body)) {
    return { error: '日本語を含めてください（スパム対策）' }
  }

  const supabase = await createClient()

  const { data: maxPost } = await supabase
    .from('posts')
    .select('post_number')
    .eq('thread_id', threadId)
    .order('post_number', { ascending: false })
    .limit(1)
    .single()

  const nextPostNumber = (maxPost?.post_number ?? 0) + 1

  let imageUrl: string | null = null
  let imageWidth: number | null = null
  let imageHeight: number | null = null

  if (imageFile && imageFile.size > 0) {
    const validErr = validateImageFile(imageFile)
    if (validErr) return { error: validErr }

    const result = await uploadImage(imageFile, supabase, `posts/${uuidv4()}`, 'post')
    if (result.error || !result.data) return { error: result.error ?? '画像のアップロードに失敗しました' }
    imageUrl = result.data.url
    imageWidth = result.data.width || null
    imageHeight = result.data.height || null
  }

  const sessionId = await getOrCreateSessionId()

  let { error } = await supabase.from('posts').insert({
    thread_id: threadId,
    post_number: nextPostNumber,
    body,
    author_name: authorName,
    image_url: imageUrl,
    image_width: imageWidth,
    image_height: imageHeight,
    session_id: sessionId,
  })

  // image_width/height カラムが未作成の場合はなしで再試行
  if (error && (error.code === '42703' || error.message?.includes('image_width'))) {
    const { error: e2 } = await supabase.from('posts').insert({
      thread_id: threadId,
      post_number: nextPostNumber,
      body,
      author_name: authorName,
      image_url: imageUrl,
      session_id: sessionId,
    })
    error = e2
  }

  // session_id カラムが未作成の場合はなしで再試行
  if (error && (error.code === '42703' || error.message?.includes('session_id'))) {
    const { error: e3 } = await supabase.from('posts').insert({
      thread_id: threadId,
      post_number: nextPostNumber,
      body,
      author_name: authorName,
      image_url: imageUrl,
    })
    error = e3
  }

  if (error) {
    console.error('Post insert error:', error)
    return { error: 'レスの投稿に失敗しました' }
  }

  await supabase.rpc('increment_post_count', { p_thread_id: threadId })

  revalidatePath(`/thread/${threadId}`)
  revalidatePath('/')
  return { success: true }
}

export async function toggleFavorite(threadId: number) {
  const sessionId = await getOrCreateSessionId()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('favorites')
    .select('id')
    .eq('session_id', sessionId)
    .eq('thread_id', threadId)
    .single()

  if (existing) {
    await supabase.from('favorites').delete().eq('id', existing.id)
    revalidatePath(`/thread/${threadId}`)
    return { favorited: false }
  } else {
    await supabase.from('favorites').insert({ session_id: sessionId, thread_id: threadId })
    revalidatePath(`/thread/${threadId}`)
    return { favorited: true }
  }
}

export async function incrementViewCount(threadId: number) {
  const supabase = await createClient()
  await supabase.rpc('increment_view_count', { thread_id: threadId })
}
