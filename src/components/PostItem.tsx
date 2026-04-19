'use client'

import { useState, useTransition, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { Post } from '@/types'
import { formatDateTimeJP } from '@/lib/utils'
import { deleteOwnPost } from '@/app/actions/delete'
import { PostLikeButton } from './PostLikeButton'
import { ReportButton } from './ReportButton'
import { ImageViewer } from './ImageViewer'

// react-tweetは重いので必要なときだけ遅延ロード
const Tweet = dynamic(() => import('react-tweet').then(m => ({ default: m.Tweet })), {
  ssr: false,
  loading: () => <div className="text-xs text-gray-400 py-2">ツイートを読み込み中...</div>,
})

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
          style={{ top: '1.2em', minWidth: 220, maxWidth: 320, border: '1px solid #aaa', display: 'block', whiteSpace: 'normal' }}
        >
          <span className="text-gray-500 block mb-1">
            &gt;{num} {ref.author_name} {formatDateTimeJP(ref.created_at)}
          </span>
          <span className="text-gray-800 block break-all" style={{ whiteSpace: 'pre-wrap' }}>
            {ref.body.slice(0, 200)}{ref.body.length > 200 ? '…' : ''}
          </span>
          {ref.image_url && <span className="text-gray-400 text-[10px] block mt-1">[画像あり]</span>}
        </span>
      )}
    </span>
  )
}

// YouTube video ID 抽出
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

// Twitter/X ツイートID抽出
// - /status/ID 形式
// - twterm%5EID（URL encoded ^）付きトラッキングURLにも対応
function extractTweetId(url: string): string | null {
  // /status/ID 形式
  const statusMatch = url.match(/\/status\/(\d+)/i)
  if (statusMatch) return statusMatch[1]

  // 埋め込みトラッキングURL（twterm%5E=TWEETID）
  const twtermMatch = url.match(/[?&]twterm(?:%5E|\^)(\d+)/i)
  if (twtermMatch) return twtermMatch[1]

  return null
}

// Twitter/X 埋め込み（react-tweet 使用）
function TwitterEmbed({ tweetId }: { tweetId: string }) {
  return (
    <div className="my-2 w-full overflow-x-hidden" style={{ maxWidth: 480 }}>
      <Suspense fallback={<div className="text-xs text-gray-400 py-2">ツイートを読み込み中...</div>}>
        <Tweet id={tweetId} />
      </Suspense>
    </div>
  )
}

// YouTube 埋め込み（最大幅480px）
function YouTubeEmbed({ videoId }: { videoId: string }) {
  return (
    <div className="my-2 w-full" style={{ maxWidth: 480 }}>
      <div className="relative bg-black" style={{ paddingBottom: '56.25%' }}>
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube.com/embed/${videoId}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          title="YouTube video"
        />
      </div>
    </div>
  )
}


// テキスト中の >>N を AnchorLink に変換
function renderWithAnchors(text: string, allPosts: Post[]): React.ReactNode[] {
  const result: React.ReactNode[] = []
  const regex = />>(\d+)/g
  let last = 0
  let match
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      result.push(<span key={key++}>{text.slice(last, match.index)}</span>)
    }
    result.push(<AnchorLink key={key++} num={parseInt(match[1])} allPosts={allPosts} />)
    last = regex.lastIndex
  }
  if (last < text.length) {
    result.push(<span key={key++}>{text.slice(last)}</span>)
  }
  return result
}

// 本文レンダリング：行ごとにURL埋め込み判定
function renderBody(body: string, allPosts: Post[]): React.ReactNode[] {
  const lines = body.split('\n')
  const elements: React.ReactNode[] = []
  const textBuf: string[] = []
  let key = 0

  const flushText = () => {
    if (textBuf.length === 0) return
    const joined = textBuf.join('\n')
    elements.push(
      <span key={key++} style={{ whiteSpace: 'pre-wrap' }}>
        {renderWithAnchors(joined, allPosts)}
      </span>
    )
    textBuf.length = 0
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (/^https?:\/\/\S+$/.test(trimmed)) {
      // YouTube
      const ytId = extractYouTubeId(trimmed)
      if (ytId) {
        flushText()
        elements.push(<YouTubeEmbed key={key++} videoId={ytId} />)
        continue
      }
      // Twitter/X（status URL・twterm付きトラッキングURL両対応）
      if (/(?:twitter\.com|x\.com)/i.test(trimmed)) {
        const tweetId = extractTweetId(trimmed)
        if (tweetId) {
          flushText()
          elements.push(<TwitterEmbed key={key++} tweetId={tweetId} />)
          continue
        }
      }
    }

    textBuf.push(line)
  }

  flushText()
  return elements
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
      <div className="px-2 py-1.5 text-xs flex items-center gap-1 flex-wrap" style={{ background: '#f5f5f5' }}>
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

      {/* 本文（YouTube/X URL は自動埋め込み） */}
      <div className="px-3 py-3 text-sm text-gray-800 break-words leading-relaxed">
        {renderBody(post.body, allPosts)}
      </div>

      {/* 添付画像 */}
      {post.image_url && (
        <div className="px-3 pb-2">
          <ImageViewer src={post.image_url} />
        </div>
      )}
    </div>
  )
}
