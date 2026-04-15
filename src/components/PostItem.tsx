'use client'

import { useState, useTransition } from 'react'
import { Post } from '@/types'
import { formatDateTimeJP } from '@/lib/utils'
import { deleteOwnPost } from '@/app/actions/delete'
import { PostLikeButton } from './PostLikeButton'
import { ReportButton } from './ReportButton'

interface Props {
  post: Post
  allPosts: Post[]
  onAnchorClick: (displayNum: number) => void
  displayNumber: number
  sessionId: string
  threadSessionId: string
  threadId: number
}

interface AnchorProps {
  num: number
  allPosts: Post[]
}

function AnchorLink({ num, allPosts }: AnchorProps) {
  const [show, setShow] = useState(false)
  const ref = allPosts.find(p => (p as Post & { displayNumber: number }).displayNumber === num)

  return (
    <span className="relative inline-block">
      <a
        href={`#post-${num}`}
        className="font-medium hover:underline"
        style={{ color: '#0d6efd' }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={e => {
          e.preventDefault()
          document.getElementById(`post-${num}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }}
      >
        &gt;&gt;{num}
      </a>
      {show && ref && (
        <span
          className="absolute left-0 z-50 bg-white shadow-lg p-2 text-xs"
          style={{
            top: '1.2em',
            minWidth: 220,
            maxWidth: 320,
            border: '1px solid #aaa',
            display: 'block',
            whiteSpace: 'normal',
          }}
        >
          <span className="text-gray-500 block mb-1">
            &gt;{num} {ref.author_name} {formatDateTimeJP(ref.created_at)}
          </span>
          <span className="text-gray-800 block break-all" style={{ whiteSpace: 'pre-wrap' }}>
            {ref.body.slice(0, 200)}{ref.body.length > 200 ? '…' : ''}
          </span>
          {ref.image_url && (
            <span className="text-gray-400 text-[10px] block mt-1">[画像あり]</span>
          )}
        </span>
      )}
    </span>
  )
}

function renderBody(body: string, allPosts: Post[]) {
  const result: React.ReactNode[] = []
  const regex = />>(\d+)/g
  let last = 0
  let match
  let key = 0

  while ((match = regex.exec(body)) !== null) {
    if (match.index > last) {
      result.push(<span key={key++}>{body.slice(last, match.index)}</span>)
    }
    result.push(
      <AnchorLink key={key++} num={parseInt(match[1])} allPosts={allPosts} />
    )
    last = regex.lastIndex
  }
  if (last < body.length) {
    result.push(<span key={key++}>{body.slice(last)}</span>)
  }
  return result
}

export function PostItem({ post, allPosts, onAnchorClick, displayNumber, sessionId, threadSessionId, threadId }: Props) {
  const [deleted, setDeleted] = useState(false)
  const [isPending, startTransition] = useTransition()

  const postSessionId = (post as Post & { session_id?: string }).session_id ?? ''
  const canDelete = sessionId && (postSessionId === sessionId || threadSessionId === sessionId)

  const handleDelete = () => {
    if (!confirm('このレスを削除しますか？')) return
    startTransition(async () => {
      const res = await deleteOwnPost(post.id, threadId)
      if (!res.error) setDeleted(true)
    })
  }

  if (deleted) return null

  return (
    <div id={`post-${displayNumber}`} className="border-b border-gray-200 last:border-b-0">
      {/* ヘッダー行 */}
      <div
        className="px-2 py-1.5 text-xs flex items-center gap-2 flex-wrap"
        style={{ background: '#f5f5f5' }}
      >
        <button
          type="button"
          onClick={() => onAnchorClick(displayNumber)}
          className="font-bold hover:underline cursor-pointer"
          style={{ color: '#0d6efd' }}
          title={`>>${displayNumber}を本文に挿入`}
        >
          ▶{displayNumber}
        </button>
        <span className="font-medium text-gray-700">{post.author_name}</span>
        <span className="text-gray-400">{formatDateTimeJP(post.created_at)}</span>
        <PostLikeButton likeKey={`post-${post.id}`} />
        <ReportButton itemType="post" itemId={post.id} itemBody={post.body} />
        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="text-[10px] px-1.5 py-0.5 font-medium ml-1 disabled:opacity-50"
            style={{ color: '#fff', background: '#6c757d', border: '1px solid #6c757d' }}
          >
            削除
          </button>
        )}
      </div>

      {/* 本文 */}
      <div className="px-3 py-3 text-sm text-gray-800 break-words leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
        {renderBody(post.body, allPosts)}
      </div>

      {/* 画像 */}
      {post.image_url && (
        <div className="px-3 pb-2">
          <a href={post.image_url} target="_blank" rel="noopener noreferrer">
            <img
              src={post.image_url}
              alt="添付画像"
              className="max-h-80 max-w-full object-contain hover:opacity-90 cursor-zoom-in"
            />
          </a>
        </div>
      )}
    </div>
  )
}
