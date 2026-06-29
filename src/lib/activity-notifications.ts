import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

type ViewerIdentity = {
  userId: string | null
  sessionId: string | null
}

type ThreadNotificationRow = {
  id: number
  title: string
  created_at: string | null
  last_posted_at: string | null
  user_id?: string | null
  session_id?: string | null
}

type PostNotificationRow = {
  id: number
  thread_id: number
  post_number: number | null
  created_at: string | null
  user_id: string | null
  session_id: string | null
}

export type ActivityNotification = {
  key: string
  type: 'own_thread_comment' | 'commented_thread_updated'
  title: string
  threadId: number
  href: string
  occurredAt: string | null
  label: string
}

function getPostHref(post: PostNotificationRow) {
  return post.post_number
    ? `/thread/${post.thread_id}#${post.post_number}`
    : `/thread/${post.thread_id}`
}

function isOwnPost(post: PostNotificationRow, identity: ViewerIdentity) {
  if (identity.userId) return post.user_id === identity.userId
  if (identity.sessionId) return post.session_id === identity.sessionId
  return false
}

function isOwnThread(thread: ThreadNotificationRow, identity: ViewerIdentity) {
  if (identity.userId) return thread.user_id === identity.userId
  if (identity.sessionId) return thread.session_id === identity.sessionId
  return false
}

function isAfter(value: string | null, baseline: string | null) {
  if (!value || !baseline) return false
  return new Date(value).getTime() > new Date(baseline).getTime()
}

function ownThreadLabel() {
  return '立てたスレッドが更新されました'
}

function commentedThreadLabel() {
  return 'コメントしたスレッドが更新されました'
}

function latestByThread(posts: PostNotificationRow[]) {
  const map = new Map<number, PostNotificationRow>()
  for (const post of posts) {
    const current = map.get(post.thread_id)
    if (!current) {
      map.set(post.thread_id, post)
      continue
    }
    if (new Date(post.created_at ?? 0).getTime() > new Date(current.created_at ?? 0).getTime()) {
      map.set(post.thread_id, post)
    }
  }
  return map
}

export async function getViewerIdentity(): Promise<ViewerIdentity> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('bbs_session')?.value ?? null

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return { userId: user?.id ?? null, sessionId }
  } catch {
    return { userId: null, sessionId }
  }
}

export async function getActivityNotifications(
  identity: ViewerIdentity,
  limit = 5
): Promise<ActivityNotification[]> {
  if (!identity.userId && !identity.sessionId) return []

  const admin = createAdminClient()
  const notifications: ActivityNotification[] = []

  let ownedThreadQuery = admin
    .from('threads')
    .select('id, title, created_at, last_posted_at, user_id, session_id')
    .eq('is_archived', false)
    .order('last_posted_at', { ascending: false })
    .limit(30)

  ownedThreadQuery = identity.userId
    ? ownedThreadQuery.eq('user_id', identity.userId)
    : ownedThreadQuery.eq('session_id', identity.sessionId as string)

  const { data: ownedThreads, error: ownedThreadError } = await ownedThreadQuery
  if (ownedThreadError) {
    console.error('Failed to fetch notification owned threads:', ownedThreadError.message)
  }

  const ownedThreadRows = (ownedThreads ?? []) as ThreadNotificationRow[]
  const ownedThreadMap = new Map(ownedThreadRows.map(thread => [thread.id, thread]))
  const ownedThreadIds = ownedThreadRows.map(thread => thread.id)

  if (ownedThreadIds.length > 0) {
    const { data: ownedThreadPosts, error: ownedPostError } = await admin
      .from('posts')
      .select('id, thread_id, post_number, created_at, user_id, session_id')
      .in('thread_id', ownedThreadIds)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(100)

    if (ownedPostError) {
      console.error('Failed to fetch notification owned thread posts:', ownedPostError.message)
    }

    const latestPosts = latestByThread((ownedThreadPosts ?? []) as PostNotificationRow[])
    for (const [threadId, post] of latestPosts) {
      const thread = ownedThreadMap.get(threadId)
      if (!thread) continue
      if (isOwnPost(post, identity)) continue
      if (!isAfter(post.created_at, thread.created_at)) continue

      notifications.push({
        key: `own-thread-${thread.id}-${post.id}`,
        type: 'own_thread_comment',
        title: thread.title,
        threadId: thread.id,
        href: getPostHref(post),
        occurredAt: post.created_at,
        label: ownThreadLabel(),
      })
    }
  }

  let myPostQuery = admin
    .from('posts')
    .select('id, thread_id, post_number, created_at, user_id, session_id')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(100)

  myPostQuery = identity.userId
    ? myPostQuery.eq('user_id', identity.userId)
    : myPostQuery.eq('session_id', identity.sessionId as string)

  const { data: myPosts, error: myPostError } = await myPostQuery
  if (myPostError) {
    console.error('Failed to fetch notification viewer posts:', myPostError.message)
  }

  const latestViewerPostByThread = latestByThread((myPosts ?? []) as PostNotificationRow[])
  const commentedThreadIds = Array.from(latestViewerPostByThread.keys()).filter(
    threadId => !ownedThreadMap.has(threadId)
  )

  if (commentedThreadIds.length > 0) {
    const [{ data: commentedThreads, error: commentedThreadError }, { data: latestThreadPosts, error: latestPostError }] = await Promise.all([
      admin
        .from('threads')
        .select('id, title, created_at, last_posted_at, user_id, session_id')
        .in('id', commentedThreadIds)
        .eq('is_archived', false),
      admin
        .from('posts')
        .select('id, thread_id, post_number, created_at, user_id, session_id')
        .in('thread_id', commentedThreadIds)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    if (commentedThreadError) {
      console.error('Failed to fetch notification commented threads:', commentedThreadError.message)
    }
    if (latestPostError) {
      console.error('Failed to fetch notification latest posts:', latestPostError.message)
    }

    const threadMap = new Map(((commentedThreads ?? []) as ThreadNotificationRow[]).map(thread => [thread.id, thread]))
    const latestPostMap = latestByThread((latestThreadPosts ?? []) as PostNotificationRow[])

    for (const [threadId, viewerPost] of latestViewerPostByThread) {
      if (!commentedThreadIds.includes(threadId)) continue
      const thread = threadMap.get(threadId)
      const latestPost = latestPostMap.get(threadId)
      if (!thread || !latestPost) continue
      if (isOwnThread(thread, identity)) continue
      if (isOwnPost(latestPost, identity)) continue
      if (!isAfter(latestPost.created_at, viewerPost.created_at)) continue

      notifications.push({
        key: `commented-thread-${thread.id}-${latestPost.id}`,
        type: 'commented_thread_updated',
        title: thread.title,
        threadId: thread.id,
        href: getPostHref(latestPost),
        occurredAt: latestPost.created_at,
        label: commentedThreadLabel(),
      })
    }
  }

  return notifications
    .sort((a, b) => new Date(b.occurredAt ?? 0).getTime() - new Date(a.occurredAt ?? 0).getTime())
    .slice(0, limit)
}

export async function getViewerActivityNotifications(limit = 5) {
  const identity = await getViewerIdentity()
  return getActivityNotifications(identity, limit)
}
