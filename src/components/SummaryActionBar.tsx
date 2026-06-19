'use client'

import { useEffect, useState } from 'react'
import { capturePostHogEvent } from '@/lib/posthog-events'

interface Props {
  slug: string
  title: string
}

export function SummaryActionBar({ slug, title }: Props) {
  const [favorited, setFavorited] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setFavorited(localStorage.getItem(`summary-favorite:${slug}`) === '1')
  }, [slug])

  const toggleFavorite = () => {
    const next = !favorited
    setFavorited(next)
    if (next) localStorage.setItem(`summary-favorite:${slug}`, '1')
    else localStorage.removeItem(`summary-favorite:${slug}`)
    capturePostHogEvent('summary_favorite_toggle', { slug, favorited: next })
  }

  const shareX = () => {
    const url = `${window.location.origin}${window.location.pathname}`
    const text = `${title.trim()}\n${url}`
    capturePostHogEvent('summary_x_share_click', { slug, title })
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer,width=600,height=400')
  }

  const copyUrl = async () => {
    const url = `${window.location.origin}${window.location.pathname}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      prompt('URLをコピーしてください', url)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={toggleFavorite}
        className="text-xl leading-none w-8 h-8 flex items-center justify-center"
        style={{ color: favorited ? '#f5a623' : '#aaa' }}
        title={favorited ? 'お気に入りを解除' : 'お気に入りに追加'}
      >
        {favorited ? '★' : '☆'}
      </button>
      <button
        type="button"
        onClick={shareX}
        className="h-8 rounded bg-black px-2 text-xs font-bold text-white transition-colors hover:bg-gray-800 active:scale-[0.98]"
        style={{ background: '#000' }}
        title="Xでシェア"
      >
        Xでシェア
      </button>
      <button
        type="button"
        onClick={copyUrl}
        className="h-8 rounded border border-blue-500 bg-white px-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-50 active:scale-[0.98]"
      >
        {copied ? 'URLをコピーしました' : 'URLをコピー'}
      </button>
    </div>
  )
}
