'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Post, PublicAuthorProfile } from '@/types'
import { formatDateTimeJP } from '@/lib/utils'
import { deleteOwnPost } from '@/app/actions/delete'
import { PostLikeButton } from './PostLikeButton'
import { ReportButton } from './ReportButton'
import { ImageViewer } from './ImageViewer'
import { LinkCard } from './LinkCard'

declare global {
  interface Window {
    twttr?: { widgets: { load: (el?: HTMLElement | null) => void } }
  }
}

function isTwitterWidgetVideoPauseError(message: string): boolean {
  return /pause/i.test(message) && /video|querySelector|undefined|null/i.test(message)
}

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

interface Props {
  post: Post
  allPosts: Post[]
  onAnchorClick: (displayNum: number) => void
  displayNumber: number
  sessionId: string
  currentUserId?: string
  threadSessionId: string
  threadId: number
  authorProfile?: PublicAuthorProfile
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
        className="no-underline hover:underline hover:opacity-75"
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

// Twitter/X ツイートURL抽出
// - /status/ID 形式
// - twterm%5EID（URL encoded ^）付きトラッキングURLにも対応
function extractTwitterStatusUrl(url: string): string | null {
  // 通常の status URL
  const statusMatch = url.match(/^https?:\/\/(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/i)
  if (statusMatch) return url

  // 埋め込みトラッキングURL（例: x.com/user?twterm%5E=TWEETID）
  const twtermMatch = url.match(/[?&]twterm(?:%5E|\^)(\d+)/i)
  const usernameMatch = url.match(/^https?:\/\/(?:twitter\.com|x\.com)\/(\w+)/i)
  if (twtermMatch && usernameMatch) {
    return `https://x.com/${usernameMatch[1]}/status/${twtermMatch[1]}`
  }
  return null
}

function TwitterEmbed({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    ref.current.innerHTML = `<blockquote class="twitter-tweet" data-lang="ja"><a href="${escapeHtmlAttr(url)}"></a></blockquote>`

    const onWidgetError = (event: ErrorEvent) => {
      const message = `${event.message || ''} ${event.error?.message || ''}`
      if (isTwitterWidgetVideoPauseError(message)) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    }
    window.addEventListener('error', onWidgetError, true)

    const load = () => {
      try {
        window.twttr?.widgets.load(ref.current!)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!isTwitterWidgetVideoPauseError(message)) setFailed(true)
      }
    }

    if (window.twttr?.widgets) {
      load()
    } else if (!document.getElementById('twitter-widgets-js')) {
      const script = document.createElement('script')
      script.id = 'twitter-widgets-js'
      script.src = 'https://platform.twitter.com/widgets.js'
      script.async = true
      script.charset = 'utf-8'
      script.onload = load
      document.head.appendChild(script)
    } else {
      const interval = window.setInterval(() => {
        if (window.twttr?.widgets) {
          window.clearInterval(interval)
          load()
        }
      }, 200)
      const timeout = window.setTimeout(() => {
        const rendered = !!ref.current?.querySelector('iframe.twitter-tweet, iframe[id^="twitter-widget-"]')
        if (!rendered) setFailed(true)
      }, 15000)
      return () => {
        window.clearInterval(interval)
        window.clearTimeout(timeout)
        window.removeEventListener('error', onWidgetError, true)
      }
    }

    const timeout = window.setTimeout(() => {
      const rendered = !!ref.current?.querySelector('iframe.twitter-tweet, iframe[id^="twitter-widget-"]')
      if (!rendered) setFailed(true)
    }, 15000)
    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener('error', onWidgetError, true)
    }
  }, [url])

  if (failed) {
    return (
      <div className="my-2 text-sm">
        <span className="text-gray-500">Xポストを表示できませんでした。</span>{' '}
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
          Xで開く
        </a>
      </div>
    )
  }

  return <div ref={ref} className="my-2" />
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
export function renderBody(body: string, allPosts: Post[]): React.ReactNode[] {
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

    // 行頭のURLを抽出（後ろにテキストが続いていても埋め込み対象とする）
    const urlMatch = trimmed.match(/^(https?:\/\/\S+)/)
    if (urlMatch) {
      const url = urlMatch[1]

      // YouTube
      const ytId = extractYouTubeId(url)
      if (ytId) {
        flushText()
        elements.push(<YouTubeEmbed key={key++} videoId={ytId} />)
        continue
      }
      // Twitter/X（status URL・twterm付きトラッキングURL両対応）
      if (/(?:twitter\.com|x\.com)/i.test(url)) {
        const tweetUrl = extractTwitterStatusUrl(url)
        if (tweetUrl) {
          flushText()
          elements.push(<TwitterEmbed key={key++} url={tweetUrl} />)
          continue
        }
      }

      // その他のURL → OGPリンクカード
      flushText()
      elements.push(<LinkCard key={key++} url={url} />)
      continue
    }

    if (trimmed !== '' && /^(>>\d+\s*)+$/.test(trimmed)) {
      flushText()
      elements.push(
        <span key={key++} className="block" style={{ marginBottom: 2, whiteSpace: 'pre-wrap' }}>
          {renderWithAnchors(line, allPosts)}
        </span>
      )
      continue
    }

    textBuf.push(line)
  }

  flushText()
  return elements
}

