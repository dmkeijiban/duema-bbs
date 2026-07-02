'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { cookies, headers } from 'next/headers'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { hasJapanese, validateCommentBody } from '@/lib/spam'
import { v4 as uuidv4 } from 'uuid'
import { uploadImage, validateImageFile } from '@/lib/upload'
import { sendPushNotifications } from '@/app/actions/push-subscription'
import { notifyNewThread } from '@/lib/discord'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { checkModerationBan, checkNgWords, checkPostingBan, checkSessionBan, hashModerationValue } from '@/lib/moderation'
import { getThreadCommentClosedMessage } from '@/lib/thread-auto-close'
import { checkSessionRateLimit, checkValueRateLimit } from '@/lib/rate-limit'

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

async function getActiveProfileUserId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData.user

  if (userError || !user) return null

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, profile_hidden, account_suspended, withdrawn_at')
    .eq('id', user.id)
    .maybeSingle()

  if (
    profileError ||
    !profile ||
    profile.profile_hidden ||
    profile.account_suspended ||
    profile.withdrawn_at
  ) {
    return null
  }

  return user.id
}

async function getAuthenticatedUserId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user.id
}

async function getIpHash(): Promise<string | null> {
  const headerStore = await headers()
  const forwardedFor = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = headerStore.get('x-real-ip')?.trim()
  const candidate = forwardedFor || realIp
  return candidate ? hashModerationValue(candidate) : null
}

function isMissingColumn(error: { code?: string; message?: string } | null, column: string) {
  return error?.code === '42703' || Boolean(error?.message?.includes(column))
}

type PostTargetThread = {
  id: number
  title?: string
  body?: string
  post_count?: number
  is_archived: boolean
  comment_locked?: boolean
  auto_lock_exempt?: boolean
  created_at?: string
  category_id?: number | null
  categories?: { name?: string | null; slug?: string | null } | { name?: string | null; slug?: string | null }[] | null
}

type PostTiming = {
  startedAt: number
  previous: number
  steps: Record<string, number>
  milestones: Record<string, number>
}

function shouldExposePostTiming() {
  return process.env.POST_TIMING_LOGS === '1' || process.env.VERCEL_ENV !== 'production'
}

function createPostTiming(): PostTiming {
  const now = performance.now()
  return {
    startedAt: now,
    previous: now,
    steps: {},
    milestones: {},
  }
}

function markPostTiming(timing: PostTiming, step: string) {
  const now = performance.now()
  timing.steps[step] = Math.round(now - timing.previous)
  timing.milestones[step] = Math.round(now - timing.startedAt)
  timing.previous = now
}

function getPostTimingPayload(timing: PostTiming) {
  return {
    total_ms: Math.round(performance.now() - timing.startedAt),
    steps_ms: timing.steps,
    milestones_ms: timing.milestones,
  }
}

async function hasSupabaseAuthCookie() {
  const cookieStore = await cookies()
  return cookieStore.getAll().some(cookie =>
    cookie.name.startsWith('sb-') &&
    cookie.name.includes('auth-token') &&
    cookie.value.length > 0
  )
}

