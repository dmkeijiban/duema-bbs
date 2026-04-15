'use client'

import { useState } from 'react'
import { Post, Thread, Category } from '@/types'
import { PostItem } from './PostItem'
import { NewPostForm } from './NewPostForm'
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
}

type DisplayPost = Post & { displayNumber: number }

export function ThreadContent({ posts, threadId, thread, isArchived, page, totalPages, sessionId, recommendSlot }: Props) {
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
          <div className="px-2 py-1 text-xs flex items-center gap-2 flex-wrap" style={{ background: '#f5f5f5' }}>
            <button
              type="button"
              onClick={() => handleAnchorClick(1)}
              className="font-bold hover:underline cursor-pointer"
              style={{ color: '#0d6efd' }}
              title=">>1を本文に挿入"
            >
              ▶1
            </button>
            <span className="inline-block px-1 text-white text-[10px]" style={{ background: '#dc3545' }}>OP</span>
            <span className="font-medium text-gray-700">{thread.author_name}</span>
            <span className="text-gray-400">{formatDateTimeJP(thread.created_at)}</span>
            <span className="text-[13px]" style={{ color: '#e8a0b0' }}>♡</span>
            <span className="text-[10px] px-1.5 py-0.5 font-medium" style={{ color: '#9ca3af', border: '1px solid #9ca3af' }}>報告</span>
          </div>
          <div className="px-3 py-2 text-sm text-gray-800 break-words leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
            {thread.body}
          </div>
          {thread.image_url && (
            <div className="px-3 pb-2">
              <a href={thread.image_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={thread.image_url}
                  alt="添付画像"
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
          />
        </div>
      )}

      {isArchived && (
        <div className="mt-3 px-4 py-3 text-sm text-center text-gray-500 border border-gray-300 bg-white">
          このスレッドは過去ログです。レスできません。
        </div>
      )}

      {/* 下部ナビ */}
      <div className="flex mt-4 text-sm border border-gray-300">
        {[
          { label: '↺ 更新順一覧', href: '/update' },
          { label: '⏱ 新着一覧',   href: '/new' },
          { label: '📊 ランキング', href: '/ranking' },
          { label: '📂 過去ログ',   href: '/archived' },
        ].map((btn) => (
          <Link
            key={btn.href}
            href={btn.href}
            className="flex-1 text-center py-2 hover:bg-gray-50 text-blue-600 border-r border-gray-300 last:border-r-0 text-xs md:text-sm"
          >
            {btn.label}
          </Link>
        ))}
      </div>
    </>
  )
}
