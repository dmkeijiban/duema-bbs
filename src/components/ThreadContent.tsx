'use client'

import { useEffect, useState, useMemo, useCallback, Fragment } from 'react'
import Link from 'next/link'
import { Post, Thread, Category, PublicAuthorProfile } from '@/types'
import { PostItem, renderBody } from './PostItem'
import { NewPostForm } from './NewPostForm'
import { ReportButton } from './ReportButton'
import { formatDateTimeJP, resolveImageUrl } from '@/lib/utils'
import { ImageViewer } from './ImageViewer'
import { getThreadViewerState } from '@/lib/thread-viewer-client'
import { HonorBadge } from './HonorBadge'
import type { HonorTitle } from '@/lib/honor-title'
import { ThreadPoll } from '@/components/ThreadPoll'
import type { ThreadPoll as ThreadPollData, ThreadPollKind } from '@/lib/thread-poll'

interface Props {
  posts: Post[]
  threadId: number
  thread: Thread & { categories: Category | null }
  starterImageUrl?: string | null
  authorProfiles?: Record<string, PublicAuthorProfile>
  honorTitles?: Record<string, HonorTitle>
  currentUserId?: string
  isArchived: boolean
  commentClosedMessage?: string | null
  page: number
  totalPages: number
  recommendSlot?: React.ReactNode
  threadRules?: string
  showAfterCommentThreadPrompt?: boolean
  showCommentFormHint?: boolean
  poll?: ThreadPollData | null
}

type DisplayPost = Post & { displayNumber: number }
type OptimisticPost = Post & {
  optimisticId?: string
  optimisticStatus?: 'sending'
}
type OptimisticDisplayPost = OptimisticPost & { displayNumber: number }

type OptimisticPostDraft = {
  body: string
  authorName: string
  imageUrl: string | null
}

function ThreadAvatar({ src, alt }: { src: string | null | undefined; alt: string }) {
  if (!src) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="h-4 w-4 shrink-0 rounded-full border border-gray-200 bg-gray-100 object-cover"
    />
  )
}

function ThreadAuthorName({
  fallbackName,
  profile,
  honorTitle,
}: {
  fallbackName: string
  profile?: PublicAuthorProfile
  honorTitle?: HonorTitle | null
}) {
  if (!profile) {
    return <span className="font-medium text-gray-700">{fallbackName}</span>
  }

  if (!profile.profile_slug) {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-gray-600">
        <ThreadAvatar src={profile.avatar_url} alt={`${profile.display_name}のアイコン`} />
        <span>{profile.display_name}</span>
        <HonorBadge title={honorTitle} />
      </span>
    )
  }

  return (
    <Link
      href={`/u/${profile.profile_slug}`}
      className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
    >
      <ThreadAvatar src={profile.avatar_url} alt={`${profile.display_name}のアイコン`} />
      <span>{profile.display_name}</span>
      <HonorBadge title={honorTitle} />
    </Link>
  )
}

