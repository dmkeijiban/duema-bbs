'use client'

import { useState } from 'react'
import { Post, Thread, Category } from '@/types'
import { PostItem } from './PostItem'
import { NewPostForm } from './NewPostForm'
import { PostLikeButton } from './PostLikeButton'
import { ReportButton } from './ReportButton'
import { formatDateTimeJP } from '@/lib/utils'
import Link from 'next/link'

interface Props {
  posts: Post[]
  threadId: number
  thread: Thread & { categories: Category | null }
  isArchived: boolean
  page: number
  totalPages: number
  sessionId: string
  recommendSlot?: React.ReactNode
  threadRules?: string
  isAdmin?: boolean
}

type DisplayPost = Post & { displayNumber: number }

export function ThreadContent({ posts, threadId, thread, isArchived, page, totalPages, sessionId, recommendSlot, threadRules, isAdmin }: Props) {
  const [bodyValue, setBodyValue] = useState('')

  const handleAnchorClick = (displayNum: number) => {
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
  }

  const displayPosts: DisplayPost[] = posts.map(p => ({
    ...p,
    displayNumber: p.post_number + 1,
  }))

  const threadSessionId = (thread as Thread & { session_id?: string }).session_id ?? ''

  return (
    <>
      {/* OP post */}
      <div className="border border-gray-300 bg-white">
        <div id="post-1" className="border-b border-gray-200 last:border-b-0">
          <div className="px-2 py-1 text-xs flex items-center gap-1 flex-wrap" style={{ background: '#f5f5f5' }}>
            <button
              type="button"
              onClick={() => handleAnchorClick(1)}
              className="font-bold hover:underline cursor-pointer mr-0.5"
              style={{ color: '#0d6efd' }}
              title=">>1を本文に挿入"
            >
              ▶1
            </button>
            <span className="inline-block px-0.5 text-white text-[10px] leading-4" style={{ background: '#dc3545' }}>スレ主</span>
            <span className="font-medium text-gray-700">{thread.author_name}</span>
            <span className="text-gray-400 text-[10px]">{formatDateTimeJP(thread.created_at)}</span>
            <PostLikeButton likeKey={`thread-${thread.id}`} />
            <ReportButton itemType="thread" itemId={thread.id} itemBody={thread.body} />
          </div>
          <div className="px-3 py-3 text-sm text-gray-800 break-words leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
            {thread.body}
          </div>
          {thread.image_url && (
            <div className="px-3 pb-2">
              <a href={thread.image_url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thread.image_url}
                  alt="添付画像"
                  loading="lazy"
                  className="max-h-80 max-w-full object-contain hover:opacity-90 cursor-zoom-in"
                />
              </a>
            </div>
          )}
        </div>

        {/* Replies */}
        {displayPosts.map(post => (
          <PostItem
            key={post.id}
            post={post}
            allPosts={displayPosts as Post[]}
            onAnchorClick={handleAnchorClick}
            displayNumber={post.displayNumber}
            sessionId={sessionId}
            threadSessionId={threadSessionId}
            threadId={threadId}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1 py-2 mt-2 text-sm">
          {page > 1 && (
            <Link href={`/thread/${threadId}?page=${page - 1}`} className="px-3 py-1 border border-gray-300 text-blue-600 hover:bg-gray-50">
              前へ
            </Link>
          )}
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <Link
              key={p}
              href={p === 1 ? `/thread/${threadId}` : `/thread/${threadId}?page=${p}`}
              className="px-3 py-1 border text-sm"
              style={
                p === page
                  ? { background: '#0d6efd', color: '#fff', borderColor: '#0d6efd' }
                  : { borderColor: '#dee2e6', color: '#0d6efd' }
              }
            >
              {p}
            </Link>
          ))}
          {page < totalPages && (
            <Link href={`/thread/${threadId}?page=${page + 1}`} className="px-3 py-1 border border-gray-300 text-blue-600 hover:bg-gray-50">
              次へ
            </Link>
          )}
        </div>
      )}

      {/* オススメ（返信フォームの上） */}
      {recommendSlot && (
        <div className="mt-3">{recommendSlot}</div>
      )}

      {/* Reply form (bottom) */}
      {!isArchived && (
        <div id="reply-form-bottom" className="mt-3">
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
          このスレッドは過去ログです。レスできません。
        </div>
      )}

    </>
  )
}