function TimelineAvatar({ src, alt }: { src: string | null | undefined; alt: string }) {
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

function PostAuthorName({
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
        <TimelineAvatar src={profile.avatar_url} alt={`${profile.display_name}のアイコン`} />
        <span>{profile.display_name}</span>
      </span>
    )
  }

  return (
    <Link
      href={`/u/${profile.profile_slug}`}
      className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
    >
      <TimelineAvatar src={profile.avatar_url} alt={`${profile.display_name}のアイコン`} />
      <span>{profile.display_name}</span>
    </Link>
  )
}

export function PostItem({
  post,
  allPosts,
  onAnchorClick,
  displayNumber,
  sessionId,
  currentUserId = '',
  threadSessionId,
  threadId,
  authorProfile,
}: Props) {
  const [locallyDeletedByUser, setLocallyDeletedByUser] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [isPending, startTransition] = useTransition()

  const postSessionId = (post as Post & { session_id?: string }).session_id ?? ''
  const isDeletedByRegisteredUser =
    locallyDeletedByUser || post.is_deleted === true
  const canDeleteBySession = Boolean(sessionId && (postSessionId === sessionId || threadSessionId === sessionId))
  const canDeleteByUser = Boolean(currentUserId && post.user_id === currentUserId)
  const canDelete = !isDeletedByRegisteredUser && (canDeleteBySession || canDeleteByUser)

  const handleDelete = () => {
    if (!confirm('このコメントを削除しますか？')) return
    setDeleteError('')
    startTransition(async () => {
      const res = await deleteOwnPost(post.id, threadId)
      if (res.error) {
        setDeleteError(res.error)
      } else {
        setLocallyDeletedByUser(true)
      }
    })
  }

  return (
    <div id={`post-${displayNumber}`} className="border-b border-gray-200 last:border-b-0">
      {/* ヘッダー行 */}
      <div className="px-2 py-1.5 text-xs flex items-center gap-1 flex-wrap" style={{ background: '#f5f5f5' }}>
        <button
          type="button"
          onClick={() => onAnchorClick(displayNumber)}
          className="inline-flex items-center px-1.5 py-0.5 font-bold cursor-pointer border border-blue-300 bg-white hover:bg-blue-50 leading-none shrink-0 mr-1.5"
          style={{ color: '#0d6efd' }}
          title={`>>${displayNumber}を本文に挿入`}
        >
          ▶{displayNumber}
        </button>
        {isDeletedByRegisteredUser ? (
          <>
            <span className="font-medium text-gray-700">名無しのデュエリスト</span>
            <span className="text-gray-400">{formatDateTimeJP(post.created_at)}</span>
          </>
        ) : (
          <>
            <PostAuthorName fallbackName={post.author_name} profile={authorProfile} />
            <span className="text-gray-400">{formatDateTimeJP(post.created_at)}</span>
            <PostLikeButton likeKey={`post-${post.id}`} />
            <ReportButton itemType="post" itemId={post.id} itemBody={post.body} />
          </>
        )}
        {!isDeletedByRegisteredUser && canDelete && (
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
        {!isDeletedByRegisteredUser && deleteError && (
          <span className="text-[10px] text-red-600 ml-1">{deleteError}</span>
        )}
      </div>

      {/* 本文（YouTube/X URL は自動埋め込み） */}
      {isDeletedByRegisteredUser ? (
        <div className="px-3 py-3 text-sm text-gray-500 break-words leading-relaxed">
          このコメントは削除されました
        </div>
      ) : (
        <div className="px-3 pt-1.5 pb-7 text-base text-gray-800 break-words leading-relaxed">
          {renderBody(post.body, allPosts)}
        </div>
      )}

      {/* 添付画像 */}
      {!isDeletedByRegisteredUser && post.image_url && (
        <div className="px-3 pb-2">
          <ImageViewer src={post.image_url} />
        </div>
      )}
    </div>
  )
}