export function ThreadContent({
  posts,
  threadId,
  thread,
  starterImageUrl = null,
  authorProfiles = {},
  honorTitles = {},
  currentUserId = '',
  isArchived,
  commentClosedMessage = null,
  page,
  totalPages,
  recommendSlot,
  threadRules,
  showAfterCommentThreadPrompt = true,
  showCommentFormHint = true,
  poll = null,
}: Props) {
  const [bodyValue, setBodyValue] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [viewerUserId, setViewerUserId] = useState(currentUserId)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminRateLimitToken, setAdminRateLimitToken] = useState<string | null>(null)
  const [optimisticPosts, setOptimisticPosts] = useState<OptimisticPost[]>([])
  const [justPostedId, setJustPostedId] = useState<number | null>(null)
  const [optimisticScrollTarget, setOptimisticScrollTarget] = useState<number | null>(null)

  useEffect(() => {
    if (optimisticScrollTarget === null) return

    const frame = requestAnimationFrame(() => {
      document
        .getElementById(`post-${optimisticScrollTarget}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setOptimisticScrollTarget(null)
    })

    return () => cancelAnimationFrame(frame)
  }, [optimisticScrollTarget])

  useEffect(() => {
    let cancelled = false
    getThreadViewerState(threadId)
      .then(data => {
        if (cancelled) return
        setSessionId(data.sessionId)
        setViewerUserId(data.currentUserId)
        setIsAdmin(data.isAdmin)
        setAdminRateLimitToken(data.adminRateLimitToken)
      })
    return () => {
      cancelled = true
    }
  }, [threadId])

  const handleAnchorClick = useCallback((displayNum: number) => {
    setBodyValue(prev => prev ? prev + `>>${displayNum}\n` : `>>${displayNum}\n`)
    const el = document.getElementById('reply-form-bottom')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setTimeout(() => {
        const ta = document.getElementById('reply-textarea') as HTMLTextAreaElement | null
        if (ta) {
          ta.focus()
          ta.setSelectionRange(ta.value.length, ta.value.length)
        }
      }, 400)
    }
  }, [])

  const handleWritePollReason = useCallback((label: string, kind: ThreadPollKind) => {
    const prompt = kind === 'quiz'
      ? `「${label}」と答えました。\n理由：`
      : `「${label}」を選びました。\n理由：`

    setBodyValue(current => {
      if (!current.trim()) return prompt

      const generatedPromptPattern = /^「.*?」(?:を選びました|と答えました)。\n理由：/
      if (generatedPromptPattern.test(current)) {
        return current.replace(generatedPromptPattern, prompt)
      }

      return current
    })

    const form = document.getElementById('reply-form-bottom')
    form?.scrollIntoView({ behavior: 'auto', block: 'start' })
    requestAnimationFrame(() => {
      const textarea = document.getElementById('reply-textarea') as HTMLTextAreaElement | null
      textarea?.focus()
      if (textarea) textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    })
  }, [])

  const displayPosts = useMemo<DisplayPost[]>(() => posts.map(post => ({
    ...post,
    displayNumber: post.post_number + 1,
  })), [posts])
  const visiblePosts = useMemo<OptimisticDisplayPost[]>(() => {
    const displayedPostIds = new Set(displayPosts.map(post => post.id))
    const displayedPostKeys = new Set(displayPosts.map(post => `${post.post_number}:${post.body}`))
    const optimisticDisplayPosts = optimisticPosts
      .filter(post => !displayedPostIds.has(post.id) && !displayedPostKeys.has(`${post.post_number}:${post.body}`))
      .map(post => ({
        ...post,
        displayNumber: post.post_number + 1,
      }))
    return [...displayPosts, ...optimisticDisplayPosts]
  }, [displayPosts, optimisticPosts])

  const addOptimisticPost = useCallback((draft: OptimisticPostDraft) => {
    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const lastPostNumber = Math.max(0, ...displayPosts.map(post => post.post_number), ...optimisticPosts.map(post => post.post_number))
    const authorName = draft.authorName.trim() || '名無しのデュエリスト'
    const optimisticPost: OptimisticPost = {
      id: -Date.now(),
      thread_id: threadId,
      post_number: lastPostNumber + 1,
      body: draft.body,
      author_name: authorName,
      user_id: null,
      session_id: sessionId || null,
      image_url: draft.imageUrl,
      thumbnail_url: null,
      created_at: new Date().toISOString(),
      is_deleted: false,
      deleted_by: null,
      deleted_at: null,
      optimisticId,
      optimisticStatus: 'sending',
    }
    setOptimisticPosts(current => [...current, optimisticPost])
    setOptimisticScrollTarget(optimisticPost.post_number + 1)
    return optimisticId
  }, [displayPosts, optimisticPosts, sessionId, threadId])

  const confirmOptimisticPost = useCallback((optimisticId: string, post: Post) => {
    setOptimisticPosts(current => current.map(item => (
      item.optimisticId === optimisticId ? post : item
    )))
    setJustPostedId(post.id)
  }, [])

  const removeOptimisticPost = useCallback((optimisticId: string) => {
    setOptimisticPosts(current => current.filter(post => post.optimisticId !== optimisticId))
  }, [])

  const threadAuthorProfile = thread.user_id ? authorProfiles[thread.user_id] : undefined
  const threadAuthorHonorTitle = thread.user_id ? honorTitles[thread.user_id] : undefined
  const threadBodyNodes = useMemo(
    () => renderBody(thread.body, visiblePosts as Post[]),
    [thread.body, visiblePosts]
  )

  return (
    <>
      <div className="border border-gray-300 bg-white">
        <div id="post-1" className="border-b border-gray-200 last:border-b-0 scroll-mt-20">
          <div className="px-2 py-1.5 text-xs flex items-center gap-1 flex-wrap" style={{ background: '#f5f5f5' }}>
            <button
              type="button"
              onClick={() => handleAnchorClick(1)}
              className="inline-flex items-center px-1.5 py-0.5 font-bold cursor-pointer border border-blue-300 bg-white hover:bg-blue-50 leading-none shrink-0 mr-1.5"
              style={{ color: '#0d6efd' }}
              title=">>1を本文に挿入"
            >
              ▶1
            </button>
            <span className="inline-block px-0.5 text-white text-[10px] leading-4" style={{ background: '#dc3545' }}>スレ主</span>
            <ThreadAuthorName fallbackName={thread.author_name} profile={threadAuthorProfile} honorTitle={threadAuthorHonorTitle} />
            <span className="text-gray-400 text-[10px]">{formatDateTimeJP(thread.created_at)}</span>
            <ReportButton itemType="thread" itemId={thread.id} itemBody={thread.body} />
          </div>
          <div className="px-3 pt-1.5 pb-7 text-base text-gray-800 break-words leading-relaxed">
            {threadBodyNodes}
          </div>
          {starterImageUrl && (
            <div className="px-3 pb-2">
              <ImageViewer src={resolveImageUrl(starterImageUrl)!} alt={thread.title} priority />
            </div>
          )}
          {poll && (
            <ThreadPoll threadId={threadId} poll={poll} onWriteReason={handleWritePollReason} />
          )}
        </div>

        {visiblePosts.map(post => (
          <Fragment key={post.optimisticId ?? post.id}>
            <PostItem
              post={post}
              allPosts={visiblePosts as Post[]}
              onAnchorClick={handleAnchorClick}
              displayNumber={post.displayNumber}
              sessionId={sessionId}
              currentUserId={viewerUserId}
              threadId={threadId}
              authorProfile={post.user_id ? authorProfiles[post.user_id] : undefined}
              honorTitle={post.user_id ? honorTitles[post.user_id] : undefined}
            />
            {post.id === justPostedId && showAfterCommentThreadPrompt && (
              <div
                className="px-3 py-2.5 text-sm text-gray-700 leading-snug border-b border-gray-200"
                style={{ background: '#eafaf1' }}
              >
                コメントありがとうございます！<br className="sm:hidden" />
                次はあなたの好きな話題でスレッド投稿してみよう！
              </div>
            )}
          </Fragment>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1 py-2 mt-2 text-sm">
          {page > 1 && (
            <Link href={page - 1 <= 1 ? `/thread/${threadId}` : `/thread/${threadId}/p/${page - 1}`} className="px-3 py-1 border border-gray-300 text-blue-600 hover:bg-gray-50">
              前へ
            </Link>
          )}
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNumber => (
            <Link
              key={pageNumber}
              href={pageNumber === 1 ? `/thread/${threadId}` : `/thread/${threadId}/p/${pageNumber}`}
              className="px-3 py-1 border text-sm"
              style={
                pageNumber === page
                  ? { background: '#0d6efd', color: '#fff', borderColor: '#0d6efd' }
                  : { borderColor: '#dee2e6', color: '#0d6efd' }
              }
            >
              {pageNumber}
            </Link>
          ))}
          {page < totalPages && (
            <Link href={`/thread/${threadId}/p/${page + 1}`} className="px-3 py-1 border border-gray-300 text-blue-600 hover:bg-gray-50">
              次へ
            </Link>
          )}
        </div>
      )}

      {recommendSlot && (
        <div className="mt-3">{recommendSlot}</div>
      )}

      {!isArchived && !commentClosedMessage && (
        <div id="reply-form-bottom" className="mt-3 scroll-mt-20">
          <NewPostForm
            threadId={threadId}
            thread={thread}
            bodyValue={bodyValue}
            onBodyChange={setBodyValue}
            onOptimisticPost={addOptimisticPost}
            onPostSucceeded={confirmOptimisticPost}
            onPostFailed={removeOptimisticPost}
            rules={threadRules}
            isAdmin={isAdmin}
            adminRateLimitToken={adminRateLimitToken}
            showFormHint={showCommentFormHint}
          />
        </div>
      )}

      {!isArchived && commentClosedMessage && (
        <div id="reply-form-bottom" className="mt-3 px-4 py-3 text-sm text-center text-gray-600 border border-gray-300 bg-white">
          {commentClosedMessage}
        </div>
      )}

      {isArchived && (
        <div className="mt-3 px-4 py-3 text-sm text-center text-gray-500 border border-gray-300 bg-white">
          このスレッドは過去ログです。コメントはできません。
        </div>
      )}
    </>
  )
}
