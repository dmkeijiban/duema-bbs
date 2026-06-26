'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Post, Thread, Category, PublicAuthorProfile } from '@/types'
import { PostItem, renderBody } from './PostItem'
import { NewPostForm } from './NewPostForm'
import { PostLikeButton } from './PostLikeButton'
import { ReportButton } from './ReportButton'
import { formatDateTimeJP, resolveImageUrl } from '@/lib/utils'
import { ImageViewer } from './ImageViewer'
import { getThreadViewerState } from '@/lib/thread-viewer-client'

const InlinePushSubscribeButton = dynamic(
  () => import('./PushSubscribeButton').then(mod => mod.PushSubscribeButton),
  { ssr: false },
)

interface Props {
  posts: Post[]
  threadId: number
  thread: Thread & { categories: Category | null }
  authorProfiles?: Record<string, PublicAuthorProfile>
  currentUserId?: string
  isArchived: boolean
  page: number
  totalPages: number
  recommendSlot?: React.ReactNode
  threadRules?: string
}

type DisplayPost = Post & { displayNumber: number }
const DEFAULT_AUTHOR_NAME = '名無しのデュエリスト'

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
}: {
  fallbackName: string
  profile?: PublicAuthorProfile
}) {
  if (!profile) {
    return <span className="font-medium text-gray-700">{fallbackName}</span>
  }

  if (!profile.profile_slug) {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-gray-600">
        <ThreadAvatar src={profile.avatar_url} alt={`${profile.display_name}のアイコン`} />
        <span>{profile.display_name}</span>
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
    </Link>
  )
}

export function ThreadContent({
  posts,
  threadId,
  thread,
  authorProfiles = {},
  currentUserId = '',
  isArchived,
  page,
  totalPages,
  recommendSlot,
  threadRules,
}: Props) {
  const [bodyValue, setBodyValue] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [viewerUserId, setViewerUserId] = useState(currentUserId)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let cancelled = false
    getThreadViewerState(threadId)
      .then(data => {
        if (cancelled) return
        setSessionId(data.sessionId)
        setViewerUserId(data.currentUserId)
        setIsAdmin(data.isAdmin)
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

  const displayPosts = useMemo<DisplayPost[]>(() => posts.map(post => {
    const profile = post.user_id ? authorProfiles[post.user_id] : undefined
    return {
      ...post,
      author_name: post.user_id
        ? (profile?.display_name ?? DEFAULT_AUTHOR_NAME)
        : post.author_name,
      displayNumber: post.post_number + 1,
    }
  }), [posts, authorProfiles])

  const threadSessionId = (thread as Thread & { session_id?: string }).session_id ?? ''
  const threadAuthorProfile = thread.user_id ? authorProfiles[thread.user_id] : undefined
  const threadAuthorFallbackName = thread.user_id && !threadAuthorProfile
    ? DEFAULT_AUTHOR_NAME
    : thread.author_name
  const threadBodyNodes = useMemo(
    () => renderBody(thread.body, displayPosts as Post[]),
    [thread.body, displayPosts]
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
            <ThreadAuthorName fallbackName={threadAuthorFallbackName} profile={threadAuthorProfile} />
            <span className="text-gray-400 text-[10px]">{formatDateTimeJP(thread.created_at)}</span>
            <PostLikeButton likeKey={`thread-${thread.id}`} />
            <ReportButton itemType="thread" itemId={thread.id} itemBody={thread.body} />
          </div>
          <div className="px-3 pt-1.5 pb-7 text-base text-gray-800 break-words leading-relaxed">
            {threadBodyNodes}
          </div>
          {thread.image_url && (
            <div className="px-3 pb-2">
              <ImageViewer src={resolveImageUrl(thread.image_url)!} alt={thread.title} priority />
            </div>
          )}
        </div>

        {displayPosts.map(post => (
          <PostItem
            key={post.id}
            post={post}
            allPosts={displayPosts as Post[]}
            onAnchorClick={handleAnchorClick}
            displayNumber={post.displayNumber}
            sessionId={sessionId}
            currentUserId={viewerUserId}
            threadSessionId={threadSessionId}
            threadId={threadId}
            authorProfile={post.user_id ? authorProfiles[post.user_id] : undefined}
          />
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

      {!isArchived && (
        <InlinePushSubscribeButton threadId={threadId} cta />
      )}

      {recommendSlot && (
        <div className="mt-3">{recommendSlot}</div>
      )}

      {!isArchived && (
        <div id="reply-form-bottom" className="mt-3 scroll-mt-20">
          <NewPostForm
            threadId={threadId}
            thread={thread}
            bodyValue={bodyValue}
            onBodyChange={setBodyValue}
            rules={threadRules}
            isAdmin={isAdmin}
          />
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
