'use client'

import { Suspense, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { LinkCard } from './LinkCard'

// react-tweet は重いので遅延ロード
const Tweet = dynamic(() => import('react-tweet').then(m => ({ default: m.Tweet })), {
  ssr: false,
  loading: () => <div className="text-xs text-gray-400 py-2">ツイートを読み込み中...</div>,
})

// ── YouTube埋め込み（PostItemと同じスタイル） ───────────────────────
function YouTubeEmbed({ videoId }: { videoId: string }) {
  return (
    <div className="my-3 w-full" style={{ maxWidth: 560 }}>
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

// ── Twitter/X埋め込み（PostItemと同じスタイル） ──────────────────────
function TwitterEmbed({ tweetId }: { tweetId: string }) {
  return (
    <div className="my-3 w-full overflow-x-hidden" style={{ maxWidth: 480 }}>
      <Suspense fallback={<div className="text-xs text-gray-400 py-2">ツイートを読み込み中...</div>}>
        <Tweet id={tweetId} />
      </Suspense>
    </div>
  )
}

// ── HTMLパーサー（サーバーサイド非依存） ───────────────────────────
// Tiptapが出力したHTML文字列を解析し、
// data-youtube / data-tweet / data-link-card の div をReactコンポーネントに置換する
function normalizeSummaryHtml(html: string): string {
  const next = html
    .replace(/href=(["'])\/category\/card\1/g, 'href=$1/category/new-cards$1')
    .replace(/href=(["'])\/category\/cs\1/g, 'href=$1/category/tournament$1')
    .replace(/<a\b([^>]*)>/gi, (tag) => {
      let next = tag
      if (!/\starget=/i.test(next)) next = next.replace(/>$/, ' target="_blank">')
      if (!/\srel=/i.test(next)) next = next.replace(/>$/, ' rel="noopener noreferrer">')
      return next
    })

  return next
}

function parseBody(html: string): React.ReactNode[] {
  const normalizedHtml = normalizeSummaryHtml(html)
  // DOMParser はブラウザ専用なので、正規表現でマーカーを検出する
  // サーバーサイドレンダリング時はそのまま innerHTML で表示されるので
  // クライアント側だけで動けばよい

  const parts: React.ReactNode[] = []
  let key = 0

  // マーカーパターン
  const markerRe = /<div\s+data-(youtube|tweet|link-card)="([^"]*)"[^>]*><\/div>/gi

  let lastIndex = 0
  const matches: Array<{ index: number; full: string; type: string; value: string }> = []

  let m: RegExpExecArray | null
  const re = new RegExp(markerRe.source, 'gi')
  while ((m = re.exec(normalizedHtml)) !== null) {
    matches.push({ index: m.index, full: m[0], type: m[1], value: m[2] })
  }

  if (matches.length === 0) {
    // マーカーなし → そのまま dangerouslySetInnerHTML で出力
    return [
      <div
        key="body"
        className="summary-body-html"
        dangerouslySetInnerHTML={{ __html: normalizedHtml }}
      />,
    ]
  }

  for (const match of matches) {
    // マーカー前のHTML
    const before = normalizedHtml.slice(lastIndex, match.index)
    if (before.trim()) {
      parts.push(
        <div
          key={key++}
          className="summary-body-html"
          dangerouslySetInnerHTML={{ __html: before }}
        />,
      )
    }

    // マーカー本体 → Reactコンポーネントに変換
    const { type, value } = match
    if (type === 'youtube') {
      parts.push(<YouTubeEmbed key={key++} videoId={value} />)
    } else if (type === 'tweet') {
      parts.push(<TwitterEmbed key={key++} tweetId={value} />)
    } else if (type === 'link-card') {
      parts.push(<LinkCard key={key++} url={value} />)
    }

    lastIndex = match.index + match.full.length
  }

  // 最後のHTML
  const tail = normalizedHtml.slice(lastIndex)
  if (tail.trim()) {
    parts.push(
      <div
        key={key++}
        className="summary-body-html"
        dangerouslySetInnerHTML={{ __html: tail }}
      />,
    )
  }

  return parts
}

interface Props {
  body: string
}

export function SummaryBodyRenderer({ body }: Props) {
  const nodes = useMemo(() => parseBody(body), [body])

  return (
    <div className="summary-body-root">
      {nodes}
      <style>{`
        .summary-body-html {
          font-size: 14px;
          line-height: 1.8;
          color: #1f2937;
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        .summary-body-html p {
          margin-bottom: 0.85em;
        }
        .summary-body-html p:last-child { margin-bottom: 0; }
        .summary-body-html h2 {
          font-size: 1.2em;
          font-weight: bold;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
          padding-bottom: 0.3em;
          border-bottom: 2px solid #e5e7eb;
        }
        .summary-body-html h3 {
          font-size: 1.05em;
          font-weight: bold;
          margin-top: 1.2em;
          margin-bottom: 0.4em;
        }
        .summary-body-html a {
          color: #2563eb;
          text-decoration: underline;
        }
        .summary-body-html ul {
          list-style: disc;
          padding-left: 1.5em;
          margin-bottom: 0.75em;
        }
        .summary-body-html ol {
          list-style: decimal;
          padding-left: 1.5em;
          margin-bottom: 0.75em;
        }
        .summary-body-html li { margin-bottom: 0.25em; }
        .summary-body-html strong { font-weight: bold; }
        .summary-body-html em { font-style: italic; }
        .summary-body-html img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 0.75em 0;
        }
      `}</style>
    </div>
  )
}