async function getPostAuthContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  timing: PostTiming,
) {
  if (!(await hasSupabaseAuthCookie())) {
    markPostTiming(timing, 'auth_cookie_skip')
    return { authUserId: null, activeProfileUserId: null }
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  markPostTiming(timing, 'auth_get_user')
  const user = userData.user
  if (userError || !user) return { authUserId: null, activeProfileUserId: null }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, profile_hidden, account_suspended, withdrawn_at')
    .eq('id', user.id)
    .maybeSingle()
  markPostTiming(timing, 'profile_select')

  const activeProfileUserId = (
    !profileError &&
    profile &&
    !profile.profile_hidden &&
    !profile.account_suspended &&
    !profile.withdrawn_at
  )
    ? user.id
    : null

  return { authUserId: user.id, activeProfileUserId }
}

async function runPostAfterTasks(params: {
  threadId: number
  threadTitle: string | null
  postNumber: number
  imageUrl: string | null
  thumbnailUrl: string | null
}) {
  const startedAt = performance.now()
  let previous = startedAt
  const steps: Record<string, number> = {}
  const mark = (step: string) => {
    const now = performance.now()
    steps[step] = Math.round(now - previous)
    previous = now
  }

  try {
    const admin = createAdminClient()
    const { error: countError } = await admin.rpc('increment_post_count', { p_thread_id: params.threadId })
    if (countError) console.warn('increment_post_count failed:', countError.message)
    mark('increment_post_count')

    if (params.threadTitle) {
      sendPushNotifications(
        params.threadId,
        params.threadTitle,
        params.postNumber,
      ).catch(() => {})
    }
    mark('notification_enqueue')

    if (params.imageUrl) {
      const { data: th } = await admin
        .from('threads')
        .select('image_url')
        .eq('id', params.threadId)
        .single()
      mark('thumbnail_select')

      if (!th?.image_url) {
        const updateData = params.thumbnailUrl
          ? { image_url: params.imageUrl, thumbnail_url: params.thumbnailUrl }
          : { image_url: params.imageUrl }
        await admin.from('threads').update(updateData).eq('id', params.threadId)
      }
      mark('thumbnail_update')
    } else {
      mark('thumbnail_skip')
    }

    revalidateTag('threads', { expire: 0 })
    revalidateTag('posts', { expire: 0 })
    mark('list_cache_revalidate')

    if (shouldExposePostTiming()) {
      console.log('[createPost after timing]', JSON.stringify({
        total_ms: Math.round(performance.now() - startedAt),
        steps_ms: steps,
      }))
    }
  } catch (error) {
    console.warn('Post after tasks failed:', error)
    if (shouldExposePostTiming()) {
      console.log('[createPost after timing]', JSON.stringify({
        status: 'failed',
        total_ms: Math.round(performance.now() - startedAt),
        steps_ms: steps,
      }))
    }
  }
}

async function checkPostRateLimits(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  ipHash: string | null,
) {
  const checks = [
    checkSessionRateLimit(supabase, {
      table: 'posts',
      sessionId,
      windowSeconds: 60,
      minIntervalSeconds: 8,
      maxInWindow: 5,
      label: 'レス',
    }),
    checkSessionRateLimit(supabase, {
      table: 'posts',
      sessionId,
      windowSeconds: 600,
      minIntervalSeconds: 0,
      maxInWindow: 15,
      label: 'レス',
    }),
  ]

  if (ipHash) {
    checks.push(
      checkValueRateLimit(supabase, {
        table: 'posts',
        column: 'ip_hash',
        value: ipHash,
        windowSeconds: 60,
        minIntervalSeconds: 0,
        maxInWindow: 5,
        label: '同じ回線からのレス',
      }),
      checkValueRateLimit(supabase, {
        table: 'posts',
        column: 'ip_hash',
        value: ipHash,
        windowSeconds: 600,
        minIntervalSeconds: 0,
        maxInWindow: 15,
        label: '同じ回線からのレス',
      }),
    )
  }

  for (const result of await Promise.all(checks)) {
    if (result) return result
  }
  return null
}

export async function createThread(formData: FormData) {
  if (hasHoneypotValue(formData)) return { error: '投稿に失敗しました' }

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

  // 管理者専用カテゴリの保護（フロントを迂回したリクエストをブロック）
  if (categoryId) {
    const { data: cat } = await supabase
      .from('categories')
      .select('name')
      .eq('id', parseInt(categoryId))
      .single()
    const ADMIN_ONLY = ['管理者連絡']
    if (cat && ADMIN_ONLY.includes(cat.name)) {
      const cookieStore = await cookies()
      const isAdmin = verifyAdminCookie(cookieStore.get('admin_auth')?.value)
      if (!isAdmin) return { error: 'このカテゴリは管理者のみ使用できます' }
    }
  }

  const sessionId = await getOrCreateSessionId()
  const authUserId = await getAuthenticatedUserId(supabase)
  const userId = await getActiveProfileUserId(supabase)
  if (await checkPostingBan({ sessionId, userId: authUserId })) {
    return { error: 'Posting is restricted.' }
  }
  const ngWord = await checkNgWords(supabase, [title, body, authorName])
  if (ngWord) {
    return { error: `NG word detected: ${ngWord}` }
  }

  let imageUrl: string | null = null
  let thumbnailUrl: string | null = null
  let imageWidth: number | null = null
  let imageHeight: number | null = null

  if (imageFile && imageFile.size > 0) {
    const validErr = validateImageFile(imageFile)
    if (validErr) return { error: validErr }

    const result = await uploadImage(imageFile, supabase, `threads/${uuidv4()}`, 'post', { createListThumbnail: true })
    if (result.error || !result.data) return { error: result.error ?? '画像のアップロードに失敗しました' }
    imageUrl = result.data.url
    thumbnailUrl = result.data.thumbnailUrl
    imageWidth = result.data.width || null
    imageHeight = result.data.height || null
  }

  const insertData = {
    title,
    body,
    author_name: authorName,
    category_id: categoryId ? parseInt(categoryId) : null,
    image_url: imageUrl,
    thumbnail_url: thumbnailUrl,
    image_width: imageWidth,
    image_height: imageHeight,
    session_id: sessionId,
    user_id: userId,
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
      .insert({
        title,
        body,
        author_name: authorName,
        category_id: categoryId ? parseInt(categoryId) : null,
        image_url: imageUrl,
        thumbnail_url: thumbnailUrl,
        session_id: sessionId,
        user_id: userId,
      })
      .select('id')
      .single()
    thread = t2
    error = e2
  }

  // session_id カラムが未作成の場合はなしで再試行
  if (error && (error.code === '42703' || error.message?.includes('session_id'))) {
    const { data: t3, error: e3 } = await supabase
      .from('threads')
      .insert({
        title,
        body,
        author_name: authorName,
        category_id: categoryId ? parseInt(categoryId) : null,
        image_url: imageUrl,
        thumbnail_url: thumbnailUrl,
        user_id: userId,
      })
      .select('id')
      .single()
    thread = t3
    error = e3
  }

  // Retry without user_id only when the column truly does not exist (42703).
  // Previously this also matched any error whose message contained "user_id",
  // which could silently re-insert without user_id and produce user_id=null.
  if (error && error.code === '42703') {
    const { data: t4, error: e4 } = await supabase
      .from('threads')
      .insert({
        title,
        body,
        author_name: authorName,
        category_id: categoryId ? parseInt(categoryId) : null,
        image_url: imageUrl,
        thumbnail_url: thumbnailUrl,
        session_id: sessionId,
      })
      .select('id')
      .single()
    thread = t4
    error = e4
  }

  if (error || !thread) {
    console.error('Thread insert error:', error)
    return { error: 'スレッドの作成に失敗しました' }
  }

  // Discord 通知（失敗してもスレッド作成はブロックしない）
  if (categoryId) {
    const { data: cat } = await supabase
      .from('categories')
      .select('name')
      .eq('id', parseInt(categoryId))
      .single()
    notifyNewThread({ threadId: thread.id, title, categoryName: cat?.name ?? null }).catch(() => {})
  } else {
    notifyNewThread({ threadId: thread.id, title, categoryName: null }).catch(() => {})
  }

  revalidatePath('/')
  revalidateTag('threads', { expire: 0 })
  redirect(`/thread/${thread.id}`)
}

export async function createPost(formData: FormData) {
  const timing = createPostTiming()
  if (hasHoneypotValue(formData)) return { error: '投稿に失敗しました' }

  const threadId = parseInt(formData.get('thread_id') as string)
  const body = ((formData.get('body') as string) ?? '').trim()
  const authorName = (formData.get('author_name') as string)?.trim() || '名無しのデュエリスト'
  const imageFile = formData.get('image') as File | null
  if (!threadId) return { error: 'スレッドIDが無効です' }
  const spamCheck = validateCommentBody(body ?? '')
  if (!spamCheck.ok) return { error: spamCheck.error ?? '投稿内容を確認してください' }

  if (!hasJapanese(body)) {
    return { error: '日本語を含めてください（スパム対策）' }
  }
  markPostTiming(timing, 'validation')

  const supabase = await createClient()
  markPostTiming(timing, 'supabase_client')

  const threadResult = await supabase
    .from('threads')
    .select('id, title, body, post_count, is_archived, comment_locked, auto_lock_exempt, created_at, category_id, categories(name,slug)')
    .eq('id', threadId)
    .single()
  let targetThread = threadResult.data as PostTargetThread | null
  let threadError = threadResult.error

  if (isMissingColumn(threadError, 'comment_locked') || isMissingColumn(threadError, 'auto_lock_exempt')) {
    const retry = await supabase
      .from('threads')
      .select('id, title, body, post_count, is_archived, comment_locked, created_at, category_id, categories(name,slug)')
      .eq('id', threadId)
      .single()
    targetThread = retry.data as PostTargetThread | null
    threadError = retry.error
  }
  if (isMissingColumn(threadError, 'comment_locked')) {
    const retry = await supabase
      .from('threads')
      .select('id, title, body, post_count, is_archived, created_at, category_id, categories(name,slug)')
      .eq('id', threadId)
      .single()
    targetThread = retry.data as PostTargetThread | null
    threadError = retry.error
  }
  markPostTiming(timing, 'thread_check')

  if (threadError || !targetThread) return { error: 'スレッドが見つかりません' }
  if (targetThread.is_archived) return { error: 'このスレッドは過去ログです。コメントはできません。' }
  const closedMessage = getThreadCommentClosedMessage(targetThread)
  if (closedMessage) return { error: closedMessage }

  const sessionId = await getOrCreateSessionId()
  markPostTiming(timing, 'session_cookie')
  const { authUserId, activeProfileUserId: userId } = await getPostAuthContext(supabase, timing)
  const ipHash = await getIpHash()
  markPostTiming(timing, 'ip_hash')

  const [
    postingBanned,
    sessionBanned,
    ipBanned,
    ngWord,
    rateLimitError,
  ] = await Promise.all([
    checkPostingBan({ sessionId, userId: authUserId }),
    checkSessionBan(supabase, sessionId),
    checkModerationBan(supabase, 'ip_hash', ipHash),
    checkNgWords(supabase, [body, authorName]),
    checkPostRateLimits(supabase, sessionId, ipHash),
  ])
  markPostTiming(timing, 'moderation_parallel_checks')

  if (postingBanned) {
    return { error: 'Posting is restricted.' }
  }
  if (sessionBanned) {
    return { error: 'この端末からの投稿は制限されています。' }
  }
  if (ipBanned) {
    return { error: 'この回線からの投稿は一時的に制限されています。' }
  }
  if (ngWord) {
    return { error: `NG word detected: ${ngWord}` }
  }
  if (rateLimitError) return { error: rateLimitError }

  const { data: maxPost } = await supabase
    .from('posts')
    .select('post_number')
    .eq('thread_id', threadId)
    .order('post_number', { ascending: false })
    .limit(1)
    .single()

  const nextPostNumber = (maxPost?.post_number ?? 0) + 1
  markPostTiming(timing, 'max_post_number')

  let imageUrl: string | null = null
  let thumbnailUrl: string | null = null
  let imageWidth: number | null = null
  let imageHeight: number | null = null

  if (imageFile && imageFile.size > 0) {
    const validErr = validateImageFile(imageFile)
    if (validErr) return { error: validErr }

    const result = await uploadImage(imageFile, supabase, `posts/${uuidv4()}`, 'post', { createListThumbnail: true })
    if (result.error || !result.data) return { error: result.error ?? '画像のアップロードに失敗しました' }
    imageUrl = result.data.url
    thumbnailUrl = result.data.thumbnailUrl
    imageWidth = result.data.width || null
    imageHeight = result.data.height || null
  }
  markPostTiming(timing, imageUrl ? 'image_upload' : 'image_skip')

  let { error } = await supabase.from('posts').insert({
    thread_id: threadId,
    post_number: nextPostNumber,
    body,
    author_name: authorName,
    image_url: imageUrl,
    thumbnail_url: thumbnailUrl,
    image_width: imageWidth,
    image_height: imageHeight,
    session_id: sessionId,
    user_id: userId,
    ip_hash: ipHash,
  })

  // ip_hash カラムが未作成の場合はなしで再試行
  if (error && isMissingColumn(error, 'ip_hash')) {
    const { error: eIp } = await supabase.from('posts').insert({
      thread_id: threadId,
      post_number: nextPostNumber,
      body,
      author_name: authorName,
      image_url: imageUrl,
      thumbnail_url: thumbnailUrl,
      image_width: imageWidth,
      image_height: imageHeight,
      session_id: sessionId,
      user_id: userId,
    })
    error = eIp
  }

  // image_width/height カラムが未作成の場合はなしで再試行
  if (error && (error.code === '42703' || error.message?.includes('image_width'))) {
    const { error: e2 } = await supabase.from('posts').insert({
      thread_id: threadId,
      post_number: nextPostNumber,
      body,
      author_name: authorName,
      image_url: imageUrl,
      thumbnail_url: thumbnailUrl,
      session_id: sessionId,
      user_id: userId,
      ip_hash: ipHash,
    })
    error = e2
  }

  if (error && isMissingColumn(error, 'ip_hash')) {
    const { error: e2b } = await supabase.from('posts').insert({
      thread_id: threadId,
      post_number: nextPostNumber,
      body,
      author_name: authorName,
      image_url: imageUrl,
      thumbnail_url: thumbnailUrl,
      session_id: sessionId,
    })
    error = e2b
  }

  // session_id カラムが未作成の場合はなしで再試行
  if (error && (error.code === '42703' || error.message?.includes('session_id'))) {
    const { error: e3 } = await supabase.from('posts').insert({
      thread_id: threadId,
      post_number: nextPostNumber,
      body,
      author_name: authorName,
      image_url: imageUrl,
      thumbnail_url: thumbnailUrl,
      user_id: userId,
    })
    error = e3
  }

  // Retry without user_id only when the column truly does not exist (42703).
  // Previously this also matched any error whose message contained "user_id",
  // which could silently re-insert without user_id and produce user_id=null.
  if (error && error.code === '42703') {
    const { error: e4 } = await supabase.from('posts').insert({
      thread_id: threadId,
      post_number: nextPostNumber,
      body,
      author_name: authorName,
      image_url: imageUrl,
      thumbnail_url: thumbnailUrl,
      session_id: sessionId,
    })
    error = e4
  }

  if (error) {
    console.error('Post insert error:', error)
    return { error: 'コメントの投稿に失敗しました' }
  }
  markPostTiming(timing, 'posts_insert')

  revalidateTag(`thread-${threadId}`, { expire: 0 })
  markPostTiming(timing, 'thread_cache_revalidate')

  after(() => runPostAfterTasks({
    threadId,
    threadTitle: targetThread.title ?? null,
    postNumber: nextPostNumber,
    imageUrl,
    thumbnailUrl,
  }))

  if (shouldExposePostTiming()) {
    console.log('[createPost timing]', JSON.stringify({
      total_ms: Math.round(performance.now() - timing.startedAt),
      steps_ms: timing.steps,
      has_image: Boolean(imageUrl),
    }))
  }

  return {
    success: true,
    postNumber: nextPostNumber,
    debugTiming: getPostTimingPayload(timing),
  }
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
