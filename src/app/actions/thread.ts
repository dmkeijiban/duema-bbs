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
import { ADMIN_COOKIE, verifyAdminCookie, verifyAdminRateLimitBypassToken } from '@/lib/admin-auth'
import { checkModerationBan, checkNgWords, checkPostingBan, hashModerationValue } from '@/lib/moderation'
import { getThreadCommentClosedMessage } from '@/lib/thread-auto-close'
import { checkValueRateLimitRules } from '@/lib/rate-limit'
import { validateInteractiveThreadUploadSize } from '@/lib/thread-poll-form'

function hasHoneypotValue(formData: FormData): boolean {
  const value = formData.get('website')
  return typeof value === 'string' && value.trim().length > 0
}

type InteractiveThreadOptionDraft = {
  label: string
  imageFile: File | null
  isCorrect: boolean
}

type InteractiveThreadDraft = {
  kind: 'poll' | 'quiz'
  options: InteractiveThreadOptionDraft[]
}

function parseInteractiveThreadDraft(formData: FormData):
  | { draft: InteractiveThreadDraft | null }
  | { error: string } {
  const rawKind = String(formData.get('thread_kind') ?? 'normal')
  if (rawKind === 'normal') return { draft: null }
  if (rawKind !== 'poll' && rawKind !== 'quiz') return { error: 'スレッド形式が無効です' }

  const optionCount = Number(formData.get('poll_option_count'))
  if (!Number.isInteger(optionCount) || optionCount < 2 || optionCount > 4) {
    return { error: '選択肢は2〜4個にしてください' }
  }

  const correctIndex = rawKind === 'quiz'
    ? Number(formData.get('quiz_correct_index'))
    : -1
  if (rawKind === 'quiz' && (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= optionCount)) {
    return { error: 'クイズの正解を1つ選んでください' }
  }

  const options: InteractiveThreadOptionDraft[] = []
  const normalizedLabels = new Set<string>()
  for (let index = 0; index < optionCount; index += 1) {
    const label = String(formData.get(`poll_option_label_${index}`) ?? '').trim()
    if (!label || label.length > 60) return { error: `選択肢${index + 1}は60文字以内で入力してください` }

    const normalizedLabel = label.normalize('NFKC').toLowerCase()
    if (normalizedLabels.has(normalizedLabel)) return { error: '同じ選択肢は設定できません' }
    normalizedLabels.add(normalizedLabel)

    const value = formData.get(`poll_option_image_${index}`)
    const imageFile = value instanceof File && value.size > 0 ? value : null
    if (imageFile) {
      const validationError = validateImageFile(imageFile)
      if (validationError) return { error: `選択肢${index + 1}：${validationError}` }
    }

    options.push({
      label,
      imageFile,
      isCorrect: rawKind === 'quiz' && correctIndex === index,
    })
  }

  return { draft: { kind: rawKind, options } }
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

async function isCurrentAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(ADMIN_COOKIE)?.value
  if (verifyAdminCookie(cookieValue)) return true

  const headerStore = await headers()
  const rawCookie = headerStore.get('cookie') ?? ''
  const headerCookieValue = rawCookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${ADMIN_COOKIE}=`))
    ?.slice(ADMIN_COOKIE.length + 1)

  if (!headerCookieValue) return false
  try {
    return verifyAdminCookie(decodeURIComponent(headerCookieValue))
  } catch {
    return verifyAdminCookie(headerCookieValue)
  }
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
  last_posted_at?: string | null
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

    revalidateTag(`thread-${params.threadId}`, { expire: 0 })
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
    checkValueRateLimitRules(supabase, {
      table: 'posts',
      column: 'session_id',
      value: sessionId,
      rules: [
        {
          windowSeconds: 60,
          minIntervalSeconds: 8,
          maxInWindow: 5,
          label: 'レス',
        },
        {
          windowSeconds: 600,
          minIntervalSeconds: 0,
          maxInWindow: 15,
          label: 'レス',
        },
      ],
    }),
  ]

  if (ipHash) {
    checks.push(
      checkValueRateLimitRules(supabase, {
        table: 'posts',
        column: 'ip_hash',
        value: ipHash,
        rules: [
          {
            windowSeconds: 60,
            minIntervalSeconds: 0,
            maxInWindow: 5,
            label: '同じ回線からのレス',
          },
          {
            windowSeconds: 600,
            minIntervalSeconds: 0,
            maxInWindow: 15,
            label: '同じ回線からのレス',
          },
        ],
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
  const uploadSizeError = validateInteractiveThreadUploadSize(formData)
  if (uploadSizeError) return { error: uploadSizeError }

  const title = (formData.get('title') as string)?.trim()
  const body = (formData.get('body') as string)?.trim()
  const authorName = (formData.get('author_name') as string)?.trim() || '名無しのデュエリスト'
  const categoryId = formData.get('category_id') as string
  const imageFile = formData.get('image') as File | null
  const interactiveResult = parseInteractiveThreadDraft(formData)
  if ('error' in interactiveResult) return { error: interactiveResult.error }
  const interactiveDraft = interactiveResult.draft
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
      const isAdmin = await isCurrentAdmin()
      if (!isAdmin) return { error: 'このカテゴリは管理者のみ使用できます' }
    }
  }

  const sessionId = await getOrCreateSessionId()
  const authUserId = await getAuthenticatedUserId(supabase)
  const userId = await getActiveProfileUserId(supabase)
  if (await checkPostingBan({ sessionId, userId: authUserId })) {
    return { error: 'Posting is restricted.' }
  }
  const ngWord = await checkNgWords(supabase, [
    title,
    body,
    authorName,
    ...(interactiveDraft?.options.map(option => option.label) ?? []),
  ])
  if (ngWord) {
    return { error: `NG word detected: ${ngWord}` }
  }

  if (interactiveDraft) {
    const admin = createAdminClient()
    const { error: featureError } = await admin
      .from('thread_polls')
      .select('thread_id', { head: true })
      .limit(1)
    if (featureError) return { error: '投票・クイズ機能は現在準備中です' }
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

  const interactiveOptions = interactiveDraft
    ? await Promise.all(interactiveDraft.options.map(async option => {
        if (!option.imageFile) {
          return { label: option.label, image_url: null, is_correct: option.isCorrect }
        }
        const result = await uploadImage(
          option.imageFile,
          supabase,
          `thread-polls/${uuidv4()}`,
          'thumbnail',
        )
        if (result.error || !result.data) throw new Error(result.error ?? '選択肢画像のアップロードに失敗しました')
        return { label: option.label, image_url: result.data.url, is_correct: option.isCorrect }
      }).map(task => task.catch(error => ({ uploadError: error instanceof Error ? error.message : '選択肢画像のアップロードに失敗しました' }))))
    : null

  const optionUploadError = interactiveOptions?.find(
    (option): option is { uploadError: string } => 'uploadError' in option,
  )
  if (optionUploadError) return { error: optionUploadError.uploadError }

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

  let thread: { id: number } | null = null
  let error: { code?: string; message?: string } | null = null

  if (interactiveDraft && interactiveOptions) {
    const admin = createAdminClient()
    const rpcResult = await admin.rpc('create_interactive_thread', {
      p_title: title,
      p_body: body,
      p_author_name: authorName,
      p_category_id: categoryId ? parseInt(categoryId) : null,
      p_image_url: imageUrl,
      p_thumbnail_url: thumbnailUrl,
      p_image_width: imageWidth,
      p_image_height: imageHeight,
      p_session_id: sessionId,
      p_user_id: userId,
      p_kind: interactiveDraft.kind,
      p_options: interactiveOptions,
    })
    if (rpcResult.data !== null && rpcResult.data !== undefined) {
      thread = { id: Number(rpcResult.data) }
    }
    error = rpcResult.error
  } else {
    const insertResult = await supabase
      .from('threads')
      .insert(insertData)
      .select('id')
      .single()
    thread = insertResult.data
    error = insertResult.error
  }

  // image_width/height カラムが未作成の場合はなしで再試行
  if (!interactiveDraft && error && (error.code === '42703' || error.message?.includes('image_width'))) {
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
  if (!interactiveDraft && error && (error.code === '42703' || error.message?.includes('session_id'))) {
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
  if (!interactiveDraft && error && error.code === '42703') {
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
    if (interactiveDraft && (error?.code === 'PGRST202' || error?.code === '42P01')) {
      return { error: '投票・クイズ機能は現在準備中です' }
    }
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
  const adminRateLimitToken = formData.get('admin_rate_limit_token') as string | null
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
    .select('id, title, body, post_count, is_archived, comment_locked, auto_lock_exempt, created_at, last_posted_at, category_id, categories(name,slug)')
    .eq('id', threadId)
    .single()
  let targetThread = threadResult.data as PostTargetThread | null
  let threadError = threadResult.error

  if (isMissingColumn(threadError, 'comment_locked') || isMissingColumn(threadError, 'auto_lock_exempt')) {
    const retry = await supabase
      .from('threads')
      .select('id, title, body, post_count, is_archived, comment_locked, created_at, last_posted_at, category_id, categories(name,slug)')
      .eq('id', threadId)
      .single()
    targetThread = retry.data as PostTargetThread | null
    threadError = retry.error
  }
  if (isMissingColumn(threadError, 'comment_locked')) {
    const retry = await supabase
      .from('threads')
      .select('id, title, body, post_count, is_archived, created_at, last_posted_at, category_id, categories(name,slug)')
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
  const isAdmin = await isCurrentAdmin()
  const hasAdminRateLimitBypass = isAdmin || verifyAdminRateLimitBypassToken(adminRateLimitToken, threadId)
  markPostTiming(timing, 'admin_rate_limit_bypass_check')

  const [
    postingBanned,
    ipBanned,
    ngWord,
    rateLimitError,
  ] = await Promise.all([
    checkPostingBan({ sessionId, userId: authUserId }),
    checkModerationBan(supabase, 'ip_hash', ipHash),
    checkNgWords(supabase, [body, authorName]),
    hasAdminRateLimitBypass ? Promise.resolve(null) : checkPostRateLimits(supabase, sessionId, ipHash),
  ])
  markPostTiming(timing, 'moderation_parallel_checks')

  if (postingBanned) {
    return { error: 'Posting is restricted.' }
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

  const postSelectWithOptionalColumns = 'id, thread_id, post_number, body, author_name, user_id, image_url, thumbnail_url, session_id, ip_hash, created_at, is_deleted, deleted_by, deleted_at'
  const postSelectWithoutIpHash = 'id, thread_id, post_number, body, author_name, user_id, image_url, thumbnail_url, session_id, created_at, is_deleted, deleted_by, deleted_at'
  const postSelectWithoutSession = 'id, thread_id, post_number, body, author_name, user_id, image_url, thumbnail_url, created_at, is_deleted, deleted_by, deleted_at'
  let insertedPost: Record<string, unknown> | null = null

  const { data: postData, error: initialInsertError } = await supabase.from('posts').insert({
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
  }).select(postSelectWithOptionalColumns).single()
  insertedPost = postData as Record<string, unknown> | null
  let error = initialInsertError

  // ip_hash カラムが未作成の場合はなしで再試行
  if (error && isMissingColumn(error, 'ip_hash')) {
    const { data: retryPost, error: eIp } = await supabase.from('posts').insert({
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
    }).select(postSelectWithoutIpHash).single()
    insertedPost = retryPost as Record<string, unknown> | null
    error = eIp
  }

  // image_width/height カラムが未作成の場合はなしで再試行
  if (error && (error.code === '42703' || error.message?.includes('image_width'))) {
    const { data: retryPost, error: e2 } = await supabase.from('posts').insert({
      thread_id: threadId,
      post_number: nextPostNumber,
      body,
      author_name: authorName,
      image_url: imageUrl,
      thumbnail_url: thumbnailUrl,
      session_id: sessionId,
      user_id: userId,
      ip_hash: ipHash,
    }).select(postSelectWithOptionalColumns).single()
    insertedPost = retryPost as Record<string, unknown> | null
    error = e2
  }

  if (error && isMissingColumn(error, 'ip_hash')) {
    const { data: retryPost, error: e2b } = await supabase.from('posts').insert({
      thread_id: threadId,
      post_number: nextPostNumber,
      body,
      author_name: authorName,
      image_url: imageUrl,
      thumbnail_url: thumbnailUrl,
      session_id: sessionId,
    }).select(postSelectWithoutIpHash).single()
    insertedPost = retryPost as Record<string, unknown> | null
    error = e2b
  }

  // session_id カラムが未作成の場合はなしで再試行
  if (error && (error.code === '42703' || error.message?.includes('session_id'))) {
    const { data: retryPost, error: e3 } = await supabase.from('posts').insert({
      thread_id: threadId,
      post_number: nextPostNumber,
      body,
      author_name: authorName,
      image_url: imageUrl,
      thumbnail_url: thumbnailUrl,
      user_id: userId,
    }).select(postSelectWithoutSession).single()
    insertedPost = retryPost as Record<string, unknown> | null
    error = e3
  }

  // Retry without user_id only when the column truly does not exist (42703).
  // Previously this also matched any error whose message contained "user_id",
  // which could silently re-insert without user_id and produce user_id=null.
  if (error && error.code === '42703') {
    const { data: retryPost, error: e4 } = await supabase.from('posts').insert({
      thread_id: threadId,
      post_number: nextPostNumber,
      body,
      author_name: authorName,
      image_url: imageUrl,
      thumbnail_url: thumbnailUrl,
      session_id: sessionId,
    }).select(postSelectWithoutIpHash).single()
    insertedPost = retryPost as Record<string, unknown> | null
    error = e4
  }

  if (error || !insertedPost) {
    console.error('Post insert error:', error)
    return { error: 'コメントの投稿に失敗しました' }
  }
  markPostTiming(timing, 'posts_insert')

  markPostTiming(timing, 'thread_cache_revalidate_skipped')

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

  const debugTiming = shouldExposePostTiming() ? getPostTimingPayload(timing) : undefined

  return {
    success: true,
    postNumber: nextPostNumber,
    post: insertedPost,
    debugTiming,
    debugTimingJson: debugTiming ? JSON.stringify(debugTiming) : undefined,
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
